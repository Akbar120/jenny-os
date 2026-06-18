import hashlib
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database.engine import get_db
from backend import config
from backend.schemas.lead import AnalyzeRequest, LeadResponse
from backend.services import lead_service, log_service
from backend.agents.lead_hunter.agent import MissionBasedLeadHunter
from backend.agents.lead_hunter.schemas.output import LeadHunterOutput
from backend.database.models import Lead, Mission
from pydantic import ValidationError
import json

router = APIRouter(prefix="/api")

@router.post("/analyze", response_model=LeadResponse)
def analyze_lead(payload: AnalyzeRequest, db: Session = Depends(get_db)):
    raw_content = payload.content.strip()
    if len(raw_content) <= 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Content must be longer than 10 characters."
        )

    # 1. Fetch the Active Mission
    mission = db.query(Mission).filter(Mission.id == payload.mission_id).first()
    if not mission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mission with ID {payload.mission_id} not found."
        )

    # Log receipt of lead
    log_service.create_log(
        db=db,
        event="LEAD_RECEIVED",
        lead_id=None,
        details={
            "raw_content": raw_content[:100] + "..." if len(raw_content) > 100 else raw_content,
            "mission_id": mission.id,
            "mission_name": mission.mission_name
        }
    )

    # Compute content hash for deduplication
    content_hash = hashlib.md5(raw_content.lower().encode("utf-8")).hexdigest()

    # 2. Check for duplicate lead UNDER THE SAME MISSION
    existing_lead = db.query(Lead).filter(
        Lead.content_hash == content_hash,
        Lead.mission_id == mission.id
    ).first()
    
    if existing_lead:
        # Log duplicate detected
        log_service.create_log(
            db=db,
            event="DUPLICATE_DETECTED",
            lead_id=existing_lead.id,
            details={"content_hash": content_hash, "mission_id": mission.id}
        )
        # Service layer expunges and parses reasoning
        db.expunge(existing_lead)
        if isinstance(existing_lead.reasoning, str):
            try:
                existing_lead.reasoning = json.loads(existing_lead.reasoning)
            except Exception:
                existing_lead.reasoning = [existing_lead.reasoning]
        return existing_lead

    # 3. Parse Mission Keywords
    keywords = []
    if mission.keywords:
        try:
            keywords = json.loads(mission.keywords)
            if isinstance(keywords, str):
                keywords = [k.strip() for k in keywords.split(",") if k.strip()]
        except Exception:
            keywords = [mission.keywords]

    # 4. Instantiate and run MissionBasedLeadHunter Agent
    agent = MissionBasedLeadHunter()
    try:
        agent_output = agent.analyze(raw_content, keywords=keywords)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent analysis failed: {str(e)}"
        )

    # 5. Pydantic Output Validation
    try:
        validated_output = LeadHunterOutput(**agent_output)
    except ValidationError as e:
        log_service.create_log(
            db=db,
            event="VALIDATION_ERROR",
            lead_id=None,
            details={"errors": e.errors(), "raw_agent_output": agent_output}
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Agent output validation failed: {str(e)}"
        )

    # 6. Determine Qualification Status
    # is_qualified = (intent == "hire" and relevance_score >= mission.score_threshold)
    relevance_score = agent_output.get("relevance_score", 0)
    service_match = agent_output.get("service_match", False)
    
    is_qualified = (
        validated_output.intent == "hire" and 
        relevance_score >= mission.score_threshold
    )
    lead_status = "QUALIFIED" if is_qualified else "DISQUALIFIED"
    log_event = "LEAD_QUALIFIED" if is_qualified else "LEAD_DISQUALIFIED"

    # 7. Create Lead Mapped to Mission
    new_lead = lead_service.create_lead(
        db=db,
        data=validated_output,
        raw_content=raw_content,
        content_hash=content_hash,
        status=lead_status,
        mission_id=mission.id,
        target_service=mission.target_service,
        service_match=service_match,
        relevance_score=relevance_score
    )

    # Log classification result
    log_service.create_log(
        db=db,
        event=log_event,
        lead_id=new_lead.id,
        details={
            "intent": validated_output.intent,
            "relevance_score": relevance_score,
            "score_threshold": mission.score_threshold,
            "mission_id": mission.id
        }
    )

    return new_lead

@router.get("/leads", response_model=list[LeadResponse])
def list_leads(limit: int = 50, offset: int = 0, mission_id: str | None = None, db: Session = Depends(get_db)):
    return lead_service.get_leads(db, limit=limit, offset=offset, mission_id=mission_id)

@router.get("/leads/{lead_id}", response_model=LeadResponse)
def get_lead(lead_id: str, db: Session = Depends(get_db)):
    lead = lead_service.get_lead_by_id(db, lead_id=lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found."
        )
    return lead

@router.get("/stats")
def get_lead_stats(mission_id: str | None = None, db: Session = Depends(get_db)):
    return lead_service.get_stats(db, mission_id=mission_id)
