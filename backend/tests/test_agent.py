import pytest
from backend.agents.lead_hunter.agent import MissionBasedLeadHunter
from backend.agents.lead_hunter.schemas.output import LeadHunterOutput
from pydantic import ValidationError

# ---------------------------------------------------------------------------
# MissionBasedLeadHunter Tests
# ---------------------------------------------------------------------------

KEYWORDS = ["character artist", "3d", "uefn", "roblox", "hire", "animator"]


def test_hire_intent_with_keyword_match():
    """Hire intent + keyword match should produce high relevance and score."""
    agent = MissionBasedLeadHunter()
    output = agent.analyze(
        "I need a 3d character artist for my UEFN game",
        keywords=KEYWORDS
    )
    validated = LeadHunterOutput(**output)
    assert validated.intent == "hire"
    assert output["relevance_score"] >= 8
    assert output["service_match"] is True
    assert validated.lead_quality == "high"


def test_self_promotion_auto_disqualify():
    """Posts mentioning fiverr/upwork should be auto-disqualified as promotion."""
    agent = MissionBasedLeadHunter()
    output = agent.analyze(
        "Check my Fiverr portfolio for 3d character art",
        keywords=KEYWORDS
    )
    validated = LeadHunterOutput(**output)
    assert validated.intent == "promotion"
    assert output["service_match"] is False
    assert output["relevance_score"] == 0


def test_no_keyword_match():
    """Post with no matching keywords should return score 0."""
    agent = MissionBasedLeadHunter()
    output = agent.analyze(
        "General gaming discussion about loot boxes",
        keywords=KEYWORDS
    )
    assert output["relevance_score"] == 0
    assert output["service_match"] is False


def test_single_keyword_match():
    """Single keyword match should return relevance_score >= 3."""
    agent = MissionBasedLeadHunter()
    output = agent.analyze(
        "Looking for a 3d artist to work on a project",
        keywords=["3d", "character", "uefn"]
    )
    assert output["relevance_score"] >= 3
    assert output["service_match"] is True


def test_multi_keyword_match():
    """3+ keyword matches should return relevance_score >= 8."""
    agent = MissionBasedLeadHunter()
    output = agent.analyze(
        "hiring a 3d character artist for roblox uefn game",
        keywords=["3d", "character", "uefn", "roblox", "hire"]
    )
    assert output["relevance_score"] >= 8


def test_negative_filter_upwork():
    """Upwork mentions should trigger promotion intent."""
    agent = MissionBasedLeadHunter()
    output = agent.analyze(
        "My upwork profile has lots of 3d character art",
        keywords=KEYWORDS
    )
    assert output["intent"] == "promotion"
    assert output["service_match"] is False


def test_platform_detection():
    """Platform should be correctly detected from text."""
    agent = MissionBasedLeadHunter()
    output = agent.analyze("Need artist for UEFN project", keywords=KEYWORDS)
    assert output["platform"] == "UEFN"

    output2 = agent.analyze("Looking for roblox animator", keywords=KEYWORDS)
    assert output2["platform"] == "Roblox"


# ---------------------------------------------------------------------------
# Pydantic Schema Validation Tests
# ---------------------------------------------------------------------------

def test_pydantic_validation_valid():
    valid_data = {
        "intent": "hire",
        "service_required": "character_artist",
        "platform": "UEFN",
        "lead_score": 10,
        "lead_quality": "high",
        "confidence": 1.0,
        "reasoning": ["looks good"]
    }
    m = LeadHunterOutput(**valid_data)
    assert m.lead_score == 10
    assert m.confidence == 1.0


def test_pydantic_lead_score_out_of_range():
    base = {
        "intent": "hire",
        "service_required": None,
        "platform": None,
        "lead_score": 8,
        "lead_quality": "high",
        "confidence": 0.9,
        "reasoning": ["ok"]
    }
    # Above 10 should fail
    bad = {**base, "lead_score": 11}
    with pytest.raises(ValidationError):
        LeadHunterOutput(**bad)

    # Below 0 should fail
    bad2 = {**base, "lead_score": -1}
    with pytest.raises(ValidationError):
        LeadHunterOutput(**bad2)


def test_pydantic_confidence_out_of_range():
    base = {
        "intent": "hire",
        "service_required": None,
        "platform": None,
        "lead_score": 8,
        "lead_quality": "high",
        "confidence": 0.9,
        "reasoning": ["ok"]
    }
    with pytest.raises(ValidationError):
        LeadHunterOutput(**{**base, "confidence": 1.01})

    with pytest.raises(ValidationError):
        LeadHunterOutput(**{**base, "confidence": -0.05})
