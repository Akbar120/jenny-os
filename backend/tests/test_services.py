import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database.models import Base
from backend.services import lead_service, log_service
from backend.agents.lead_hunter.schemas.output import LeadHunterOutput

# In-memory SQLite for testing service layer
TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_create_and_get_lead(db_session):
    # Prepare dummy data matching LeadHunterOutput Pydantic model
    hunter_output = LeadHunterOutput(
        intent="hire",
        service_required="character_artist",
        platform="UEFN",
        lead_score=8,
        lead_quality="high",
        confidence=0.95,
        reasoning=["Test reasoning bullet 1", "Test reasoning bullet 2"]
    )
    
    raw_content = "Looking for a UEFN character artist to design a stylized game model. Budget is flexible."
    content_hash = "abcde12345"
    status = "QUALIFIED"

    # Create lead
    created = lead_service.create_lead(
        db=db_session,
        data=hunter_output,
        raw_content=raw_content,
        content_hash=content_hash,
        status=status,
        mission_id="dummy-mission-id",
        target_service="dummy-target-service",
        service_match=True,
        relevance_score=8
    )

    assert created.id is not None
    assert created.content_hash == content_hash
    assert created.intent == "hire"
    assert created.lead_score == 8
    # The return from create_lead should have parsed reasoning back into list of str
    assert isinstance(created.reasoning, list)
    assert "Test reasoning bullet 1" in created.reasoning

    # Get lead by ID
    retrieved = lead_service.get_lead_by_id(db_session, created.id)
    assert retrieved is not None
    assert retrieved.id == created.id
    assert isinstance(retrieved.reasoning, list)
    assert retrieved.reasoning[0] == "Test reasoning bullet 1"

    # Get leads list
    leads_list = lead_service.get_leads(db_session)
    assert len(leads_list) == 1
    assert leads_list[0].id == created.id

    # Get stats
    stats = lead_service.get_stats(db_session)
    assert stats["total"] == 1
    assert stats["qualified"] == 1
    assert stats["rejected"] == 0

def test_create_and_get_log(db_session):
    event = "LEAD_RECEIVED"
    lead_id = "some-uuid-12345"
    details = {"raw_content": "some content here..."}

    # Create log
    log = log_service.create_log(
        db=db_session,
        event=event,
        lead_id=lead_id,
        details=details
    )

    assert log.id is not None
    assert log.event == event
    assert log.lead_id == lead_id
    
    # Get logs
    logs = log_service.get_logs(db_session)
    assert len(logs) == 1
    assert logs[0].event == event
