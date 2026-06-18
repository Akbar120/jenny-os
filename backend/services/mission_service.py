import json
from sqlalchemy.orm import Session
from backend.database.models import Mission, Lead
from backend.schemas.mission import MissionCreate, MissionUpdate

def create_mission(db: Session, data: MissionCreate) -> Mission:
    """Creates a new mission, serializing keywords list to JSON string, and binds initial sources."""
    mission = Mission(
        mission_name=data.mission_name,
        target_service=data.target_service,
        keywords=json.dumps(data.keywords),
        score_threshold=data.score_threshold
    )
    db.add(mission)
    db.commit()
    db.refresh(mission)
    
    # Auto-instantiate approved initial sources
    if data.initial_sources:
        from backend.database.models import Source
        import uuid
        for src in data.initial_sources:
            config_dict = {}
            if src.platform == "reddit":
                config_dict = {"subreddit": src.name, "limit": 25}
            else:
                config_dict = {"name": src.name, "url": src.url}
                
            source_entry = Source(
                id=str(uuid.uuid4()),
                mission_id=mission.id,
                source_type=src.platform,
                config=json.dumps(config_dict),
                is_active=True,
                sync_count=0
            )
            db.add(source_entry)
        db.commit()
        
    return mission

def get_missions(db: Session) -> list[Mission]:
    """Retrieves all missions."""
    return db.query(Mission).all()

def get_mission_by_id(db: Session, mission_id: str) -> Mission | None:
    """Retrieves a single mission by ID."""
    return db.query(Mission).filter(Mission.id == mission_id).first()

def update_mission(db: Session, mission_id: str, data: MissionUpdate) -> Mission | None:
    """Updates an existing mission, parsing and saving keywords if provided."""
    mission = get_mission_by_id(db, mission_id)
    if not mission:
        return None
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "keywords" and value is not None:
            setattr(mission, key, json.dumps(value))
        elif value is not None:
            setattr(mission, key, value)
            
    db.commit()
    db.refresh(mission)
    return mission

def get_mission_performance(db: Session, mission_id: str) -> dict:
    """Computes performance stats for a mission: totals, qualification rate, and top matched keywords."""
    mission = get_mission_by_id(db, mission_id)
    if not mission:
        return None

    leads = db.query(Lead).filter(Lead.mission_id == mission_id).all()
    total = len(leads)
    qualified = sum(1 for l in leads if l.status == "QUALIFIED")
    disqualified = sum(1 for l in leads if l.status == "DISQUALIFIED")
    rate = round((qualified / total * 100), 1) if total > 0 else 0.0

    # Count keyword frequency across lead raw_content
    try:
        keywords = json.loads(mission.keywords) if isinstance(mission.keywords, str) else mission.keywords
    except Exception:
        keywords = []

    keyword_counts: dict[str, int] = {}
    for kw in keywords:
        kw_lower = kw.lower()
        count = sum(1 for l in leads if kw_lower in l.raw_content.lower())
        if count > 0:
            keyword_counts[kw] = count

    # Return top 5 by hit count
    top_keywords = sorted(keyword_counts, key=lambda k: keyword_counts[k], reverse=True)[:5]

    # Count total active sources for this mission
    from backend.database.models import Source
    total_sources = db.query(Source).filter(
        Source.mission_id == mission_id,
        Source.is_active == True
    ).count()

    return {
        "mission_id": mission_id,
        "total_leads": total,
        "qualified_leads": qualified,
        "disqualified_leads": disqualified,
        "qualification_rate": rate,
        "top_keywords": top_keywords,
        "total_sources": total_sources,
    }

