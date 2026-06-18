import json
from sqlalchemy.orm import Session
from backend.database.models import Log

def create_log(db: Session, event: str, lead_id: str | None, details: dict) -> Log:
    """Creates a log entry in the database. Serializes details dict to JSON string."""
    log_entry = Log(
        event=event,
        lead_id=lead_id,
        details=json.dumps(details)
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    return log_entry

def get_logs(db: Session, limit: int = 100, offset: int = 0) -> list[Log]:
    """Retrieves list of logs with offset/limit pagination."""
    return db.query(Log).offset(offset).limit(limit).all()
