import json
import datetime
import uuid
import hashlib
from sqlalchemy.orm import Session
from backend.database.models import Source, Mission, Lead
from backend.schemas.source import SourceCreate, SourceUpdate
from backend.connectors.reddit import RedditConnector
from backend.agents.lead_hunter.agent import MissionBasedLeadHunter
from backend.agents.lead_hunter.schemas.output import LeadHunterOutput
from backend.services import lead_service, log_service

def create_source(db: Session, data: SourceCreate) -> Source:
    """Creates a new source, validating that the target mission exists first."""
    mission = db.query(Mission).filter(Mission.id == data.mission_id).first()
    if not mission:
        raise ValueError(f"Mission with ID {data.mission_id} does not exist.")
    
    source = Source(
        id=str(uuid.uuid4()),
        mission_id=data.mission_id,
        source_type=data.source_type,
        config=json.dumps(data.config.model_dump()),
        is_active=True,
        sync_count=0
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return source

def get_sources(db: Session, mission_id: str | None = None) -> list[Source]:
    """Retrieves all sources, optionally filtered by mission_id."""
    query = db.query(Source)
    if mission_id:
        query = query.filter(Source.mission_id == mission_id)
    return query.all()

def get_source_by_id(db: Session, source_id: str) -> Source | None:
    """Retrieves a single source by ID."""
    return db.query(Source).filter(Source.id == source_id).first()

def update_source(db: Session, source_id: str, data: SourceUpdate) -> Source | None:
    """Updates configuration or toggle status of a source."""
    source = get_source_by_id(db, source_id)
    if not source:
        return None
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "config" and value is not None:
            source.config = json.dumps(value)
        elif value is not None:
            setattr(source, key, value)
            
    db.commit()
    db.refresh(source)
    return source

def sync_source(db: Session, source_id: str) -> dict:
    """Orchestrates fetching leads from external connector, qualifying them, and storing results."""
    source = get_source_by_id(db, source_id)
    if not source:
        raise ValueError(f"Source with ID {source_id} not found.")
    
    # 1. Fetch the Active Mission
    mission = db.query(Mission).filter(Mission.id == source.mission_id).first()
    if not mission:
        raise ValueError(f"Mission associated with source {source_id} not found.")
    
    # Check if mission or source is active
    if not mission.is_active:
        raise ValueError(f"Cannot sync: Mission '{mission.mission_name}' is inactive.")
    if not source.is_active:
        raise ValueError(f"Cannot sync: Source is inactive.")

    # 2. Parse source configuration
    try:
        config_dict = json.loads(source.config) if isinstance(source.config, str) else source.config
    except Exception:
        config_dict = {}

    added_count = 0
    skipped_count = 0
    errors = []

    # 3. Instantiate connector
    if source.source_type == "reddit":
        connector = RedditConnector()
    else:
        raise ValueError(f"Unsupported source type: {source.source_type}")

    # 4. Fetch raw leads
    raw_leads = []
    try:
        raw_leads = connector.fetch(config_dict)
    except Exception as e:
        error_msg = str(e)
        errors.append(error_msg)
        
        # Update source health status on fetch failure
        source.last_synced_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        source.last_sync_status = "FAILED"
        source.last_error = error_msg
        source.sync_count += 1
        db.commit()
        db.refresh(source)
        
        return {
            "added": 0,
            "skipped": 0,
            "errors": errors
        }

    # 5. Process raw leads
    agent = MissionBasedLeadHunter()
    
    # Parse Mission Keywords
    keywords = []
    if mission.keywords:
        try:
            keywords = json.loads(mission.keywords)
            if isinstance(keywords, str):
                keywords = [k.strip() for k in keywords.split(",") if k.strip()]
        except Exception:
            keywords = [mission.keywords]

    for raw_lead in raw_leads:
        try:
            # Check for duplicate lead UNDER THE SAME MISSION and SAME source_post_id
            existing_lead = db.query(Lead).filter(
                Lead.source_post_id == raw_lead.source_post_id,
                Lead.mission_id == mission.id
            ).first()
            
            if existing_lead:
                skipped_count += 1
                # Log duplicate detected
                log_service.create_log(
                    db=db,
                    event="DUPLICATE_DETECTED",
                    lead_id=existing_lead.id,
                    details={
                        "source_post_id": raw_lead.source_post_id,
                        "mission_id": mission.id,
                        "title": raw_lead.title[:50]
                    }
                )
                continue

            # Check for content hash duplicate under same mission
            content_hash = hashlib.md5(raw_lead.raw_text.lower().encode("utf-8")).hexdigest()
            existing_hash_lead = db.query(Lead).filter(
                Lead.content_hash == content_hash,
                Lead.mission_id == mission.id
            ).first()
            
            if existing_hash_lead:
                skipped_count += 1
                log_service.create_log(
                    db=db,
                    event="DUPLICATE_DETECTED",
                    lead_id=existing_hash_lead.id,
                    details={
                        "content_hash": content_hash,
                        "mission_id": mission.id,
                        "title": raw_lead.title[:50]
                    }
                )
                continue

            # Log receipt of raw lead
            log_service.create_log(
                db=db,
                event="LEAD_RECEIVED",
                lead_id=None,
                details={
                    "raw_content": raw_lead.raw_text[:100] + "..." if len(raw_lead.raw_text) > 100 else raw_lead.raw_text,
                    "mission_id": mission.id,
                    "source_post_id": raw_lead.source_post_id
                }
            )

            # Analyze lead using MissionBasedLeadHunter
            agent_output = agent.analyze(raw_lead.raw_text, keywords=keywords)
            
            # Pydantic Output Validation
            validated_output = LeadHunterOutput(**agent_output)

            # Determine Qualification Status
            relevance_score = agent_output.get("relevance_score", 0)
            service_match = agent_output.get("service_match", False)
            
            is_qualified = (
                validated_output.intent == "hire" and 
                relevance_score >= mission.score_threshold
            )
            lead_status = "QUALIFIED" if is_qualified else "DISQUALIFIED"
            log_event = "LEAD_QUALIFIED" if is_qualified else "LEAD_DISQUALIFIED"

            # Create Lead Mapped to Mission
            new_lead = lead_service.create_lead(
                db=db,
                data=validated_output,
                raw_content=raw_lead.raw_text,
                content_hash=content_hash,
                status=lead_status,
                mission_id=mission.id,
                target_service=mission.target_service,
                service_match=service_match,
                relevance_score=relevance_score
            )
            
            # Update Lead's source_post_id, platform, and source_url directly
            db_lead = db.query(Lead).filter(Lead.id == new_lead.id).first()
            if db_lead:
                db_lead.source_post_id = raw_lead.source_post_id
                db_lead.platform = "Reddit"
                db_lead.source_url = raw_lead.source_url
                db.commit()
                db.refresh(db_lead)

            # Log classification result
            log_service.create_log(
                db=db,
                event=log_event,
                lead_id=new_lead.id,
                details={
                    "intent": validated_output.intent,
                    "relevance_score": relevance_score,
                    "score_threshold": mission.score_threshold,
                    "mission_id": mission.id,
                    "source_post_id": raw_lead.source_post_id
                }
            )

            added_count += 1

        except Exception as item_err:
            errors.append(f"Failed to process post {raw_lead.source_post_id}: {str(item_err)}")

    # Update source sync metadata
    source.last_synced_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    source.sync_count += 1
    
    if len(errors) > 0 and added_count == 0:
        source.last_sync_status = "FAILED"
        source.last_error = "; ".join(errors[:3])
    else:
        source.last_sync_status = "SUCCESS"
        source.last_error = None
        
    db.commit()
    db.refresh(source)

    return {
        "added": added_count,
        "skipped": skipped_count,
        "errors": errors
    }
