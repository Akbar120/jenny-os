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
            "ollama_url": "http://localhost:11434",
            "model_name": "gemma3:4b",
            "score_threshold": 7
        }

def __getattr__(name: str) -> Any:
    """Supports dynamic lookup of settings like OLLAMA_URL, MODEL_NAME, SCORE_THRESHOLD."""
    settings = get_settings()
    if name == "OLLAMA_URL":
        return settings.get("ollama_url", "http://localhost:11434")
    elif name == "MODEL_NAME":
        return settings.get("model_name", "gemma3:4b")
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
