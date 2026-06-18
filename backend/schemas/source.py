from pydantic import BaseModel, Field, field_validator
from typing import Literal

class SourceConfig(BaseModel):
    subreddit: str = Field(..., min_length=1, max_length=50)
    limit: int = Field(25, ge=1, le=100)

class SourceCreate(BaseModel):
    mission_id: str
    source_type: Literal["reddit"] = "reddit"
    config: SourceConfig

class SourceUpdate(BaseModel):
    is_active: bool | None = None
    config: SourceConfig | None = None

class SourceResponse(BaseModel):
    id: str
    mission_id: str
    source_type: str
    config: SourceConfig
    is_active: bool
    last_synced_at: str | None = None
    last_sync_status: str | None = None
    last_error: str | None = None
    sync_count: int
    created_at: str

    class Config:
        from_attributes = True

    @field_validator("config", mode="before")
    @classmethod
    def parse_config(cls, v):
        import json
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return {"subreddit": "", "limit": 25}
        return v

class SyncResult(BaseModel):
    added: int
    skipped: int
    errors: list[str]
