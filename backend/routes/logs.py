from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.database.engine import get_db
from backend.schemas.log import LogResponse
from backend.services import log_service

router = APIRouter(prefix="/api")

@router.get("/logs", response_model=list[LogResponse])
def list_logs(limit: int = 100, offset: int = 0, db: Session = Depends(get_db)):
    return log_service.get_logs(db, limit=limit, offset=offset)
