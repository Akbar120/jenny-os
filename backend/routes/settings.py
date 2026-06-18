import json
from fastapi import APIRouter
from backend.schemas.settings import SettingsPayload
from backend.config import SETTINGS_FILE, get_settings

router = APIRouter(prefix="/api")

@router.get("/settings", response_model=SettingsPayload)
def get_current_settings():
    settings = get_settings()
    return SettingsPayload(
        ai_provider=settings.get("ai_provider", "ollama"),
        model_name=settings.get("model_name", "gemma3:4b"),
        ai_api_key=settings.get("ai_api_key", ""),
        ollama_url=settings.get("ollama_url", "http://localhost:11434"),
        score_threshold=settings.get("score_threshold", 7),
        reddit_client_id=settings.get("reddit_client_id"),
        reddit_client_secret=settings.get("reddit_client_secret"),
    )

@router.patch("/settings", response_model=SettingsPayload)
def update_settings(payload: SettingsPayload):
    new_data = {
        "ai_provider": payload.ai_provider,
        "model_name": payload.model_name,
        "ai_api_key": payload.ai_api_key or "",
        "ollama_url": payload.ollama_url or "http://localhost:11434",
        "score_threshold": payload.score_threshold,
        "reddit_client_id": payload.reddit_client_id,
        "reddit_client_secret": payload.reddit_client_secret,
    }
    with open(SETTINGS_FILE, "w") as f:
        json.dump(new_data, f, indent=2)
    return payload
