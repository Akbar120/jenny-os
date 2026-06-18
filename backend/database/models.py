import datetime
import uuid
from sqlalchemy import Column, String, Integer, Float, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class Mission(Base):
    __tablename__ = "missions"

    id = Column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    mission_name = Column(String, nullable=False)
    target_service = Column(String, nullable=False)
    keywords = Column(String, nullable=False)  # stored as JSON string of list[str]
    score_threshold = Column(Integer, nullable=False, default=7)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(
        String,
        nullable=False,
        default=lambda: datetime.datetime.utcnow().isoformat()
    )

class Lead(Base):
    __tablename__ = "leads"
    __table_args__ = (
        UniqueConstraint("mission_id", "content_hash", name="uq_lead_mission_hash"),
        UniqueConstraint("mission_id", "source_post_id", name="uq_lead_mission_post"),
    )

    id = Column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    content_hash = Column(String, nullable=False)
    raw_content = Column(String, nullable=False)
    intent = Column(String, nullable=False)
    service_required = Column(String, nullable=True)
    platform = Column(String, nullable=True)
    lead_score = Column(Integer, nullable=False)
    lead_quality = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    reasoning = Column(String, nullable=False)  # stored as json.dumps(list[str])
    status = Column(String, nullable=False, default="NEW")
    created_at = Column(
        String,
        nullable=False,
        default=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
    )

    # New fields
    mission_id = Column(String, ForeignKey("missions.id"), nullable=True)
    target_service = Column(String, nullable=True)
    service_match = Column(Boolean, nullable=True, default=False)
    relevance_score = Column(Integer, nullable=True, default=0)
    source_post_id = Column(String, nullable=True)
    source_url = Column(String, nullable=True)

class Source(Base):
    __tablename__ = "sources"

    id = Column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    mission_id = Column(String, ForeignKey("missions.id"), nullable=False)
    source_type = Column(String, nullable=False, default="reddit")
    config = Column(String, nullable=False)  # stored as JSON string
    is_active = Column(Boolean, nullable=False, default=True)
    last_synced_at = Column(String, nullable=True)
    last_sync_status = Column(String, nullable=True)  # "SUCCESS", "FAILED"
    last_error = Column(String, nullable=True)
    sync_count = Column(Integer, nullable=False, default=0)
    created_at = Column(
        String,
        nullable=False,
        default=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
    )

class Log(Base):
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(
        String,
        nullable=False,
        default=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
    )
    event = Column(String, nullable=False)
    lead_id = Column(String, ForeignKey("leads.id"), nullable=True)
    details = Column(String, nullable=False)  # stored as json.dumps({...})
