# Jenny OS Phase 1 — Lead Hunter (Hardened Build Plan)

> **Version:** 2.0 — Post peer-review (5 specialist reviewers)
> **Strategy:** Vertical Slice + Stub-First
> **Success Definition:** Paste text → Analyze → JSON → Stored → Visible in UI
> **Rule:** Build the plumbing first. Plug in the AI last.

---

## Final Scope (What We ARE Building)

### Pages (5 only)
- Dashboard
- Agents
- Leads
- Logs
- Settings

### Database Tables (2 only)

| Table | Columns |
|-------|---------|
| `leads` | id, content_hash, raw_content, intent, service_required, platform, lead_score, lead_quality, confidence, reasoning, status, created_at |
| `logs` | id, timestamp, event, lead_id, details |

### Lead Hunter JSON Output (locked schema)
```json
{
  "intent": "hire",
  "service_required": "character_artist",
  "platform": "UEFN",
  "lead_score": 9,
  "lead_quality": "high",
  "confidence": 0.92,
  "reasoning": [
    "Hiring request",
    "Budget found",
    "Good match"
  ]
}
```

---

## What We Are NOT Building (Phase 1)

❌ Tasks page / tasks table
❌ Memory page / memory system
❌ Orchestrator page
❌ Background workers / queues
❌ Scrapers (Reddit, Discord, LinkedIn)
❌ Outreach Agent
❌ Scheduler Agent
❌ CRM Agent

---

## Folder Structure

```
f:\Ai Agency Jenny OS\
├── frontend/                            # Next.js UI (port 3000)
│   ├── .env.local                       # NEXT_PUBLIC_API_URL=http://localhost:8000
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx               # Server Component — root layout (sidebar + topbar)
│   │   │   ├── page.tsx                 # Dashboard
│   │   │   ├── leads/
│   │   │   │   ├── page.tsx             # "use client" — Lead list + detail panel
│   │   │   │   ├── loading.tsx          # Skeleton cards (Suspense boundary)
│   │   │   │   └── error.tsx            # "Failed to load leads" + retry
│   │   │   ├── agents/
│   │   │   │   └── page.tsx             # Static card + count from /api/stats
│   │   │   ├── logs/
│   │   │   │   ├── page.tsx             # Logs table
│   │   │   │   ├── loading.tsx
│   │   │   │   └── error.tsx
│   │   │   └── settings/
│   │   │       └── page.tsx             # Settings form
│   │   ├── components/
│   │   │   ├── SidebarClient.tsx        # "use client" — active link, hover state
│   │   │   ├── LeadCard.tsx             # Left panel lead row
│   │   │   ├── LeadDetail.tsx           # Right panel detail view
│   │   │   ├── IntakeForm.tsx           # Paste + Analyze form
│   │   │   ├── StatCard.tsx             # Dashboard stat card
│   │   │   └── LogRow.tsx               # Logs table row
│   │   ├── services/
│   │   │   └── api.ts                   # All fetch wrappers — uses NEXT_PUBLIC_API_URL
│   │   └── types/
│   │       └── index.ts                 # All TypeScript interfaces (see below)
│   ├── package.json
│   └── tailwind.config.ts
│
├── backend/                             # FastAPI backend (port 8000)
│   ├── main.py                          # FastAPI app + CORS + router registration
│   ├── config.py                        # Settings loaded from settings.json
│   ├── settings.json                    # Runtime config: ollama_url, model, score_threshold
│   ├── database/
│   │   ├── engine.py                    # SQLAlchemy engine + SessionLocal + get_db()
│   │   └── models.py                    # Lead + Log SQLAlchemy models
│   ├── schemas/
│   │   ├── lead.py                      # AnalyzeRequest, LeadResponse Pydantic models
│   │   └── log.py                       # LogResponse Pydantic model
│   ├── services/
│   │   ├── lead_service.py              # create_lead(), get_leads(), get_lead_by_id(), get_stats()
│   │   └── log_service.py              # create_log(), get_logs()
│   ├── agents/
│   │   └── lead_hunter/
│   │       ├── agent.py                 # LeadHunterBase Protocol + FakeLeadHunter + GemmaLeadHunter
│   │       ├── prompts/
│   │       │   └── system_prompt.txt
│   │       └── schemas/
│   │           └── output.py            # LeadHunterOutput Pydantic model (with range validators)
│   ├── routes/
│   │   ├── leads.py                     # POST /api/analyze, GET /api/leads, GET /api/leads/{id}, GET /api/stats
│   │   ├── logs.py                      # GET /api/logs
│   │   └── settings.py                  # GET /api/settings, PATCH /api/settings
│   ├── tests/
│   │   ├── test_services.py             # Unit tests for lead_service + log_service
│   │   └── test_agent.py                # Unit tests for FakeLeadHunter + GemmaLeadHunter
│   └── requirements.txt
```

