class MissionBasedLeadHunter:
    """
    Smart lead classifier driven by mission keywords.
    Scores posts by keyword density, detects hire intent,
    and filters out self-promoters (Fiverr, Upwork, etc).
    """

    # Posts containing these are self-promotions — never leads
    NEGATIVE_KEYWORDS = {"fiverr", "upwork", "selling", "my services", "check out my", "dm me for", "portfolio"}

    # Strong signals that someone is actively hiring
    HIRE_INDICATORS = {"need", "looking for", "wanted", "hiring", "seeking", "want to hire", "who can", "anyone who"}

    def analyze(self, content: str, keywords: list[str]) -> dict:
        text = content.lower()

        # 1. Negative filter — self-promotion disqualifier
        if any(neg in text for neg in self.NEGATIVE_KEYWORDS):
            return {
                "intent": "promotion",
                "service_required": None,
                "platform": self._detect_platform(text),
                "lead_score": 2,
                "lead_quality": "low",
                "confidence": 0.9,
                "reasoning": [
                    "Matched self-promotion indicator (fiverr/upwork/selling). Auto-disqualified.",
                ],
                "service_match": False,
                "relevance_score": 0,
            }

        # 2. Keyword density — core relevance scoring
        matched_keywords = [kw.strip() for kw in keywords if kw.lower().strip() in text]
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

        # 3. Intent detection
        is_hire = any(indicator in text for indicator in self.HIRE_INDICATORS)

        reasoning = []
        intent = "other"
        confidence = 0.5

        if is_hire:
            intent = "hire"
            confidence = 0.9
            reasoning.append(f"Hire intent detected: matched hiring indicator.")
            # Bonus: hiring intent + keyword match → bump lead_score
            if service_match:
                relevance_score = min(10, relevance_score + 2)
        elif "expensive" in text or "cheap" in text or "price" in text:
            intent = "opinion"
            confidence = 0.7
            reasoning.append("Pricing opinion detected — not a direct hire request.")
        else:
            reasoning.append("No strong intent signals matched.")

        # 4. Compute final lead_score and quality
        lead_score = relevance_score
        if lead_score >= 8:
            lead_quality = "high"
        elif lead_score >= 4:
            lead_quality = "medium"
        else:
            lead_quality = "low"

        # Reasoning details
        if matched_keywords:
            reasoning.append(f"Keywords matched ({num_matches}): {', '.join(matched_keywords)}.")
        else:
            reasoning.append("No mission keywords matched in content.")
        reasoning.append(f"Relevance score: {relevance_score}/10.")

        return {
            "intent": intent,
            "service_required": self._detect_service(text),
            "platform": self._detect_platform(text),
            "lead_score": lead_score,
            "lead_quality": lead_quality,
            "confidence": confidence,
            "reasoning": reasoning,
            "service_match": service_match,
            "relevance_score": relevance_score,
        }

    def _detect_platform(self, text: str) -> str | None:
        if "roblox" in text:
            return "Roblox"
        if "uefn" in text or "unreal engine" in text or "unreal" in text:
            return "UEFN"
        if "unity" in text:
            return "Unity"
        if "godot" in text:
            return "Godot"
        return None

    def _detect_service(self, text: str) -> str | None:
        if "animator" in text or "animation" in text:
            return "animator"
        if "artist" in text or "3d" in text or "character" in text:
            return "artist"
        if "programmer" in text or "developer" in text or "coder" in text:
            return "developer"
        if "writer" in text or "copywriter" in text:
            return "writer"
        return None
