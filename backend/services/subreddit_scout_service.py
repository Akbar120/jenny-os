"""
Subreddit Scout Service
-----------------------
Given a mission_id, fetches the mission's keywords and discovers
the best matching subreddits using intelligence_service.
Returns ranked results ready for the frontend to display.
"""
import json
import logging
from sqlalchemy.orm import Session
from backend.database.models import Mission, Source
from backend.services.intelligence_service import discover_communities

logger = logging.getLogger("subreddit_scout")


def scout_subreddits_for_mission(db: Session, mission_id: str) -> dict:
    """
    Discovers and ranks the best subreddits for a given mission based on its keywords.

    Returns:
        {
            "mission_id": str,
            "mission_name": str,
            "keywords": list[str],
            "suggestions": list[{id, platform, name, display_name, description, url, score, already_added}]
        }
    """
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise ValueError(f"Mission with ID {mission_id} not found.")

    # Parse mission keywords
    try:
        keywords = json.loads(mission.keywords) if isinstance(mission.keywords, str) else mission.keywords
    except Exception:
        keywords = []

    if not keywords:
        return {
            "mission_id": mission_id,
            "mission_name": mission.mission_name,
            "keywords": [],
            "suggestions": [],
        }

    # Discover communities using intelligence_service
    try:
        communities = discover_communities(mission.target_service, keywords)
    except Exception as e:
        logger.error(f"Community discovery failed for mission {mission_id}: {e}")
        communities = []

    # Get already-added subreddits for this mission (to mark them)
    existing_sources = db.query(Source).filter(
        Source.mission_id == mission_id,
        Source.is_active == True
    ).all()

    existing_subreddits: set[str] = set()
    for src in existing_sources:
        try:
            cfg = json.loads(src.config) if isinstance(src.config, str) else src.config
            sub = cfg.get("subreddit", "").lower().strip()
            if sub:
                existing_subreddits.add(sub)
        except Exception:
            pass

    # Annotate suggestions with already_added flag
    suggestions = []
    for community in communities:
        if community.get("platform") != "reddit":
            continue
        subreddit_name = community.get("name", "").lower().strip()
        suggestions.append({
            **community,
            "already_added": subreddit_name in existing_subreddits,
        })

    return {
        "mission_id": mission_id,
        "mission_name": mission.mission_name,
        "keywords": keywords,
        "suggestions": suggestions,
    }
