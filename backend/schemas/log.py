from pydantic import BaseModel, field_validator
from typing import Optional, Union, Any
import json

class LogResponse(BaseModel):
    id: int
    timestamp: str
    event: str
    lead_id: Optional[str] = None
    details: Union[str, dict, list, Any]

    model_config = {
        "from_attributes": True
    }

    @field_validator("details", mode="before")
    @classmethod
    def parse_details(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return v
        return v
