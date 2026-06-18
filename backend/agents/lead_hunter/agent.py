from typing import Protocol

class LeadHunterBase(Protocol):
    def analyze(self, content: str) -> dict:
        ...

class FakeLeadHunter(LeadHunterBase):
    def analyze(self, content: str) -> dict:
        return {
            "intent": "hire",
            "service_required": "character_artist",
            "platform": "UEFN",
            "lead_score": 8,
            "lead_quality": "high",
            "confidence": 0.95,
            "reasoning": [
                "Fake agent — plumbing test",
                "Replace with Gemma in Phase C"
            ]
        }

class RuleBasedLeadHunter(LeadHunterBase):
    def analyze(self, content: str) -> dict:
        text = content.lower()
        
        # Default fallback values
        intent = "other"
        platform = None
        service_required = None
        lead_score = 0
        lead_quality = "low"
        confidence = 0.5
        reasoning = ["Default rule-based classification"]
        
        if "fiverr" in text:
            intent = "promotion"
            platform = "Fiverr"
            lead_score = 4
            lead_quality = "medium"
            confidence = 0.8
            reasoning = ["Matched keyword 'fiverr' indicating self-promotion"]
        elif "need" in text:
            intent = "hire"
            lead_score = 8
            lead_quality = "high"
            confidence = 0.9
            reasoning = ["Matched keyword 'need' indicating a hiring request"]
            if "roblox" in text:
                platform = "Roblox"
                service_required = "artist"
            elif "uefn" in text:
                platform = "UEFN"
                service_required = "artist"
        elif "expensive" in text:
            intent = "opinion"
            lead_score = 2
            lead_quality = "low"
            confidence = 0.7
            reasoning = ["Matched keyword 'expensive' indicating a general opinion or discussion"]
            if "uefn" in text:
                platform = "UEFN"
        elif "pizza" in text:
            intent = "other"
            lead_score = 0
            lead_quality = "low"
            confidence = 0.5
            reasoning = ["Matched keyword 'pizza' indicating irrelevant topic"]
            
        return {
            "intent": intent,
            "service_required": service_required,
            "platform": platform,
            "lead_score": lead_score,
            "lead_quality": lead_quality,
            "confidence": confidence,
            "reasoning": reasoning
        }

class MissionBasedLeadHunter(LeadHunterBase):
    def analyze(self, content: str, keywords: list[str]) -> dict:
        text = content.lower()
        
        # 1. Calculate keyword matching density
        matched_keywords = []
        for kw in keywords:
            if kw.lower().strip() in text:
                matched_keywords.append(kw.strip())
        
        num_matches = len(matched_keywords)
        if num_matches == 0:
            relevance_score = 0
            service_match = False
        elif num_matches == 1:
            relevance_score = 3
            service_match = True
        elif num_matches == 2:
            relevance_score = 5
            service_match = True
        else:
            relevance_score = 8
            service_match = True
            
        # 2. Determine intent based on rule-based cues
        hiring_indicators = ["need", "looking for", "wanted", "hiring"]
        is_hire = any(indicator in text for indicator in hiring_indicators)
        
        intent = "other"
        lead_score = 0
        lead_quality = "low"
        confidence = 0.5
        reasoning = []
        
        if "fiverr" in text or "upwork" in text:
            intent = "promotion"
            lead_score = 4
            lead_quality = "medium"
            confidence = 0.8
            reasoning.append("Matched 'fiverr' or 'upwork' indicating self-promotion.")
        elif is_hire:
            intent = "hire"
            lead_score = 8
            lead_quality = "high" if relevance_score >= 5 else "medium"
            confidence = 0.9
            reasoning.append("Matched hiring indicators ('need', 'looking for', 'wanted', 'hiring').")
        elif "expensive" in text or "cheap" in text:
            intent = "opinion"
            lead_score = 2
            lead_quality = "low"
            confidence = 0.7
            reasoning.append("Matched 'expensive' or 'cheap' indicating a pricing opinion.")
        else:
            reasoning.append("No specific intent keywords matched.")
            
        # Detect platform for backward compatibility
        platform = None
        if "roblox" in text:
            platform = "Roblox"
        elif "uefn" in text or "unreal" in text or "unreal engine" in text:
            platform = "UEFN"
        elif "unity" in text:
            platform = "Unity"
            
        # Detect service required for backward compatibility
        service_required = None
        if "artist" in text:
            service_required = "artist"
        elif "programmer" in text or "developer" in text:
            service_required = "developer"
        elif "animator" in text:
            service_required = "animator"
            
        reasoning.append(f"Keyword matches ({num_matches}): {', '.join(matched_keywords) if matched_keywords else 'None'}.")
        reasoning.append(f"Calculated relevance score: {relevance_score}.")
        
        return {
            "intent": intent,
            "service_required": service_required,
            "platform": platform,
            "lead_score": lead_score,
            "lead_quality": lead_quality,
            "confidence": confidence,
            "reasoning": reasoning,
            "service_match": service_match,
            "relevance_score": relevance_score
        }
