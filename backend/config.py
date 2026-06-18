import json
from pathlib import Path
from typing import Dict, Any

SETTINGS_FILE = Path(__file__).parent / "settings.json"

def get_settings() -> Dict[str, Any]:
    """Reads settings dynamically from settings.json."""
    try:
        with open(SETTINGS_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {
            "ai_provider": "ollama",
            "ollama_url": "http://localhost:11434",
            "model_name": "gemma3:4b",
            "ai_api_key": "",
            "score_threshold": 7,
        }

def __getattr__(name: str) -> Any:
    """Supports dynamic lookup: config.OLLAMA_URL, config.MODEL_NAME, etc."""
    settings = get_settings()
    if name == "OLLAMA_URL":
        return settings.get("ollama_url", "http://localhost:11434")
    elif name == "MODEL_NAME":
        return settings.get("model_name", "gemma3:4b")
    elif name == "AI_PROVIDER":
        return settings.get("ai_provider", "ollama")
    elif name == "AI_API_KEY":
        return settings.get("ai_api_key", "")
    elif name == "SCORE_THRESHOLD":
        try:
            return int(settings.get("score_threshold", 7))
        except (ValueError, TypeError):
            return 7
    elif name == "REDDIT_CLIENT_ID":
        return settings.get("reddit_client_id")
    elif name == "REDDIT_CLIENT_SECRET":
        return settings.get("reddit_client_secret")
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")
