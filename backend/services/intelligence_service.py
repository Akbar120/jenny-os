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
    for raw in re.split(r'[,\n]', input_str):
        cleaned = raw.strip().strip('"\'*-[].()')
        if cleaned:
            items.append(cleaned)
    return items


# ---------------------------------------------------------------------------
# Provider-specific callers
# ---------------------------------------------------------------------------

def _call_ollama(prompt: str, model: str, ollama_url: str) -> str:
    """Calls local Ollama API. Returns raw text response."""
    url = f"{ollama_url.rstrip('/')}/api/generate"
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.3}
    }
    try:
        response = httpx.post(url, json=payload, timeout=30.0)
        if response.status_code == 200:
            return response.json().get("response", "")
        raise RuntimeError(f"Ollama returned status {response.status_code}: {response.text[:200]}")
    except httpx.RequestError as e:
        logger.error(f"Ollama connection error: {e}")
        raise RuntimeError("Ollama model is offline or unreachable. Please connect/start your local Ollama model first.")


def _call_openai_compatible(prompt: str, model: str, api_key: str, base_url: str) -> str:
    """
    Calls any OpenAI-compatible API (OpenAI, OpenRouter, etc.).
    base_url examples:
      OpenAI:     https://api.openai.com/v1
      OpenRouter: https://openrouter.ai/api/v1
    """
    url = f"{base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    # OpenRouter needs an extra header
    if "openrouter" in base_url:
        headers["HTTP-Referer"] = "https://jenny-os.local"
        headers["X-Title"] = "Jenny OS"

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
    }
    response = httpx.post(url, json=payload, headers=headers, timeout=30.0)
    if response.status_code == 200:
        return response.json()["choices"][0]["message"]["content"]
    raise RuntimeError(
        f"API returned status {response.status_code}: {response.text[:300]}"
    )


def _call_anthropic(prompt: str, model: str, api_key: str) -> str:
    """Calls Anthropic Claude API."""
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "max_tokens": 256,
        "messages": [{"role": "user", "content": prompt}],
    }
    response = httpx.post(url, json=payload, headers=headers, timeout=30.0)
    if response.status_code == 200:
        return response.json()["content"][0]["text"]
    raise RuntimeError(
        f"Anthropic API returned status {response.status_code}: {response.text[:300]}"
    )


