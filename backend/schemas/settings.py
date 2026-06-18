from pydantic import BaseModel, Field

class SettingsPayload(BaseModel):
    ollama_url: str
    model_name: str
    score_threshold: int = Field(ge=0, le=10)
    reddit_client_id: str | None = None
    reddit_client_secret: str | None = None
