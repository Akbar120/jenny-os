# source-connector.md — Phase 2A: Source Connector Framework

**Goal:** Build a universal source ingestion architecture and implement Reddit as the first source.
Jenny OS missions will be able to auto-discover real Reddit posts and qualify leads without any manual copy-paste.

---

## Overview

Currently, Jenny OS requires a human to manually paste raw text into the Leads intake form.
Phase 2A solves this by introducing a **Source Connector Framework** — a pluggable system where each *source* (Reddit, Twitter, Discord, etc.) implements a common `BaseConnector` interface, fetches raw posts, transforms them into a universal `RawLead` format, and pipes them through the existing `MissionBasedLeadHunter`.

Reddit is the first connector implemented. It uses Reddit's public JSON API (`/new.json`) — **no OAuth needed for public subreddits**.

---

## Project Type
**BACKEND + WEB** — FastAPI backend + Next.js frontend

---

## Success Criteria

- [ ] A mission can be linked to one or more Reddit subreddits via the UI
- [ ] Clicking "Sync Now" fetches the latest posts from the subreddit
- [ ] Posts are transformed into `RawLead` and scored by `MissionBasedLeadHunter`
- [ ] Qualified leads appear in the existing Leads page
- [ ] Duplicate posts (same URL/post ID) are never re-inserted
- [ ] The Sources page lists all configured sources with their sync status and last synced time
- [ ] No hardcoded subreddits — fully configurable per mission

---

## Out of Scope (Phase 2A)

- Scheduled / automatic syncing (cron)
- Twitter, Discord, LinkedIn connectors
- CRM, outreach, scheduler
- Additional dashboards

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Source storage | SQLite via SQLAlchemy (`Source` model) | Consistent with existing DB pattern |
| Reddit API | `httpx` + Reddit public JSON API | No PRAW install, no OAuth for public subs |
| Connector abstraction | Python ABC (`BaseConnector`) | Pluggable — next connector is a 20-line file |
| Deduplication | `source_post_id` UNIQUE constraint | Prevents re-processing same Reddit post |
| Frontend | Next.js + existing design system | No new libraries |

---

## File Structure

### New Files

```
backend/
├── connectors/
│   ├── __init__.py
│   ├── base.py                  # BaseConnector ABC + RawLead dataclass
│   └── reddit.py                # RedditConnector (httpx + /new.json)
├── services/
│   └── source_service.py        # Source CRUD + sync orchestration
├── schemas/
│   └── source.py                # Pydantic: SourceCreate, SourceResponse
└── routes/
    └── sources.py               # FastAPI: POST, GET, POST /sync

frontend/src/app/
└── sources/
    └── page.tsx                 # Sources management page

frontend/src/
├── types/index.ts               # + Source, SourceCreate types
└── services/api.ts              # + getSources, createSource, syncSource
```

### Modified Files

```
backend/
├── database/models.py           # + Source model, + LeadSource tracking field
├── main.py                      # + register sources router
├── routes/leads.py              # (no change needed — leads flow unchanged)

frontend/src/
└── components/SidebarClient.tsx # + Sources nav item
```

---

## Data Models

### `Source` (new table)

| Column | Type | Description |
|---|---|---|
| `id` | String (UUID) | Primary key |
| `mission_id` | String (FK → missions) | Which mission this source feeds |
| `source_type` | String | `"reddit"` (extensible) |
| `config` | String (JSON) | `{"subreddit": "gamedev", "limit": 25}` |
| `is_active` | Boolean | Toggle on/off |
| `last_synced_at` | String (ISO 8601) | When sync last ran |
| `created_at` | String (ISO 8601) | Creation timestamp |

### `RawLead` (in-memory dataclass, never stored directly)

```python
@dataclass
class RawLead:
    source_id: str
    source_post_id: str     # Reddit post ID (for deduplication)
    source_url: str         # Full URL to the post
    title: str
    body: str               # selftext or empty string
    author: str
    score: int              # Reddit upvote score
    raw_text: str           # title + body combined (fed to lead hunter)
```

### Lead model — add `source_post_id` field

A nullable `source_post_id` column on the existing `leads` table enables deduplication.
Unique constraint: `(mission_id, source_post_id)` for source-based leads.

---

## Connector Abstraction

