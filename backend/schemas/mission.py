from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
import json

class InitialSource(BaseModel):
    platform: str
    name: str
    url: Optional[str] = None

class MissionCreate(BaseModel):
    mission_name: str = Field(..., min_length=1)
    target_service: str = Field(..., min_length=1)
    keywords: List[str] = Field(..., min_length=1)
    score_threshold: int = Field(default=7, ge=0, le=10)
    initial_sources: Optional[List[InitialSource]] = None

class MissionUpdate(BaseModel):
    mission_name: Optional[str] = Field(default=None, min_length=1)
    target_service: Optional[str] = Field(default=None, min_length=1)
    keywords: Optional[List[str]] = Field(default=None, min_length=1)
    score_threshold: Optional[int] = Field(default=None, ge=0, le=10)
    is_active: Optional[bool] = None

class MissionResponse(BaseModel):
    id: str
    mission_name: str
    target_service: str
    keywords: List[str]
    score_threshold: int
    is_active: bool
    created_at: str

    model_config = {
        "from_attributes": True
    }

    @field_validator("keywords", mode="before")
    @classmethod
    def parse_keywords(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return [k.strip() for k in v.split(",") if k.strip()]
        return v