def _call_google(prompt: str, model: str, api_key: str) -> str:
    """Calls Google Gemini API."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 256},
    }
    response = httpx.post(url, json=payload, timeout=30.0)
    if response.status_code == 200:
        return response.json()["candidates"][0]["content"]["parts"][0]["text"]
    raise RuntimeError(
        f"Google Gemini API returned status {response.status_code}: {response.text[:300]}"
    )


# ---------------------------------------------------------------------------
# Main dispatcher
# ---------------------------------------------------------------------------

def _call_llm(prompt: str) -> str:
    """
    Routes the LLM call to the correct provider based on settings.
    Reads provider, model, and credentials from config dynamically.
    """
    settings = config.get_settings()
    provider = settings.get("ai_provider", "ollama").lower()
    model = settings.get("model_name", "")
    api_key = settings.get("ai_api_key", "")
    ollama_url = settings.get("ollama_url", "http://localhost:11434")

    if not model:
        raise ValueError("Model name is not configured in Settings.")

    if provider == "ollama":
        if not ollama_url:
            raise ValueError("Ollama URL must be configured in Settings.")
        return _call_ollama(prompt, model, ollama_url)

    elif provider == "openai":
        if not api_key:
            raise ValueError("OpenAI API key is not configured in Settings.")
        return _call_openai_compatible(prompt, model, api_key, "https://api.openai.com/v1")

    elif provider == "openrouter":
        if not api_key:
            raise ValueError("OpenRouter API key is not configured in Settings.")
        return _call_openai_compatible(prompt, model, api_key, "https://openrouter.ai/api/v1")

    elif provider == "anthropic":
        if not api_key:
            raise ValueError("Anthropic API key is not configured in Settings.")
        return _call_anthropic(prompt, model, api_key)

    elif provider == "google":
        if not api_key:
            raise ValueError("Google Gemini API key is not configured in Settings.")
        return _call_google(prompt, model, api_key)

    else:
        raise ValueError(f"Unknown AI provider: '{provider}'. Valid options: ollama, openai, openrouter, anthropic, google.")


# ---------------------------------------------------------------------------
# Public: generate_keywords
# ---------------------------------------------------------------------------

def generate_keywords(target_service: str) -> tuple[list[str], bool]:
    """
    Generates keywords for a service using the configured AI provider.

    Returns:
        (keywords: list[str], used_fallback: bool)

    Raises:
        ValueError: If settings are missing.
        RuntimeError: If the AI provider call fails.
    """
    prompt = (
        f"Generate a simple list of 5-8 search keywords for finding freelance work or clients "
        f"who need a '{target_service}'. Respond ONLY with a comma-separated list of keywords. "
        f"Do not include any introductory text, bullet points, or markdown formatting."
    )

    try:
        raw_text = _call_llm(prompt)
        raw_items = clean_list(raw_text)
        keywords = [k.lower() for k in raw_items if k]
        if len(keywords) >= 3:
            return keywords, False
        raise RuntimeError("AI returned too few keywords. Please try again.")
    except (ValueError, RuntimeError):
        raise
    except Exception as e:
        logger.error(f"AI keyword generation failed: {e}")
        raise RuntimeError(f"AI model call failed: {str(e)}")


# ---------------------------------------------------------------------------
# Subreddit Discovery (unchanged below — no LLM involved)
# ---------------------------------------------------------------------------

from html.parser import HTMLParser

class RedditSubredditParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_subreddit = False
        self.in_title = False
        self.current_name = None
        self.current_desc = ""
        self.results = []

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == "div" and "search-result-subreddit" in attrs_dict.get("class", ""):
            self.in_subreddit = True
            self.current_desc = ""
            self.current_name = None
        if self.in_subreddit and tag == "a" and "search-result-link" in attrs_dict.get("class", ""):
            href = attrs_dict.get("href", "")
            if "/r/" in href:
                parts = href.strip("/").split("/")
                if "r" in parts:
                    self.current_name = parts[parts.index("r") + 1]

    def handle_endtag(self, tag):
        if tag == "div" and self.in_subreddit and self.current_name:
            self.results.append({
                "name": self.current_name,
                "description": self.current_desc.strip()
            })
            self.in_subreddit = False
            self.current_name = None

    def handle_data(self, data):
        if self.in_subreddit:
            self.current_desc += " " + data.strip()


def search_reddit_subreddits(keyword: str) -> list[dict]:
    """Searches Reddit for subreddits matching a keyword via public search."""
    try:
        url = f"https://www.reddit.com/subreddits/search.json?q={keyword}&limit=8"
        headers = {"User-Agent": "Jenny-OS/1.0 subreddit-scout"}
        response = httpx.get(url, headers=headers, timeout=10.0, follow_redirects=True)
        if response.status_code != 200:
            return []
        data = response.json()
        results = []
        for child in data.get("data", {}).get("children", []):
            sub = child.get("data", {})
            name = sub.get("display_name", "")
            desc = sub.get("public_description", "") or sub.get("title", "")
            if name:
                results.append({
                    "platform": "reddit",
                    "name": name.lower(),
                    "display_name": f"r/{name}",
                    "description": desc[:150],
                    "url": f"https://reddit.com/r/{name}",
                    "score": 0
                })
        return results[:8]
    except Exception as e:
        logger.warning(f"Reddit subreddit search failed for '{keyword}': {e}")
        return []


def discover_communities(target_service: str, keywords: list[str]) -> list[dict]:
    """
    Discovers and ranks relevant communities (Reddit subreddits + Discord) for a target service.
    Uses community_registry.json as the primary source, then supplements with live Reddit search.
    """
    registry = get_community_registry()
    kw_set = {k.lower() for k in keywords}

    matches = []
    seen_names = set()

    # 1. Score communities from static registry
    for community in registry:
        name_key = community.get("name", "").lower()
        if name_key in seen_names:
            continue

        text_to_match = f"{community.get('name', '')} {community.get('description', '')} {' '.join(community.get('tags', []))}".lower()
        score = sum(1 for kw in kw_set if kw in text_to_match)

        if score > 0:
            seen_names.add(name_key)
            matches.append({**community, "score": score})

    # 2. Dynamic Reddit search for all keywords (deduped)
    dynamic_subreddits = []
    searched_kws: set[str] = set()
    for kw in keywords:
        if len(kw) < 3 or kw in searched_kws:
            continue
        searched_kws.add(kw)
        results = search_reddit_subreddits(kw)
        dynamic_subreddits.extend(results)

    for sub in dynamic_subreddits:
        name_key = sub.get("name", "").lower()
        if name_key in seen_names:
            continue
        seen_names.add(name_key)

        # Proper overlap score
        text_to_match = f"{sub['name']} {sub['description']}".lower()
        sub_score = sum(1 for kw in kw_set if kw in text_to_match)
        if sub_score == 0:
            sub_score = 1

        sub["score"] = sub_score
        matches.append(sub)

    # Sort by score descending
    matches.sort(key=lambda x: x.get("score", 0), reverse=True)
    return matches