```python
# backend/connectors/base.py
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class RawLead:
    source_id: str
    source_post_id: str
    source_url: str
    title: str
    body: str
    author: str
    score: int
    raw_text: str  # Combined text fed to MissionBasedLeadHunter

class BaseConnector(ABC):
    @abstractmethod
    def fetch(self, config: dict) -> list[RawLead]:
        """Fetch raw leads from the source. Returns list of RawLead."""
        ...
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/sources` | Create a new source for a mission |
| `GET` | `/api/sources` | List all sources (optionally filter by `?mission_id=`) |
| `PATCH` | `/api/sources/{id}` | Update source config or toggle active |
| `POST` | `/api/sources/{id}/sync` | Trigger manual sync, returns `{added, skipped, errors}` |

---

## Sync Flow (Step-by-Step)

```
POST /api/sources/{id}/sync
    │
    ├── Load Source from DB
    ├── Load Mission (get keywords + threshold)
    ├── Instantiate RedditConnector
    ├── connector.fetch(config) → list[RawLead]
    │
    └── For each RawLead:
            ├── Check: does lead with source_post_id already exist?
            │   └── YES → skip (increment skipped count)
            │   └── NO  → continue
            ├── Run MissionBasedLeadHunter.analyze(raw_text, keywords)
            ├── Determine status: QUALIFIED / DISQUALIFIED
            └── create_lead(db, ..., source_post_id=raw_lead.source_post_id)
    │
    └── Update source.last_synced_at
    └── Return { added: N, skipped: M, errors: [] }
```

---

## Task Breakdown

### Phase A — Database & Backend Foundation

#### Task A1 — Extend DB Models
- **Agent:** `database-architect` / `backend-specialist`
- **Skill:** `database-design`
- **Priority:** P0 (blocker for everything)
- **INPUT:** `backend/database/models.py`
- **OUTPUT:** New `Source` SQLAlchemy model; `source_post_id` nullable column on `Lead`
- **VERIFY:** `Base.metadata.create_all()` runs without error; `Source` table appears in DB

#### Task A2 — Connector Abstraction
- **Agent:** `backend-specialist`
- **Skill:** `python-patterns`
- **Priority:** P0 (blocker for Reddit connector)
- **Dependencies:** None (pure Python)
- **INPUT:** None (new files)
- **OUTPUT:** `backend/connectors/__init__.py`, `base.py` (RawLead dataclass + BaseConnector ABC)
- **VERIFY:** `from backend.connectors.base import RawLead, BaseConnector` imports cleanly

#### Task A3 — Reddit Connector
- **Agent:** `backend-specialist`
- **Skill:** `python-patterns`, `api-patterns`
- **Priority:** P1
- **Dependencies:** A2
- **INPUT:** `BaseConnector` ABC
- **OUTPUT:** `backend/connectors/reddit.py` (RedditConnector using httpx + `/new.json`)
- **VERIFY:** `RedditConnector().fetch({"subreddit": "gamedev", "limit": 5})` returns list of RawLead with non-empty `raw_text`

#### Task A4 — Source Pydantic Schemas
- **Agent:** `backend-specialist`
- **Skill:** `api-patterns`
- **Priority:** P1
- **Dependencies:** A1
- **INPUT:** Source model fields
- **OUTPUT:** `backend/schemas/source.py` — `SourceCreate`, `SourceUpdate`, `SourceResponse`, `SyncResult`
- **VERIFY:** Schemas import cleanly; `SourceCreate.model_validate({"mission_id": "x", "source_type": "reddit", "config": {...}})` succeeds

#### Task A5 — Source Service Layer
- **Agent:** `backend-specialist`
- **Skill:** `python-patterns`, `database-design`
- **Priority:** P1
- **Dependencies:** A1, A2, A3, A4
- **INPUT:** Source model, connectors, lead_service, mission_service
- **OUTPUT:** `backend/services/source_service.py` with:
  - `create_source(db, data) → Source`
  - `get_sources(db, mission_id?) → list[Source]`
  - `update_source(db, id, data) → Source`
  - `sync_source(db, source_id) → dict` (the main orchestration function)
- **VERIFY:** Unit test `sync_source` with mocked connector returns `{added, skipped, errors}`