---

## TypeScript Interfaces (Frontend Contract)

File: `src/types/index.ts` — **must be created in Phase B Step 8 before any page is written.**

```typescript
export interface Lead {
  id: string;
  raw_content: string;
  intent: 'hire' | 'opinion' | 'promotion' | 'other';
  service_required: string | null;
  platform: string | null;
  lead_score: number;          // 0–10 integer
  lead_quality: 'low' | 'medium' | 'high';
  confidence: number;          // 0.0–1.0 float
  reasoning: string[];         // parsed from JSON — always array, never string
  status: 'NEW' | 'QUALIFIED' | 'DISQUALIFIED';
  created_at: string;          // ISO 8601 UTC
}

export interface Log {
  id: number;
  timestamp: string;           // ISO 8601 UTC
  event: string;               // named event constant
  lead_id: string | null;
  details: string;             // JSON string — parse before display if needed
}

export interface Stats {
  total: number;
  qualified: number;
  rejected: number;
}

export interface AnalyzeRequest {
  content: string;
}

export interface AnalyzeResponse {
  lead: Lead;
}

export interface SettingsPayload {
  ollama_url: string;
  model_name: string;
  score_threshold: number;     // 0–10
}
```

---

## Backend Contracts

### API Endpoints (complete list)

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/analyze` | Run Lead Hunter → validate → save → return lead |
| `GET` | `/api/leads` | List leads (`?limit=50&offset=0`) |
| `GET` | `/api/leads/{id}` | Single lead detail |
| `GET` | `/api/stats` | `{ total, qualified, rejected }` aggregate counts |
| `GET` | `/api/logs` | List log events (`?limit=100&offset=0`) |
| `GET` | `/api/settings` | Read current runtime config |
| `PATCH` | `/api/settings` | Update Ollama URL, model name, or score threshold |

### requirements.txt (pinned)
```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
pydantic==2.7.1
httpx==0.27.0
```

### LeadHunterOutput Schema (Pydantic — with range validators)
```python
from pydantic import BaseModel, Field
from typing import Literal

class LeadHunterOutput(BaseModel):
    intent: Literal["hire", "opinion", "promotion", "other"]
    service_required: str | None = None
    platform: str | None = None
    lead_score: int = Field(ge=0, le=10)        # range enforced, not just type
    lead_quality: Literal["low", "medium", "high"]
    confidence: float = Field(ge=0.0, le=1.0)   # range enforced
    reasoning: list[str]
```

### LeadHunterBase Protocol (agent interface contract)
```python
from typing import Protocol

class LeadHunterBase(Protocol):
    def analyze(self, content: str) -> dict: ...

class FakeLeadHunter(LeadHunterBase):
    def analyze(self, content: str) -> dict:
        return {
            "intent": "hire",
            "service_required": "character_artist",
            "platform": "UEFN",
            "lead_score": 8,
            "lead_quality": "high",
            "confidence": 0.95,
            "reasoning": ["Fake agent — plumbing test", "Replace with Gemma in Phase C"]
        }

class GemmaLeadHunter(LeadHunterBase):    # Phase C only
    def analyze(self, content: str) -> dict: ...
```

### DB Session Pattern (FastAPI Depends)
```python
# database/engine.py
from sqlalchemy.orm import Session

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# In every route:
# db: Session = Depends(get_db)
# Service functions receive `db` as parameter
```

### CORS Configuration (main.py)
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type"],
)
```

