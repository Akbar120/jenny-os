from pydantic import BaseModel, Field
from typing import Literal

class LeadHunterOutput(BaseModel):
    intent: Literal["hire", "opinion", "promotion", "other"]
    service_required: str | None = None
    platform: str | None = None
    lead_score: int = Field(ge=0, le=10)
    lead_quality: Literal["low", "medium", "high"]
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: list[str]
