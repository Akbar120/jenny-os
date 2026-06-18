import pytest
import json
import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from backend.database.models import Base, Mission, Lead, Source
from backend.services import mission_service, source_service, lead_service
from backend.schemas.mission import MissionCreate
from backend.schemas.source import SourceCreate, SourceConfig, SourceUpdate
from backend.connectors.reddit import RedditConnector
from backend.main import app

from sqlalchemy.pool import StaticPool

# In-memory database for testing
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
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

@pytest.fixture
def client(db_session):
    # Override get_db dependency
    from backend.database.engine import get_db
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def test_source_service_crud_and_validation(db_session):
    # 1. Create a mission
    mission_in = MissionCreate(
        mission_name="Reddit Test Mission",
        target_service="3D Character Artist",
        keywords=["character", "unreal"],
        score_threshold=5
    )
    mission = mission_service.create_mission(db_session, mission_in)

    # 2. Create source
    source_in = SourceCreate(
        mission_id=mission.id,
        source_type="reddit",
        config=SourceConfig(subreddit="gamedev", limit=10)
    )
    source = source_service.create_source(db_session, source_in)

    assert source.id is not None
    assert source.mission_id == mission.id
    assert source.source_type == "reddit"
    assert "gamedev" in source.config
    assert source.is_active is True
    assert source.sync_count == 0

    # 3. Update source
    update_in = SourceUpdate(
        is_active=False,
        config=SourceConfig(subreddit="gamedev_updated", limit=15)
    )
    updated = source_service.update_source(db_session, source.id, update_in)
    assert updated.is_active is False
    assert "gamedev_updated" in updated.config

    # 4. Get sources
    sources = source_service.get_sources(db_session, mission_id=mission.id)
    assert len(sources) == 1
    assert sources[0].id == source.id

    # Test create source with invalid mission_id
    with pytest.raises(ValueError):
        invalid_source_in = SourceCreate(
            mission_id="nonexistent-id",
            source_type="reddit",
            config=SourceConfig(subreddit="gamedev", limit=10)
        )
        source_service.create_source(db_session, invalid_source_in)

def test_reddit_connector_fetch_mocked(monkeypatch):
    connector = RedditConnector()

    class MockResponse:
        status_code = 200
        def json(self):
            return {
                "data": {
                    "children": [
                        {
                            "data": {
                                "id": "post1",
                                "name": "t3_post1",
                                "title": "Looking for unreal character artist",
                                "selftext": "We need a 3D character artist for a UEFN project.",
                                "permalink": "/r/gamedev/comments/post1",
                                "author": "dev1",
                                "score": 10
                            }
                        }
                    ]
                }
            }
        def raise_for_status(self):
            pass

    def mock_get(url, *args, **kwargs):
        return MockResponse()

    monkeypatch.setattr(httpx, "get", mock_get)

    leads = connector.fetch({"subreddit": "gamedev", "limit": 1})
    assert len(leads) == 1
    assert leads[0].source_post_id == "t3_post1"
    assert leads[0].title == "Looking for unreal character artist"
    assert "unreal" in leads[0].raw_text
    assert leads[0].author == "dev1"
    assert leads[0].score == 10