### reasoning Field: Serialization Contract
`lead_service.py::create_lead()` MUST call `json.dumps(data.reasoning)` before writing to DB.
`lead_service.py::get_lead_by_id()` MUST call `json.loads(row.reasoning)` when reading back.
The Pydantic `LeadResponse` schema declares `reasoning: list[str]` (not `str`).

### Frontend API Base URL
```
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```
```typescript
// services/api.ts
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
```
All fetch calls import from `BASE_URL`. Never hardcode `localhost:8000` in a page.

---

## Database Schema

### `leads` table
```sql
CREATE TABLE leads (
    id              TEXT PRIMARY KEY,          -- UUID string
    content_hash    TEXT NOT NULL UNIQUE,      -- MD5(raw_content.strip().lower()) — deduplication index
    raw_content     TEXT NOT NULL,
    intent          TEXT NOT NULL,             -- hire | opinion | promotion | other
    service_required TEXT,
    platform        TEXT,
    lead_score      INTEGER NOT NULL,          -- 0 to 10
    lead_quality    TEXT NOT NULL,             -- low | medium | high
    confidence      REAL NOT NULL,             -- 0.0 to 1.0
    reasoning       TEXT NOT NULL,             -- JSON array: json.dumps(list[str])
    status          TEXT NOT NULL DEFAULT 'NEW', -- NEW | QUALIFIED | DISQUALIFIED
    created_at      TEXT NOT NULL              -- ISO 8601 UTC
);
```

### `logs` table
```sql
CREATE TABLE logs (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,               -- ISO 8601 UTC
    event     TEXT NOT NULL,               -- named event constant (see below)
    lead_id   TEXT,                        -- nullable FK to leads.id
    details   TEXT NOT NULL               -- always a JSON string: json.dumps({...})
);
```

### Named Log Events (complete list)
| Event | Trigger |
|-------|---------|
| `LEAD_RECEIVED` | On POST /api/analyze, immediately after input validation passes |
| `LEAD_QUALIFIED` | When `intent == 'hire' AND lead_score >= threshold` |
| `LEAD_DISQUALIFIED` | When lead does not meet qualification criteria |
| `VALIDATION_ERROR` | When Pydantic rejects agent output |
| `DUPLICATE_DETECTED` | When `content_hash` already exists in DB |
| `OLLAMA_UNAVAILABLE` | When Ollama connection fails (ConnectionError or TimeoutError) |

---

## Lead Lifecycle

```
User Paste (min 10 chars after strip)
    │
    ▼  ← 400 if input too short
POST /api/analyze
    │
    ├──► Log: LEAD_RECEIVED
    │
    ├── content_hash check (MD5 of stripped+lowercased content)
    │     ├── hash EXISTS → Log: DUPLICATE_DETECTED → return existing lead (200)
    │     └── hash NEW → continue
    │
    ▼
Lead Hunter Agent
    ├── Phase A/B: FakeLeadHunter (hardcoded output)
    └── Phase C:   GemmaLeadHunter (Ollama call, timeout=30s)
                      └── ConnectionError/TimeoutError → Log: OLLAMA_UNAVAILABLE → 503
    │
    ▼
Pydantic Validation (LeadHunterOutput)
    ├── INVALID → Log: VALIDATION_ERROR → return 422 (no DB write)
    └── VALID → continue
    │
    ▼
Determine Status:
    intent == 'hire' AND lead_score >= score_threshold → QUALIFIED
    otherwise → DISQUALIFIED
    │
    ├──► Log: LEAD_QUALIFIED or LEAD_DISQUALIFIED
    │
    ▼
Lead Service → json.dumps(reasoning) → save to leads table
    │
    ▼
Return LeadResponse JSON to frontend
```

---

## Failure Scenarios & Mitigations

