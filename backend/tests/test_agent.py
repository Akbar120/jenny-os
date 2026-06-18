import pytest
from backend.agents.lead_hunter.agent import FakeLeadHunter
from backend.agents.lead_hunter.schemas.output import LeadHunterOutput
from pydantic import ValidationError

def test_fake_lead_hunter_output():
    agent = FakeLeadHunter()
    output = agent.analyze("Some text content")
    
    assert isinstance(output, dict)
    assert output["intent"] == "hire"
    assert output["lead_score"] == 8
    
    # Verify Pydantic validation passes
    validated = LeadHunterOutput(**output)
    assert validated.intent == "hire"
    assert validated.lead_score == 8
    assert validated.confidence == 0.95
    assert len(validated.reasoning) == 2

def test_pydantic_validation_ranges():
    # Valid model
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

    # Invalid lead_score (above 10)
    invalid_data = valid_data.copy()
    invalid_data["lead_score"] = 11
    with pytest.raises(ValidationError):
        LeadHunterOutput(**invalid_data)

    # Invalid lead_score (below 0)
    invalid_data["lead_score"] = -1
    with pytest.raises(ValidationError):
        LeadHunterOutput(**invalid_data)

    # Invalid confidence (above 1.0)
    invalid_data = valid_data.copy()
    invalid_data["confidence"] = 1.01
    with pytest.raises(ValidationError):
        LeadHunterOutput(**invalid_data)

    # Invalid confidence (below 0.0)
    invalid_data["confidence"] = -0.05
    with pytest.raises(ValidationError):
        LeadHunterOutput(**invalid_data)

def test_rule_based_lead_hunter():
    from backend.agents.lead_hunter.agent import RuleBasedLeadHunter
    agent = RuleBasedLeadHunter()

    # Test cases mapping input text to expected intent and platform
    test_cases = [
        ("Need UEFN artist", "hire", "UEFN"),
        ("Roblox artist needed", "hire", "Roblox"),
        ("UEFN artists expensive", "opinion", "UEFN"),
        ("Check my Fiverr", "promotion", "Fiverr"),
        ("I like pizza", "other", None)
    ]

    for content, expected_intent, expected_platform in test_cases:
        output = agent.analyze(content)
        # Verify it conforms to LeadHunterOutput schema first
        validated = LeadHunterOutput(**output)
        
        assert validated.intent == expected_intent
        assert validated.platform == expected_platform