def test_sync_source_health_and_deduplication(db_session, monkeypatch):
    # 1. Setup Mission & Source
    mission_in = MissionCreate(
        mission_name="Reddit Test Mission",
        target_service="3D Character Artist",
        keywords=["character", "unreal", "artist"],
        score_threshold=5
    )
    mission = mission_service.create_mission(db_session, mission_in)

    source_in = SourceCreate(
        mission_id=mission.id,
        source_type="reddit",
        config=SourceConfig(subreddit="gamedev", limit=10)
    )
    source = source_service.create_source(db_session, source_in)

    # 2. Mock Reddit response
    class MockResponse:
        status_code = 200
        def json(self):
            return {
                "data": {
                    "children": [
                        {
                            "data": {
                                "id": "post1",
                                "name": "t3_post1",
                                "title": "Looking for unreal character artist",
                                "selftext": "We need a 3D character artist for a UEFN project.",
                                "permalink": "/r/gamedev/comments/post1",
                                "author": "dev1",
                                "score": 10
                            }
                        },
                        {
                            "data": {
                                "id": "post2",
                                "name": "t3_post2",
                                "title": "Pizza is delicious",
                                "selftext": "I like eating pepperoni pizza.",
                                "permalink": "/r/gamedev/comments/post2",
                                "author": "dev2",
                                "score": 5
                            }
                        }
                    ]
                }
            }
        def raise_for_status(self):
            pass

    monkeypatch.setattr(httpx, "get", lambda *args, **kwargs: MockResponse())

    # 3. First Sync: should add 2 leads (1 qualified, 1 disqualified)
    res = source_service.sync_source(db_session, source.id)
    assert res["added"] == 2
    assert res["skipped"] == 0
    assert len(res["errors"]) == 0

    # Verify health status of source
    db_session.refresh(source)
    assert source.sync_count == 1
    assert source.last_sync_status == "SUCCESS"
    assert source.last_error is None
    assert source.last_synced_at is not None

    # Verify leads created
    leads = db_session.query(Lead).filter(Lead.mission_id == mission.id).all()
    assert len(leads) == 2
    
    lead_post1 = next(l for l in leads if l.source_post_id == "t3_post1")
    assert lead_post1.status == "QUALIFIED"  # contains 'need' & matches keywords -> hire + relevance >= 5
    assert lead_post1.platform == "Reddit"
    assert lead_post1.source_url == "https://reddit.com/r/gamedev/comments/post1"

    lead_post2 = next(l for l in leads if l.source_post_id == "t3_post2")
    assert lead_post2.status == "DISQUALIFIED"  # no hiring intent keywords

    # 4. Second Sync: should skip both as duplicates
    res2 = source_service.sync_source(db_session, source.id)
    assert res2["added"] == 0
    assert res2["skipped"] == 2
    assert source.sync_count == 2
    assert source.last_sync_status == "SUCCESS"

    # 5. Sync Failure Testing: mock httpx to raise exception
    def mock_get_failed(*args, **kwargs):
        raise httpx.RequestError("Network Connection Timeout")

    monkeypatch.setattr(httpx, "get", mock_get_failed)

    res3 = source_service.sync_source(db_session, source.id)
    assert res3["added"] == 0
    assert len(res3["errors"]) == 1
    assert "Network Connection Timeout" in res3["errors"][0]

    # Verify health status updated to FAILED
    db_session.refresh(source)
    assert source.sync_count == 3
    assert source.last_sync_status == "FAILED"
    assert "Network Connection Timeout" in source.last_error

def test_endpoints_sources(client, monkeypatch):
    # Mock validate_subreddit
    monkeypatch.setattr(RedditConnector, "validate_subreddit", lambda self, sub: True)

    # 1. Create a mission
    mission_res = client.post("/api/missions", json={
        "mission_name": "Web Test Mission",
        "target_service": "Service",
        "keywords": ["a", "b"],
        "score_threshold": 6
    })
    assert mission_res.status_code == 201
    mission_id = mission_res.json()["id"]

    # 2. Create source
    source_res = client.post("/api/sources", json={
        "mission_id": mission_id,
        "source_type": "reddit",
        "config": {
            "subreddit": "testing",
            "limit": 20
        }
    })
    assert source_res.status_code == 201
    source_data = source_res.json()
    assert source_data["mission_id"] == mission_id
    assert source_data["config"]["subreddit"] == "testing"

    # 3. List sources
    list_res = client.get("/api/sources")
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1

    # 4. Sync source (mock connector fetch)
    monkeypatch.setattr(RedditConnector, "fetch", lambda self, config: [])
    sync_res = client.post(f"/api/sources/{source_data['id']}/sync")
    assert sync_res.status_code == 200
    assert sync_res.json()["added"] == 0

def test_sync_source_edge_cases(db_session, monkeypatch):
    # Setup mission & source
    mission_in = MissionCreate(
        mission_name="Reddit Test Mission",
        target_service="3D Character Artist",
        keywords=["character"],
        score_threshold=5
    )
    mission = mission_service.create_mission(db_session, mission_in)

    source_in = SourceCreate(
        mission_id=mission.id,
        source_type="reddit",
        config=SourceConfig(subreddit="gamedev", limit=10)
    )
    source = source_service.create_source(db_session, source_in)

    # 1. Test empty new.json response (no crash)
    class EmptyMockResponse:
        status_code = 200
        def json(self):
            return {"data": {"children": []}}
        def raise_for_status(self):
            pass

    monkeypatch.setattr(httpx, "get", lambda *args, **kwargs: EmptyMockResponse())
    res_empty = source_service.sync_source(db_session, source.id)
    assert res_empty["added"] == 0
    assert res_empty["skipped"] == 0
    assert len(res_empty["errors"]) == 0
    
    db_session.refresh(source)
    assert source.sync_count == 1
    assert source.last_sync_status == "SUCCESS"

    # 2. Test inactive mission behavior
    mission.is_active = False
    db_session.commit()

    with pytest.raises(ValueError) as excinfo:
        source_service.sync_source(db_session, source.id)
    assert "inactive" in str(excinfo.value)

