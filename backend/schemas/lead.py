from pydantic import BaseModel, Field, field_validator
from typing import Literal, List, Optional
import json

class AnalyzeRequest(BaseModel):
    content: str
    mission_id: str

class LeadResponse(BaseModel):
    id: str
    content_hash: str
    raw_content: str
    intent: Literal["hire", "opinion", "promotion", "other"]
    service_required: Optional[str] = None
    platform: Optional[str] = None
    lead_score: int = Field(ge=0, le=10)
    lead_quality: Literal["low", "medium", "high"]
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: List[str]
    status: Literal["NEW", "QUALIFIED", "DISQUALIFIED"]
    created_at: str
    
    # New fields
    mission_id: Optional[str] = None
    target_service: Optional[str] = None
    service_match: bool = False
    relevance_score: int = 0
    source_post_id: Optional[str] = None
    source_url: Optional[str] = None

    model_config = {
        "from_attributes": True
    }

    @field_validator("reasoning", mode="before")
    @classmethod
    def parse_reasoning(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return [v]
        return v

