import json
from sqlalchemy.orm import Session
from backend.database.models import Lead
from backend.agents.lead_hunter.schemas.output import LeadHunterOutput

def create_lead(
    db: Session,
    data: LeadHunterOutput,
    raw_content: str,
    content_hash: str,
    status: str,
    mission_id: str,
    target_service: str,
    service_match: bool,
    relevance_score: int
) -> Lead:
    """Creates a new lead entry. Serializes reasoning to JSON string before saving."""
    lead_entry = Lead(
        content_hash=content_hash,
        raw_content=raw_content,
        intent=data.intent,
        service_required=data.service_required,
        platform=data.platform,
        lead_score=data.lead_score,
        lead_quality=data.lead_quality,
        confidence=data.confidence,
        reasoning=json.dumps(data.reasoning),
        status=status,
        mission_id=mission_id,
        target_service=target_service,
        service_match=service_match,
        relevance_score=relevance_score
    )
    db.add(lead_entry)
    db.commit()
    db.refresh(lead_entry)
    
    # Detach from session to modify in-memory safely without writing back to DB
    db.expunge(lead_entry)
    if isinstance(lead_entry.reasoning, str):
        try:
            lead_entry.reasoning = json.loads(lead_entry.reasoning)
        except Exception:
            pass
    return lead_entry

def get_leads(db: Session, limit: int = 50, offset: int = 0, mission_id: str | None = None) -> list[Lead]:
    """Retrieves all leads, parsing reasoning back to list of strings, optionally filtering by mission_id."""
    query = db.query(Lead)
    if mission_id:
        query = query.filter(Lead.mission_id == mission_id)
    rows = query.offset(offset).limit(limit).all()
    for row in rows:
        db.expunge(row)
        if isinstance(row.reasoning, str):
            try:
                row.reasoning = json.loads(row.reasoning)
            except Exception:
                pass
    return rows

def get_lead_by_id(db: Session, lead_id: str) -> Lead | None:
    """Retrieves a single lead by ID, parsing reasoning back to list of strings."""
    row = db.query(Lead).filter(Lead.id == lead_id).first()
    if row:
        db.expunge(row)
        if isinstance(row.reasoning, str):
            try:
                row.reasoning = json.loads(row.reasoning)
            except Exception:
                pass
        return row
    return None

def get_stats(db: Session, mission_id: str | None = None) -> dict:
    """Retrieves stats counts for total, qualified, and rejected leads, optionally filtered by mission_id."""
    query = db.query(Lead)
    if mission_id:
        query = query.filter(Lead.mission_id == mission_id)
        
    total = query.count()
    qualified = query.filter(Lead.status == "QUALIFIED").count()
    rejected = query.filter(Lead.status == "DISQUALIFIED").count()
    return {
        "total": total,
        "qualified": qualified,
        "rejected": rejected
    }