| Failure | Mitigation |
|---------|------------|
| **LLM returns malformed JSON** | Pydantic validation catches it. Log `VALIDATION_ERROR`. Return 422. No DB write. |
| **LLM returns out-of-range values** | `Field(ge=0, le=10)` and `Field(ge=0.0, le=1.0)` reject `lead_score: 15` or `confidence: 1.7`. |
| **Duplicate lead submitted** | MD5 hash in `content_hash UNIQUE` column. DB constraint + service-layer check. Log `DUPLICATE_DETECTED`. Return existing lead. |
| **Ollama unreachable** | Catch `ConnectionError` AND `TimeoutError` (timeout=30s). Log `OLLAMA_UNAVAILABLE`. Return 503. |
| **Ollama too slow** | `httpx.AsyncClient(timeout=30.0)` — times out after 30s, treated same as unreachable. |
| **Empty / too-short content** | `len(raw_content.strip()) > 10` before calling agent. Return 400. |
| **reasoning stored as Python repr** | `lead_service.create_lead()` MUST call `json.dumps()`. Documented in service layer contract. |

---

## Leads Page: State Management

The `leads/page.tsx` is a **Client Component** (`"use client"`).

```typescript
const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
```

- Left panel: maps `leads[]` → renders `<LeadCard>` for each. Click calls `setSelectedLead(lead)`.
- Right panel: renders `<LeadDetail lead={selectedLead} />`. Shows placeholder if `selectedLead === null`.
- No page reload on click. Zero backend calls on panel switch — data already in state from initial `GET /api/leads`.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                 Next.js Frontend (3000)                     │
│                                                             │
│  Dashboard    Leads (list+detail)   Logs     Agents  Settings│
│  /api/stats   /api/leads            /api/logs /api/stats /api/settings│
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP JSON (fetch via api.ts)
                           │ BASE_URL = NEXT_PUBLIC_API_URL
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  FastAPI Backend (8000)                     │
│  CORS: allow_origins=["http://localhost:3000"]              │
│                                                             │
│  POST /api/analyze → Lead Hunter → Pydantic → DB → Return  │
│  GET  /api/leads   → lead_service.get_leads(limit, offset)  │
│  GET  /api/leads/{id} → lead_service.get_lead_by_id()      │
│  GET  /api/stats   → lead_service.get_stats()              │
│  GET  /api/logs    → log_service.get_logs(limit, offset)   │
│  GET  /api/settings → config.py → settings.json            │
│  PATCH /api/settings → write to settings.json              │
│                                                             │
│  DB Session: every route uses Depends(get_db)              │
│  Services: all DB access goes through service layer ONLY   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │             SQLite Database (jenny.db)             │    │
│  │  leads (+ content_hash UNIQUE)  |  logs (+ lead_id)│    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Settings Persistence

Settings are stored in `backend/settings.json` (mutable at runtime):
```json
{
  "ollama_url": "http://localhost:11434",
  "model_name": "gemma3:4b",
  "score_threshold": 7
}
```

`config.py` reads this file on every request (or caches with TTL). `PATCH /api/settings` writes a new `settings.json`. No server restart required. Settings page POSTs `SettingsPayload` and shows a success toast on 200.

---

## The 3-Phase Build Order

---

### PHASE A — Plumbing (No AI, No UI)
> Goal: Full backend pipeline proven with fake data via curl. Phase B does NOT start until Phase A Gate passes.