#### Task A6 — Sources FastAPI Router
- **Agent:** `backend-specialist`
- **Skill:** `api-patterns`
- **Priority:** P2
- **Dependencies:** A4, A5
- **INPUT:** source_service functions
- **OUTPUT:** `backend/routes/sources.py` with 4 endpoints
- **VERIFY:** `GET /api/sources` returns `[]`; `POST /api/sources` with valid body returns 201

#### Task A7 — Register Router in main.py
- **Agent:** `backend-specialist`
- **Priority:** P2
- **Dependencies:** A6
- **INPUT:** `backend/main.py`
- **OUTPUT:** `sources.router` registered
- **VERIFY:** FastAPI docs at `/docs` shows `/api/sources` endpoints

---

### Phase B — Frontend UI

#### Task B1 — Frontend Types & API Client
- **Agent:** `frontend-specialist`
- **Skill:** `nextjs-react-expert`
- **Priority:** P2
- **Dependencies:** A6
- **INPUT:** `frontend/src/types/index.ts`, `frontend/src/services/api.ts`
- **OUTPUT:**
  - `Source`, `SourceCreate`, `SyncResult` interfaces in types
  - `getSources`, `createSource`, `syncSource` in api.ts
- **VERIFY:** TypeScript compiles without errors

#### Task B2 — Sources Page UI
- **Agent:** `frontend-specialist`
- **Skill:** `frontend-design`, `nextjs-react-expert`
- **Priority:** P3
- **Dependencies:** B1
- **INPUT:** Existing mission card design system from `missions/page.tsx`
- **OUTPUT:** `frontend/src/app/sources/page.tsx` with:
  - Sources list (cards) grouped by mission
  - "Add Source" modal (source_type=reddit, subreddit input, limit slider)
  - **"Sync Now" button** with loading state + result toast (`Added 3, Skipped 12`)
  - Last synced timestamp display
  - Active/inactive toggle
- **VERIFY:** Page renders without console errors; Sync Now shows result

#### Task B3 — Sidebar Navigation
- **Agent:** `frontend-specialist`
- **Priority:** P3
- **Dependencies:** B2
- **INPUT:** `frontend/src/components/SidebarClient.tsx`
- **OUTPUT:** "Sources" nav item added between Missions and Leads
- **VERIFY:** Clicking Sources navigates to `/sources`

---

### Phase X — Verification

#### Task X1 — Backend Tests
- **Agent:** `test-engineer`
- **Skill:** `testing-patterns`
- **INPUT:** All new backend code
- **OUTPUT:** `backend/tests/test_sources.py` — tests for:
  - `RedditConnector.fetch()` (mock httpx)
  - `source_service.sync_source()` deduplication logic
  - `POST /api/sources` and `POST /api/sources/{id}/sync` endpoints
- **VERIFY:** `pytest backend/tests/ -v` — all pass

#### Task X2 — Build & Compile Check
- **Commands:**
  ```bash
  npm run build   # in frontend/
  ```
- **VERIFY:** Zero TypeScript errors, zero warnings

#### Task X3 — Smoke Test
- Start backend: `uvicorn backend.main:app --reload`
- Start frontend: `npm run dev`
- Create a mission, add Reddit source for `r/gamedev`
- Click "Sync Now"
- Verify leads appear in `/leads` filtered by that mission

---

## Risk Register

| Risk | Mitigation |
|---|---|
| Reddit throttles unauthenticated requests | Add `User-Agent` header per Reddit API rules; default limit ≤ 25 posts |
| Reddit post has no selftext (link posts) | Use title only as `raw_text`; score still computed |
| Duplicate leads on repeated syncs | `source_post_id` UNIQUE constraint + pre-check in sync loop |
| Network failure during sync | Wrap fetch in try/except; return errors list in `SyncResult` |
| `httpx` not installed | Add to `requirements.txt` |

---

## Phase X Checklist (to fill in after implementation)

- [ ] `pytest backend/tests/ -v` → all pass
- [ ] `npm run build` → success
- [ ] `POST /api/sources` creates source in DB
- [ ] `POST /api/sources/{id}/sync` fetches real Reddit posts
- [ ] Qualified leads appear in `/leads`
- [ ] Duplicate posts are skipped on second sync
- [ ] Sources page renders, Sync Now button works
- [ ] No purple/violet colors in UI
- [ ] No hardcoded subreddit names in backend code
