from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database.engine import get_db
from backend.schemas.source import SourceCreate, SourceUpdate, SourceResponse, SyncResult
from backend.services import source_service, log_service
from backend.connectors.reddit import RedditConnector

router = APIRouter(prefix="/api/sources", tags=["Sources"])

@router.post("", response_model=SourceResponse, status_code=status.HTTP_201_CREATED)
def create_source(payload: SourceCreate, db: Session = Depends(get_db)):
    """Creates a new source, verifying that the target subreddit exists first."""
    if payload.source_type == "reddit":
        connector = RedditConnector()
        sub = payload.config.subreddit
        if not connector.validate_subreddit(sub):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Subreddit r/{sub} does not exist, is private, or requires authentication."
            )
            
    try:
        new_source = source_service.create_source(db, payload)
        # Log event
        log_service.create_log(
            db=db,
            event="SOURCE_CREATED",
            lead_id=None,
            details={
                "source_id": new_source.id, 
                "mission_id": new_source.mission_id,
                "source_type": new_source.source_type,
                "subreddit": payload.config.subreddit
            }
        )
        return new_source
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create source: {str(e)}"
        )

@router.get("", response_model=list[SourceResponse])
def list_sources(mission_id: str | None = None, db: Session = Depends(get_db)):
    """Lists all registered sources, with optional campaign filtering."""
    return source_service.get_sources(db, mission_id=mission_id)

@router.patch("/{source_id}", response_model=SourceResponse)
def update_source(source_id: str, payload: SourceUpdate, db: Session = Depends(get_db)):
    """Updates config limits or toggles active status for a source."""
    source = source_service.get_source_by_id(db, source_id)
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source not found."
        )
        
    # Validate subreddit if config is being updated
    if payload.config is not None and source.source_type == "reddit":
        connector = RedditConnector()
        sub = payload.config.subreddit
        if not connector.validate_subreddit(sub):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Subreddit r/{sub} does not exist, is private, or requires authentication."
            )
            
    updated_source = source_service.update_source(db, source_id, payload)
    
    # Log event
    log_service.create_log(
        db=db,
        event="SOURCE_UPDATED",
        lead_id=None,
        details={"source_id": source_id, "updates": payload.model_dump(exclude_unset=True)}
    )
    return updated_source

@router.post("/{source_id}/sync", response_model=SyncResult)
def sync_source(source_id: str, db: Session = Depends(get_db)):
    """Manually triggers synchronization logic for a source."""
    try:
        result = source_service.sync_source(db, source_id)
        # Log event
        log_service.create_log(
            db=db,
            event="SOURCE_SYNC_COMPLETED",
            lead_id=None,
            details={
                "source_id": source_id,
                "added": result["added"],
                "skipped": result["skipped"],
                "errors_count": len(result["errors"])
            }
        )
        return result
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Source synchronization failed: {str(e)}"
        )
