from pydantic import BaseModel, Field
from typing import Literal

# All supported AI providers
AI_PROVIDERS = Literal["ollama", "openai", "openrouter", "anthropic", "google"]

class SettingsPayload(BaseModel):
    # AI Brain configuration
    ai_provider: AI_PROVIDERS = "ollama"
    model_name: str
    ai_api_key: str | None = None       # API key for cloud providers (blank for Ollama)
    ollama_url: str | None = None       # Only needed for Ollama

    # Lead scoring
    score_threshold: int = Field(ge=0, le=10)

    # Reddit API credentials
    reddit_client_id: str | None = None
    reddit_client_secret: str | None = None