| Step | Build | Verify Command (exact — run this before next step) |
|------|-------|--------------------------------------------------|
| **1** | Create folder structure: `backend/`, `frontend/` skeletons. `requirements.txt` with pinned versions. | `dir "f:\Ai Agency Jenny OS\backend"` — folders exist |
| **2** | `FastAPI` app + CORS + `database/engine.py` (engine, `SessionLocal`, `get_db()`) + `models.py` (Lead, Log) + table auto-creation on startup | `cd backend && python main.py` — `jenny.db` created, tables visible via `sqlite3 jenny.db ".tables"` |
| **3** | `LeadHunterOutput` Pydantic model in `agents/lead_hunter/schemas/output.py` (with `Field(ge=0, le=10)`, `Field(ge=0.0, le=1.0)`) | `python -c "from agents.lead_hunter.schemas.output import LeadHunterOutput; m = LeadHunterOutput(intent='hire', lead_score=9, lead_quality='high', confidence=0.92, reasoning=['test']); print(m.model_dump())"` — prints dict without error |
| **4** | `LeadHunterBase` Protocol + `FakeLeadHunter` class in `agents/lead_hunter/agent.py` | `python -c "from agents.lead_hunter.agent import FakeLeadHunter; import json; print(json.dumps(FakeLeadHunter().analyze('test'), indent=2))"` — prints hardcoded JSON |
| **5** | `lead_service.py` + `log_service.py` (create, read functions) | `cd backend && python -m pytest tests/test_services.py -v` — all tests pass |
| **6** | `POST /api/analyze` route — calls `FakeLeadHunter` → validates → saves lead → saves log → returns JSON. `GET /api/stats` route. | `curl -X POST http://localhost:8000/api/analyze -H "Content-Type: application/json" -d "{\"content\":\"Looking for a UEFN character artist. Budget $500.\"}" \| python -m json.tool` — HTTP 200, JSON has `intent`, `lead_score`, `confidence`, `status` fields |
| **7** | `GET /api/leads?limit=50&offset=0`, `GET /api/leads/{id}`, `GET /api/logs?limit=100&offset=0`, `GET /api/settings`, `PATCH /api/settings` routes | `curl http://localhost:8000/api/leads \| python -m json.tool` — array with ≥1 lead. `curl http://localhost:8000/api/logs \| python -m json.tool` — array with ≥2 events (LEAD_RECEIVED + LEAD_QUALIFIED/DISQUALIFIED) |

**🔴 PHASE A GATE — Must pass ALL 3 before Step 8:**
```bash
# Gate 1: analyze returns full JSON
curl -X POST http://localhost:8000/api/analyze -H "Content-Type: application/json" -d "{\"content\":\"Need a UEFN character artist\"}" | python -m json.tool

# Gate 2: leads list has at least 1 entry
curl http://localhost:8000/api/leads | python -m json.tool

# Gate 3: logs has at least 2 events (LEAD_RECEIVED + LEAD_QUALIFIED or DISQUALIFIED)
curl http://localhost:8000/api/logs | python -m json.tool
```
**If any gate fails → fix before writing a single frontend file.**

---

### PHASE B — Connect the UI
> Goal: Every frontend page shows real data from the working API. Types are locked before pages are written.

| Step | Build | Verify |
|------|-------|--------|
| **8** | Next.js init + Tailwind + `.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:8000` + `src/types/index.ts` with all interfaces | `npm run dev` — dev server starts on port 3000. `types/index.ts` exists. |
| **9** | Global layout (`layout.tsx` as Server Component + `SidebarClient.tsx` as `"use client"`) + topbar | Browser: sidebar shows exactly 5 links: Dashboard, Agents, Leads, Logs, Settings |
| **10** | `services/api.ts` — all fetch wrappers using `BASE_URL` | `curl http://localhost:3000` — page loads (or check that api.ts compiles without errors) |
| **11** | Leads page (`"use client"`) — `IntakeForm` → POST `/api/analyze` → display JSON result below form | Browser: paste text → click Analyze → JSON appears. No browser console errors. |
| **12** | Leads page — `LeadCard` list (left panel) + `LeadDetail` panel (right, `useState`) | Browser: click a lead in the list → right panel updates with intent, score, confidence, reasoning bullets. Zero page reload. |
| **13** | Dashboard — `StatCard` × 3 from `GET /api/stats` + Recent Activity feed from `GET /api/logs` | Browser: submit a lead → dashboard counts update correctly. Activity feed shows latest events. |
| **14** | Logs page — table from `GET /api/logs?limit=100` + `loading.tsx` + `error.tsx` | Browser: logs table shows timestamp, event name, details. Loading skeleton appears briefly. |
| **15** | Agents page — static `Lead Hunter` card metadata + `leads_analyzed` count from `GET /api/stats` | Browser: card shows model as `gemma3:4b`, status as ONLINE, count from stats API. |
| **16** | Settings page — form (Ollama URL, model name, score threshold) → `PATCH /api/settings` → success toast | Browser: change threshold → save → backend reads new value on next analyze call. |

**✅ Phase B Done When:** Paste text in Leads form → JSON appears → lead in list → click lead → detail panel updates → dashboard counts reflect it → logs show events. Full demo works end-to-end with fake agent.

---

### PHASE C — Swap in Gemma (After full pipeline proven)
> Goal: Replace the fake stub with `gemma3:4b` via Ollama. Zero other changes.

