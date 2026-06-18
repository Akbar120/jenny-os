import pytest
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database.models import Base, Mission, Lead
from backend.services import mission_service, lead_service
from backend.schemas.mission import MissionCreate
from backend.agents.lead_hunter.agent import MissionBasedLeadHunter
from backend.agents.lead_hunter.schemas.output import LeadHunterOutput

# In-memory SQLite for testing mission features
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

def test_mission_service_crud(db_session):
    # 1. Create Mission
    mission_in = MissionCreate(
        mission_name="AI Automation leads",
        target_service="AI Automation",
        keywords=["automation", "n8n", "zapier", "workflow"],
        score_threshold=5
    )
    mission = mission_service.create_mission(db_session, mission_in)
    
    assert mission.id is not None
    assert mission.mission_name == "AI Automation leads"
    assert mission.score_threshold == 5
    
    # 2. Get Missions
    missions = mission_service.get_missions(db_session)
    assert len(missions) == 1
    assert missions[0].id == mission.id
    
    # 3. Get Mission By ID
    retrieved = mission_service.get_mission_by_id(db_session, mission.id)
    assert retrieved is not None
    assert retrieved.mission_name == "AI Automation leads"

def test_mission_based_lead_hunter():
    agent = MissionBasedLeadHunter()
    keywords = ["character artist", "metahuman", "stylized character", "3d artist"]
    
    # Case 1: 0 keywords matched
    res0 = agent.analyze("I need a video editor for youtube.", keywords=keywords)
    assert res0["relevance_score"] == 0
    assert res0["service_match"] is False
    assert res0["intent"] == "hire"  # contains hiring indicator 'need'
    
    # Case 2: 1 keyword matched
    res1 = agent.analyze("Looking for a 3d artist.", keywords=keywords)
    assert res1["relevance_score"] == 3
    assert res1["service_match"] is True
    assert res1["intent"] == "hire"
    
    # Case 3: 2 keywords matched
    res2 = agent.analyze("Need a 3d artist who specializes in character artist designs.", keywords=keywords)
    assert res2["relevance_score"] == 5
    assert res2["service_match"] is True
    assert res2["intent"] == "hire"
    
    # Case 4: 3+ keywords matched
    res3 = agent.analyze("We are hiring a stylized character designer. Must be a 3d artist and metahuman expert.", keywords=keywords)
    assert res3["relevance_score"] == 8
    assert res3["service_match"] is True
    assert res3["intent"] == "hire"

def test_lead_service_with_mission(db_session):
    # Create a mission
    mission_in = MissionCreate(
        mission_name="3D Artist leads",
        target_service="3D Character Artist",
        keywords=["character", "3d artist", "metahuman"],
        score_threshold=5
    )
    mission = mission_service.create_mission(db_session, mission_in)
    
    # Create a lead under this mission
    hunter_output = LeadHunterOutput(
        intent="hire",
        service_required="artist",
        platform="UEFN",
        lead_score=8,
        lead_quality="high",
        confidence=0.9,
        reasoning=["matched keywords"]
    )
    
    lead = lead_service.create_lead(
        db=db_session,
        data=hunter_output,
        raw_content="Need a 3d artist for metahuman characters",
        content_hash="hash123",
        status="QUALIFIED",
        mission_id=mission.id,
        target_service=mission.target_service,
        service_match=True,
        relevance_score=5
    )
    
    assert lead.mission_id == mission.id
    assert lead.target_service == "3D Character Artist"
    assert lead.relevance_score == 5
    assert lead.service_match is True
    
    # Query leads by mission
    leads = lead_service.get_leads(db_session, mission_id=mission.id)
    assert len(leads) == 1
    assert leads[0].id == lead.id
    
    # Query stats by mission
    stats = lead_service.get_stats(db_session, mission_id=mission.id)
    assert stats["total"] == 1
    assert stats["qualified"] == 1
    
    # Query stats for different mission should be 0
    stats_other = lead_service.get_stats(db_session, mission_id="some-other-uuid")
    assert stats_other["total"] == 0
