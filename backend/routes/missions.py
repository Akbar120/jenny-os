from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database.engine import get_db
from backend.schemas.mission import MissionCreate, MissionUpdate, MissionResponse
from backend.services import mission_service
from backend.services import log_service

router = APIRouter(prefix="/api/missions", tags=["Missions"])

@router.post("", response_model=MissionResponse, status_code=status.HTTP_201_CREATED)
def create_mission(payload: MissionCreate, db: Session = Depends(get_db)):
    try:
        new_mission = mission_service.create_mission(db, payload)
        # Log event
        log_service.create_log(
            db=db,
            event="MISSION_CREATED",
            lead_id=None,
            details={"mission_id": new_mission.id, "mission_name": new_mission.mission_name}
        )
        return new_mission
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create mission: {str(e)}"
        )

@router.get("", response_model=list[MissionResponse])
def list_missions(db: Session = Depends(get_db)):
    return mission_service.get_missions(db)

@router.patch("/{mission_id}", response_model=MissionResponse)
def update_mission(mission_id: str, payload: MissionUpdate, db: Session = Depends(get_db)):
    mission = mission_service.get_mission_by_id(db, mission_id)
    if not mission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission not found."
        )
    
    updated_mission = mission_service.update_mission(db, mission_id, payload)
    
    # Log event
    log_service.create_log(
        db=db,
        event="MISSION_UPDATED",
        lead_id=None,
        details={"mission_id": mission_id, "updates": payload.model_dump(exclude_unset=True)}
    )
    return updated_mission

@router.get("/{mission_id}/performance")
def get_mission_performance(mission_id: str, db: Session = Depends(get_db)):
    """Returns performance statistics for a given mission."""
    result = mission_service.get_mission_performance(db, mission_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission not found."
        )
    return result

from backend.services import intelligence_service

@router.get("/suggest")
def suggest_mission_details(target_service: str, db: Session = Depends(get_db)):
    """Dynamically expands keywords and discovers relevant communities from the registry."""
    if not target_service.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target service query parameter is required."
        )
    try:
        keywords, used_fallback = intelligence_service.generate_keywords(target_service)
        communities = intelligence_service.discover_communities(target_service, keywords)
        return {
            "keywords": keywords,
            "used_fallback": used_fallback,
            "communities": communities
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate campaign suggestions: {str(e)}"
        )