| Step | Build | Verify |
|------|-------|--------|
| **17** | Install Ollama + `ollama pull gemma3:4b` | `ollama run gemma3:4b "Hello"` — model responds |
| **18** | `GemmaLeadHunter` class — calls Ollama via `httpx`, parses JSON response, returns `LeadHunterOutput`-compatible dict. Timeout = 30s. | `cd backend && python -m pytest tests/test_agent.py::test_gemma_returns_valid_output -v` — passes. OR: `python -c "from agents.lead_hunter.agent import GemmaLeadHunter; import json; print(json.dumps(GemmaLeadHunter().analyze('Need a UEFN character artist. Budget \$500.'), indent=2))"` — valid dict with all fields |
| **19** | Swap `FakeLeadHunter` → `GemmaLeadHunter` in `POST /api/analyze` route (one line) | `curl -X POST http://localhost:8000/api/analyze -H "Content-Type: application/json" -d "{\"content\":\"Looking for a UEFN character artist. Budget \$500. DM me.\"}" \| python -m json.tool` — returns real JSON with `intent: hire`, real lead_score, real reasoning bullets |
| **20** | Tune system prompt if needed. Test 10 varied inputs. | All 10 return valid `LeadHunterOutput`. `confidence` is always 0.0–1.0. `lead_score` is always 0–10. |

**✅ Phase C Done When:** Real text → real AI → real JSON → stored in DB → visible in UI. 

---

## UI Design Rules

- **Theme:** Dark mode first. No light mode for Phase 1.
- **Colors:** Neutral dark backgrounds. Blue/cyan accents only. **No purple, no violet.**
- **Inspiration:** Linear, Notion, Cursor
- **Typography:** Inter (Google Fonts)
- **Leads Page:** Discord-style two-panel. Left: scrollable list with score badge + intent tag + date. Right: sticky detail panel with all fields + reasoning bullets.
- **Dashboard:** 3 large stat cards (Total / Qualified / Rejected). Below: recent activity feed from logs.
- **Model Label:** Always display as `gemma3:4b` (Ollama tag). Not "Gemma 4 E4B".

---

## Future Expansion (Design-Only — Not Built in Phase 1)

| Future Feature | Extension Point |
|----------------|----------------|
| Outreach Agent | Reads `QUALIFIED` leads, sends to external API — zero route changes |
| Scheduler Agent | Same DB, reads `QUALIFIED` leads, creates calendar events |
| Auto-scrapers | POST to `/api/analyze` from cron — zero route changes |
| PostgreSQL migration | Change `DATABASE_URL` in `config.py`. SQLAlchemy models unchanged. |
| Multi-agent orchestrator | New `tasks` table + orchestrator router. Existing agents untouched. |

---

## Phase X: Final Verification Checklist

- [ ] `POST /api/analyze` returns valid JSON for any text input ≥10 chars
- [ ] Input ≤10 chars returns 400
- [ ] Pydantic rejects `lead_score: 15` with 422 (not saved to DB)
- [ ] Pydantic rejects `confidence: 1.7` with 422 (not saved to DB)
- [ ] Duplicate detection: second submit of same text returns existing lead (200, not 422)
- [ ] `DUPLICATE_DETECTED` log event appears in logs table
- [ ] `LEAD_QUALIFIED` or `LEAD_DISQUALIFIED` appears correctly based on intent + score
- [ ] `reasoning` column in DB stores valid JSON string (not Python repr)
- [ ] `GET /api/leads` returns `reasoning` as `string[]` (not raw string)
- [ ] Dashboard counts are accurate after submitting leads
- [ ] Lead list left panel and Lead Detail right panel switch without page reload
- [ ] Logs page shows all 6 named event types correctly
- [ ] Settings: change score threshold → next analyze call uses new threshold
- [ ] Ollama down → 503 returned, `OLLAMA_UNAVAILABLE` logged, UI shows error
- [ ] No purple/violet colors anywhere in UI
- [ ] `NEXT_PUBLIC_API_URL` env variable used — not a hardcoded `localhost:8000` string
- [ ] Run: `python .agents/scripts/checklist.py .`
