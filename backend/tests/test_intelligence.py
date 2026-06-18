import pytest
from unittest.mock import patch
import httpx
from fastapi.testclient import TestClient
from backend.services import intelligence_service
from backend.main import app
from backend.database.engine import get_db

def test_generate_keywords_offline_error():
    # Force Ollama to be offline by patching httpx.post to raise an exception
    with patch("httpx.post", side_effect=httpx.ConnectError("Ollama offline")):
        with pytest.raises(RuntimeError) as exc_info:
            intelligence_service.generate_keywords("3D Character Artist")
        assert "Ollama model is offline" in str(exc_info.value)

def test_generate_keywords_online():
    # Mock a successful Ollama response
    class MockResponse:
        def __init__(self):
            self.status_code = 200
        def json(self):
            return {"response": "3d artist, metahuman, game design, roblox"}

    with patch("httpx.post", return_value=MockResponse()):
        kws, fallback = intelligence_service.generate_keywords("3D Character Artist")
        assert "3d artist" in kws
        assert "metahuman" in kws
        assert fallback is False

def test_discover_communities():
    # Setup keywords for 3D Artist
    keywords = ["character", "unreal", "game"]
    communities = intelligence_service.discover_communities("3D Character Artist", keywords)
    
    assert len(communities) > 0
    # Top matches should be gamedev or unrealengine
    platforms = [c["platform"] for c in communities]
    assert "reddit" in platforms
    assert "discord" in platforms

    # Verify score ranking
    assert communities[0]["score"] >= communities[-1]["score"]

def test_suggest_endpoint_offline_error():
    # Force Ollama to be offline by patching httpx.post to raise an exception
    with patch("httpx.post", side_effect=httpx.ConnectError("Ollama offline")):
        client = TestClient(app)
        response = client.get("/api/missions/suggest?target_service=3D%20Character%20Artist")
        assert response.status_code == 500
        assert "Ollama model is offline" in response.json()["detail"]

def test_suggest_endpoint_online():
    # Mock a successful Ollama response
    class MockResponse:
        def __init__(self):
            self.status_code = 200
        def json(self):
            return {"response": "3d artist, metahuman, game design, roblox"}

    with patch("httpx.post", return_value=MockResponse()):
        client = TestClient(app)
        response = client.get("/api/missions/suggest?target_service=3D%20Character%20Artist")
        assert response.status_code == 200
        data = response.json()
        assert "keywords" in data
        assert "used_fallback" in data
        assert data["used_fallback"] is False
