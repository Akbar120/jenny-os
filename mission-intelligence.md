# Mission Intelligence Layer — Phase 2B Plan

**Goal:** Pivot Jenny OS from a simple scraper to an agentic **Mission Intelligence Layer**. 
When a user creates a Mission with a target service, Jenny will automatically:
1. Generate relevant keywords.
2. Discover relevant communities (subreddits, and eventually Discord channels, job boards, etc.).
3. Link multiple sources under a single Mission.
4. Auto-sync and qualify leads across all discovered sources in parallel.

---

## Project Type
**BACKEND + WEB** — FastAPI backend + Next.js App Router frontend.

---

## User Review Required

> [!IMPORTANT]
> **Database Schema Evolution**
> Currently, the `sources` table links to a mission, but the UI is focused on a 1-to-1 relationship. We will shift the architecture so that a `Mission` has multiple active `Source` objects. Syncing a Mission will trigger parallel sync executions for all its linked, active sources.
>
> **Ollama / Gemma Integration**
> We will implement a service that queries the configured Ollama URL (loaded from settings) to generate keywords and discover subreddits dynamically. If Ollama is offline, a robust local rule-based dictionary will serve as a fallback to prevent system failures.

---

## Open Questions (Socratic Gate)

> [!NOTE]
> ### 1. **Discovery Timing & Control**
> **Question:** Should community discovery and keyword generation happen *before* the Mission is saved (showing the user a list of suggested subreddits and keywords to edit/approve in the UI), or should it happen silently in the background after saving?
> 
> **Options:**
> - **Option A (Recommended):** Generate suggestions in the modal *before* creation. The user reviews, deletes irrelevant items, adds custom ones, and then saves.
> - **Option B:** Fully autonomous. The user just enters the Mission Name, and the agent discovers and syncs communities silently in the background.
> 
> **Default Recommendation:** Option A. It gives the user full control, prevents wasteful scraping, and guarantees relevance.

> [!NOTE]
> ### 2. **Auto-Source Range**
> **Question:** For Reddit community discovery, should the agent restrict itself to a curated list of developer/freelance subreddits (e.g. `r/gamedev`, `r/unrealengine`, `r/forhire`) or search globally across Reddit search APIs?
> 
> **Options:**
> - **Option A (Recommended):** Filter a large, pre-defined master list of high-quality subreddits using generated keywords (fast, highly relevant, no noise).
> - **Option B:** Use Reddit's search API dynamically to find new subreddits matching the keywords (flexible, but prone to high noise and dead subreddits).
> 
> **Default Recommendation:** Option A. It guarantees that the crawler hits active, moderation-checked hiring communities.

---

## Success Criteria
- [ ] Creating a Mission with only name and target service auto-populates keywords and subreddit lists.
- [ ] A Mission detail/edit view lists all its active sources with a unified "Sync All Campaign Feeds" button.
- [ ] Ollama/Gemma generation service handles offline state without crashing.
- [ ] No hardcoded subreddits in the crawler — lists are generated dynamically per campaign.
- [ ] Visual UI components comply with **no purple/violet colors**.

---

## Tech Stack
- **AI Generation**: Ollama REST API (`gemma3:4b` or user-configured model) with local dictionary fallback.
- **Data Layer**: SQLAlchemy one-to-many relationship mapping `Mission` ── `Source`.
- **Concurrency**: Python `asyncio` to sync multiple sources in parallel.

---

## File Structure

### New Files
- `backend/services/intelligence_service.py` — Handles Ollama prompts & fallback dictionaries for keywords + subreddit generation.
- `backend/tests/test_intelligence.py` — Tests intelligence service and fallbacks.

### Modified Files
- `backend/routes/missions.py` — Add `/api/missions/suggest` endpoint.
- `backend/services/mission_service.py` — Update creation to auto-bind generated sources.
- `frontend/src/app/missions/page.tsx` — Refactor Mission creation modal to display suggestions before saving.
- `frontend/src/services/api.ts` — Add `suggestMissionDetails` endpoint.

---

## Task Breakdown

### Phase A: Backend Intelligence & Schema Plumbing

#### Task A1: Intelligence Service (Gemma + Fallback)
- **Agent:** `backend-specialist`
- **Priority:** P0
- **INPUT:** `backend/services/intelligence_service.py`
- **OUTPUT:** Functions `generate_keywords(service: str) -> list[str]` and `discover_subreddits(service: str, keywords: list[str]) -> list[str]`. Connects to Ollama using current settings.
- **VERIFY:** Direct python execution returns structured list of keywords and subreddits (or fallbacks if Ollama is down).

#### Task A2: API Suggest Endpoint
- **Agent:** `backend-specialist`
- **Priority:** P1
- **INPUT:** `backend/routes/missions.py`
- **OUTPUT:** `GET /api/missions/suggest?target_service=...` returning `{keywords: [...], subreddits: [...]}`.
- **VERIFY:** Requesting endpoint via python client returns JSON payload.

---

### Phase B: Frontend UX Refactoring

#### Task B1: Suggestion Step in Creation Modal
- **Agent:** `frontend-specialist`
- **Priority:** P2
- **INPUT:** `frontend/src/app/missions/page.tsx`
- **OUTPUT:** Modified modal. Entering "Target Service" triggers a fetch to the suggest endpoint and populates tag inputs for keywords and subreddits.
- **VERIFY:** User can add/remove tags before clicking "Save".

---

## Phase X: Verification

### Automated Checks
- Run pytest suite:
  ```bash
  pytest backend/tests/test_intelligence.py
  ```
- Build check:
  ```bash
  npm run build
  ```
- Run master audit checklist:
  ```bash
  python .agents/scripts/checklist.py .
  ```
