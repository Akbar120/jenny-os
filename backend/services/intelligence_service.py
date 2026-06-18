import httpx
import json
import logging
import re
from pathlib import Path
from backend import config

logger = logging.getLogger("intelligence_service")

REGISTRY_FILE = Path(__file__).parent.parent / "database" / "community_registry.json"

def get_community_registry() -> list[dict]:
    """Reads the community registry database from JSON."""
    try:
        with open(REGISTRY_FILE, "r") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to read community registry: {e}")
        return []

def clean_list(input_str: str) -> list[str]:
    """Helper to clean comma-separated or list-formatted responses from LLM."""
    if not input_str:
        return []
    items = []
    # Split by comma or newline
    for raw in re.split(r'[,\n]', input_str):
        cleaned = raw.strip().strip('"\'*-[].()')
        if cleaned:
            items.append(cleaned)
    return items

def generate_keywords(target_service: str) -> tuple[list[str], bool]:
    """Queries Ollama to generate keywords for a service.
    
    Raises:
        ValueError: If model settings are not configured.
        RuntimeError: If Ollama is offline, unreachable, or fails.
    """
    ollama_url = config.OLLAMA_URL
    model = config.MODEL_NAME
    
    if not ollama_url or not model or not ollama_url.strip() or not model.strip():
        raise ValueError("Ollama URL and model name must be configured in Settings first.")
        
    url = f"{ollama_url}/api/generate"
    prompt = (
        f"Generate a simple list of 5-8 search keywords for finding freelance work or clients "
        f"who need a '{target_service}'. Respond ONLY with a comma-separated list of keywords. "
        f"Do not include any introductory text, bullet points, or markdown formatting."
    )
    
    try:
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.3}
        }
        response = httpx.post(url, json=payload, timeout=30.0)
        if response.status_code == 200:
            result = response.json().get("response", "")
            raw_items = clean_list(result)
            keywords = [k.lower() for k in raw_items if k]
            if len(keywords) >= 3:
                return keywords, False
            raise RuntimeError("Ollama returned too few keywords. Please try again.")
        else:
            raise RuntimeError(f"Ollama returned status code {response.status_code}.")
    except Exception as e:
        logger.error(f"Ollama keyword generation failed: {e}")
        raise RuntimeError("Ollama model is offline or unreachable. Please connect/start your local Ollama model first.")

from html.parser import HTMLParser

class RedditSubredditParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_subreddit = False
        self.in_title = False
        self.in_description = False
        self.in_md = False
        self.depth_description = 0
        self.current_item = {}
        self.results = []
        
    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        cls = attrs_dict.get("class", "")
        
        # Check if we are starting a subreddit item
        if tag == "div" and "subreddit" in cls and "thing" in cls:
            self.in_subreddit = True
            self.current_item = {"name": "", "display_name": "", "description": "", "url": ""}
            
        if self.in_subreddit:
            if tag == "a" and cls == "title":
                self.in_title = True
                href = attrs_dict.get("href", "")
                match = re.search(r'/r/([^/]+)/?', href)
                if match:
                    self.current_item["name"] = match.group(1)
                    self.current_item["display_name"] = f"r/{match.group(1)}"
                    self.current_item["url"] = f"https://www.reddit.com/r/{match.group(1)}/"
            
            elif tag == "div" and cls == "description":
                self.in_description = True
                self.depth_description = 1
                
            elif self.in_description:
                self.depth_description += 1
                if tag == "div" and "md" in cls:
                    self.in_md = True

    def handle_endtag(self, tag):
        if self.in_subreddit:
            if tag == "a" and self.in_title:
                self.in_title = False
                
            elif self.in_description:
                self.depth_description -= 1
                if self.depth_description == 0:
                    self.in_description = False
                    self.in_md = False
                    # Subreddit item is complete
                    if self.current_item.get("name"):
                        self.results.append(self.current_item)
                    self.in_subreddit = False
                elif tag == "div" and self.in_md:
                    self.in_md = False

    def handle_data(self, data):
        if self.in_subreddit:
            if self.in_md:
                self.current_item["description"] += data
            elif self.in_description and not self.current_item["description"]:
                cleaned = data.strip()
                if cleaned and not cleaned.startswith("post_form") and not cleaned.startswith("thing_id"):
                    self.current_item["description"] += " " + cleaned

def search_reddit_subreddits(keyword: str) -> list[dict]:
    """Queries old.reddit.com's public search page and parses subreddits matching the keyword."""
    url = f"https://old.reddit.com/subreddits/search?q={keyword}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        response = httpx.get(url, headers=headers, timeout=10.0)
        if response.status_code == 200:
            parser = RedditSubredditParser()
            parser.feed(response.text)
            
            results = []
            for item in parser.results[:8]:
                name = item["name"]
                desc = re.sub(r'\s+', ' ', item["description"]).strip()
                results.append({
                    "id": f"reddit_dynamic_{name}",
                    "platform": "reddit",
                    "name": name,
                    "display_name": f"r/{name}",
                    "description": desc or "Dynamically discovered Reddit community",
                    "url": f"https://www.reddit.com/r/{name}/"
                })
            return results
    except Exception as e:
        logger.warning(f"Reddit subreddit HTML search failed for keyword '{keyword}': {e}")
    return []

def discover_communities(target_service: str, keywords: list[str]) -> list[dict]:
    """Scans community_registry.json and dynamically searches Reddit to return relevant communities ranked by score."""
    registry = get_community_registry()
    kw_set = {k.lower().strip() for k in keywords if k.strip()}
    
    matches = []
    seen_names = set()
    
    # 1. Gather registry matches
    if registry:
        for entry in registry:
            entry_kws = {k.lower().strip() for k in entry.get("keywords", [])}
            overlap = kw_set.intersection(entry_kws)
            score = len(overlap)
            
            if score > 0:
                name_key = entry.get("name", "").lower().strip()
                seen_names.add(name_key)
                matches.append({
                    "id": entry.get("id"),
                    "platform": entry.get("platform"),
                    "name": entry.get("name"),
                    "display_name": entry.get("display_name"),
                    "description": entry.get("description"),
                    "url": entry.get("url"),
                    "score": score
                })
                
    # 2. Dynamic Reddit Search for all keywords (deduplicated to prevent rate limits)
    dynamic_subreddits = []
    searched_kws: set[str] = set()
    for kw in keywords:
        # Skip very short or duplicate keywords
        if len(kw) < 3 or kw in searched_kws:
            continue
        searched_kws.add(kw)
        results = search_reddit_subreddits(kw)
        dynamic_subreddits.extend(results)
        
    # Deduplicate and score dynamic subreddits
    for sub in dynamic_subreddits:
        name_key = sub["name"].lower().strip()
        if name_key in seen_names:
            continue
        seen_names.add(name_key)
        
        # Proper overlap score: count how many mission keywords appear in subreddit name+description
        text_to_match = f"{sub['name']} {sub['description']}".lower()
        sub_score = sum(1 for kw in kw_set if kw in text_to_match)
        # A subreddit matched the search query, give it at least 1 point
        if sub_score == 0:
            sub_score = 1
            
        sub["score"] = sub_score
        matches.append(sub)
        
    # Sort by score descending
    matches.sort(key=lambda x: x["score"], reverse=True)
    return matches

def discover_subreddits(target_service: str, keywords: list[str]) -> list[str]:
    """Backward-compatible function returning just subreddit names."""
    communities = discover_communities(target_service, keywords)
    return [c["name"] for c in communities if c["platform"] == "reddit"]
