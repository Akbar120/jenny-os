import httpx
import xml.etree.ElementTree as ET
import re
import html
import threading
import logging
import time
from backend.connectors.base import BaseConnector, RawLead
from backend import config as app_config

class RedditConnector(BaseConnector):
    _lock = threading.Lock()
    _last_request_time = 0.0

    def _get_oauth_token(self, client_id: str, client_secret: str) -> str | None:
        """Retrieves an Application-Only OAuth token from Reddit."""
        url = "https://www.reddit.com/api/v1/access_token"
        headers = {
            "User-Agent": "pc:jenny-os-lead-hunter:v1.0.0 (by /u/jenny_os_bot)"
        }
        data = {"grant_type": "client_credentials"}
        try:
            response = httpx.post(url, headers=headers, auth=(client_id, client_secret), data=data, timeout=10.0)
            if response.status_code == 200:
                token_data = response.json()
                return token_data.get("access_token")
            else:
                logger = logging.getLogger("reddit_connector")
                logger.warning(f"Reddit OAuth token request failed: {response.status_code} - {response.text}")
        except Exception as e:
            logger = logging.getLogger("reddit_connector")
            logger.warning(f"Reddit OAuth token request failed with exception: {e}")
        return None

    def fetch(self, config: dict) -> list[RawLead]:
        """Fetches raw leads from Reddit using OAuth if configured, falling back to RSS2JSON bridge, then public RSS/JSON."""
        subreddit = config.get("subreddit")
        limit = config.get("limit", 25)
        if not subreddit:
            raise ValueError("Subreddit name is required in config.")
        
        client_id = app_config.REDDIT_CLIENT_ID
        client_secret = app_config.REDDIT_CLIENT_SECRET
        
        # Mode 1: Try Reddit OAuth API if client credentials are provided
        if client_id and client_secret:
            token = self._get_oauth_token(client_id, client_secret)
            if token:
                url = f"https://oauth.reddit.com/r/{subreddit}/new"
                oauth_headers = {
                    "User-Agent": "pc:jenny-os-lead-hunter:v1.0.0 (by /u/jenny_os_bot)",
                    "Authorization": f"Bearer {token}"
                }
                
                with RedditConnector._lock:
                    # Enforce a 1.0s delay since the last request to be safe with OAuth limits
                    now = time.time()
                    elapsed = now - RedditConnector._last_request_time
                    if elapsed < 1.0:
                        time.sleep(1.0 - elapsed)
                    
                    try:
                        response = httpx.get(url, headers=oauth_headers, params={"limit": limit}, timeout=10.0)
                        if response.status_code == 200:
                            data = response.json()
                            posts = data.get("data", {}).get("children", [])
                            
                            raw_leads = []
                            for post in posts:
                                post_data = post.get("data", {})
                                post_id = post_data.get("name") or post_data.get("id")
                                if not post_id:
                                    continue
                                
                                title = post_data.get("title", "")
                                body = post_data.get("selftext", "")
                                permalink = post_data.get("permalink", "")
                                url_path = f"https://reddit.com{permalink}" if permalink else f"https://reddit.com/comments/{post_data.get('id')}"
                                
                                raw_leads.append(RawLead(
                                    source_id="",
                                    source_post_id=post_id,
                                    source_url=url_path,
                                    title=title,
                                    body=body,
                                    author=post_data.get("author", "[unknown]"),
                                    score=post_data.get("score", 0),
                                    raw_text=f"Title: {title}\n\n{body}"
                                ))
                            return raw_leads
                        elif response.status_code == 404:
                            raise ValueError(f"Subreddit r/{subreddit} not found (404).")
                    except ValueError:
                        raise
                    except Exception as e:
                        logger = logging.getLogger("reddit_connector")
                        logger.warning(f"OAuth fetch failed, falling back: {e}")
                    finally:
                        RedditConnector._last_request_time = time.time()

        # Mode 2: Try RSS2JSON API bridge to bypass local IP rate limits
        rss_url = f"https://www.reddit.com/r/{subreddit}/new/.rss"
        bridge_url = f"https://api.rss2json.com/v1/api.json?rss_url={rss_url}"
        try:
            with RedditConnector._lock:
                now = time.time()
                elapsed = now - RedditConnector._last_request_time
                if elapsed < 0.5:
                    time.sleep(0.5 - elapsed)
                
                try:
                    response = httpx.get(bridge_url, timeout=10.0)
                    if response.status_code == 200:
                        data = response.json()
                        if data.get("status") == "ok":
                            items = data.get("items", [])
                            raw_leads = []
                            for item in items[:limit]:
                                title = item.get("title", "")
                                link = item.get("link", "")
                                
                                post_id = ""
                                post_id_match = re.search(r'/comments/([a-z0-9]+)/', link)
                                if post_id_match:
                                    post_id = f"t3_{post_id_match.group(1)}"
                                else:
                                    guid = item.get("guid", "")
                                    post_id_match = re.search(r'/comments/([a-z0-9]+)/', guid)
                                    if post_id_match:
                                        post_id = f"t3_{post_id_match.group(1)}"
                                
                                author = item.get("author", "unknown").replace("/u/", "")
                                content_html = item.get("content", "")
                                clean_body = re.sub(r'<[^>]+>', '', content_html)
                                clean_body = html.unescape(clean_body)
                                
                                raw_leads.append(RawLead(
                                    source_id="",
                                    source_post_id=post_id or f"rss2json_{hash(link)}",
                                    source_url=link,
                                    title=title,
                                    body=clean_body,
                                    author=author,
                                    score=0,
                                    raw_text=f"Title: {title}\n\n{clean_body}"
                                ))
                            if raw_leads:
                                return raw_leads
                finally:
                    RedditConnector._last_request_time = time.time()
        except Exception as bridge_err:
            logger = logging.getLogger("reddit_connector")
            logger.warning(f"RSS2JSON bridge fetch failed, falling back to direct public endpoints: {bridge_err}")

        headers = {
            "User-Agent": "pc:jenny-os-lead-hunter:v1.0.0 (by /u/jenny_os_bot)"
        }

        # Mode 3: Public RSS Feed (Atom XML) fallback
        with RedditConnector._lock:
            # Enforce a 2.0s delay since the last request to prevent concurrent rate-limiting
            now = time.time()
            elapsed = now - RedditConnector._last_request_time
            if elapsed < 2.0:
                time.sleep(2.0 - elapsed)
            
            try:
                rss_urls = [
                    f"https://www.reddit.com/r/{subreddit}/new.rss",
                    f"https://old.reddit.com/r/{subreddit}/new/.rss"
                ]
                
                rss_success = False
                rss_leads = []
                rss_status = None
                
                for url_rss in rss_urls:
                    for attempt in range(3):
                        try:
                            response = httpx.get(url_rss, headers=headers, params={"limit": limit}, timeout=10.0, follow_redirects=True)
                            rss_status = response.status_code
                            if response.status_code == 200:
                                root = ET.fromstring(response.text)
                                ns = {'atom': 'http://www.w3.org/2005/Atom'}
                                entries = root.findall('atom:entry', ns)
                                
                                for entry in entries[:limit]:
                                    entry_id_elem = entry.find('atom:id', ns)
                                    entry_id = entry_id_elem.text if entry_id_elem is not None else ""
                                    post_id = entry_id.split('/')[-1] if entry_id else ""
                                    if post_id and not post_id.startswith("t3_"):
                                        post_id = f"t3_{post_id}"
                                        
                                    title_elem = entry.find('atom:title', ns)
                                    title = title_elem.text if title_elem is not None else ""
                                    
                                    link_elem = entry.find('atom:link', ns)
                                    url_path = link_elem.attrib.get('href') if link_elem is not None else ""
                                    
                                    author_elem = entry.find('atom:author', ns)
                                    author_name = "unknown"
                                    if author_elem is not None:
                                        name_elem = author_elem.find('atom:name', ns)
                                        if name_elem is not None and name_elem.text:
                                            author_name = name_elem.text.replace("/u/", "")
                                            
                                    content_elem = entry.find('atom:content', ns)
                                    content_html = content_elem.text if content_elem is not None else ""
                                    clean_text = re.sub(r'<[^>]+>', '', content_html)
                                    clean_text = html.unescape(clean_text)
                                    
                                    rss_leads.append(RawLead(
                                        source_id="",
                                        source_post_id=post_id,
                                        source_url=url_path,
                                        title=title,
                                        body=clean_text,
                                        author=author_name,
                                        score=0,
                                        raw_text=f"Title: {title}\n\n{clean_text}"
                                    ))
                                rss_success = True
                                break
                            elif response.status_code == 404:
                                raise ValueError(f"Subreddit r/{subreddit} not found (404).")
                            elif response.status_code == 429:
                                if attempt < 2:
                                    time.sleep(2.0 * (attempt + 1))
                                    continue
                        except ValueError:
                            raise
                        except Exception as e:
                            if isinstance(e, ET.ParseError):
                                break
                            if rss_status == 429:
                                if attempt < 2:
                                    time.sleep(2.0 * (attempt + 1))
                                    continue
                            if attempt < 2:
                                time.sleep(1.0)
                                continue
                            break
                    
                    if rss_success:
                        return rss_leads

                # Mode 4: Fallback to JSON API
                url_json = f"https://www.reddit.com/r/{subreddit}/new.json"
                try:
                    response = httpx.get(url_json, headers=headers, params={"limit": limit}, timeout=10.0, follow_redirects=True)
                    if response.status_code == 404:
                        raise ValueError(f"Subreddit r/{subreddit} not found (404).")
                    elif response.status_code == 429:
                        raise Exception("Reddit API returned 429 Too Many Requests (JSON). Try again later.")
                    elif response.status_code == 403:
                        raise Exception("Reddit API returned 403 Forbidden (JSON). Public feeds are restricted on this host.")
                    response.raise_for_status()
                    
                    data = response.json()
                    posts = data.get("data", {}).get("children", [])
                    
                    raw_leads = []
                    for post in posts:
                        post_data = post.get("data", {})
                        post_id = post_data.get("name") or post_data.get("id")
                        if not post_id:
                            continue
                        
                        title = post_data.get("title", "")
                        body = post_data.get("selftext", "")
                        permalink = post_data.get("permalink", "")
                        url_path = f"https://reddit.com{permalink}" if permalink else f"https://reddit.com/comments/{post_data.get('id')}"
                        
                        raw_leads.append(RawLead(
                            source_id="",
                            source_post_id=post_id,
                            source_url=url_path,
                            title=title,
                            body=body,
                            author=post_data.get("author", "[unknown]"),
                            score=post_data.get("score", 0),
                            raw_text=f"Title: {title}\n\n{body}"
                        ))
                    return raw_leads
                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 429:
                        raise RuntimeError("Reddit rate limit exceeded (429). Please wait a minute or configure Reddit API credentials in Settings.")
                    raise Exception(f"HTTP error fetching from Reddit: {e.response.status_code}")
                except Exception as e:
                    if "Subreddit" in str(e) or "required" in str(e) or "rate limit" in str(e):
                        raise
                    raise Exception(f"Failed to fetch from Reddit (RSS and JSON both failed): {str(e)}")
            finally:
                RedditConnector._last_request_time = time.time()

    def validate_subreddit(self, subreddit: str) -> bool:
        """Lightweight check to verify if a public subreddit exists.
        Tolerant to 429 (Too Many Requests) and 403 (Forbidden) rate-limiting blocks.
        """
        if not subreddit:
            return False
        
        client_id = app_config.REDDIT_CLIENT_ID
        client_secret = app_config.REDDIT_CLIENT_SECRET
        
        if client_id and client_secret:
            token = self._get_oauth_token(client_id, client_secret)
            if token:
                url = f"https://oauth.reddit.com/r/{subreddit}/about"
                oauth_headers = {
                    "User-Agent": "pc:jenny-os-lead-hunter:v1.0.0 (by /u/jenny_os_bot)",
                    "Authorization": f"Bearer {token}"
                }
                with RedditConnector._lock:
                    now = time.time()
                    elapsed = now - RedditConnector._last_request_time
                    if elapsed < 1.0:
                        time.sleep(1.0 - elapsed)
                    try:
                        response = httpx.get(url, headers=oauth_headers, timeout=5.0)
                        if response.status_code == 200:
                            data = response.json()
                            if data.get("data", {}).get("subreddit_type") == "private":
                                return False
                            return True
                        elif response.status_code == 404:
                            return False
                        elif response.status_code in [403, 429]:
                            return True
                    except Exception:
                        pass
                    finally:
                        RedditConnector._last_request_time = time.time()

        headers = {
            "User-Agent": "pc:jenny-os-lead-hunter:v1.0.0 (by /u/jenny_os_bot)"
        }

        with RedditConnector._lock:
            # Enforce a 2.0s delay since the last request to prevent concurrent rate-limiting
            now = time.time()
            elapsed = now - RedditConnector._last_request_time
            if elapsed < 2.0:
                time.sleep(2.0 - elapsed)
            
            try:
                # 1. Try RSS feed first (more permissive CDN rules)
                url_rss = f"https://www.reddit.com/r/{subreddit}/new.rss"
                try:
                    response = httpx.get(url_rss, headers=headers, timeout=5.0, follow_redirects=True)
                    if response.status_code == 200:
                        return True
                    elif response.status_code == 404:
                        return False
                    elif response.status_code in [403, 429]:
                        return True
                except Exception:
                    pass
                    
                # 2. Try JSON fallback
                url_json = f"https://www.reddit.com/r/{subreddit}/about.json"
                try:
                    response = httpx.get(url_json, headers=headers, timeout=5.0, follow_redirects=True)
                    if response.status_code == 200:
                        data = response.json()
                        if data.get("data", {}).get("subreddit_type") == "private":
                            return False
                        return True
                    elif response.status_code == 404:
                        return False
                    elif response.status_code in [403, 429]:
                        return True
                except Exception:
                    pass

                # If both timed out or failed to connect, we still return True to not block the user's config
                return True
            finally:
                RedditConnector._last_request_time = time.time()
