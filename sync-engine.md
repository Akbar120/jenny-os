# Autonomous Full-Sweep Sync Engine — Implementation Plan

> **File:** `sync-engine.md`
> **Date:** 2026-06-18
> **Agent:** project-planner + backend-specialist

---

## What We're Building (Plain Language)

```
User sets up Mission
  └── Adds subreddits / communities / channels
  └── Sets keywords

Agent runs ONE FULL SWEEP:
  └── Source 1 (r/gamedev)    → fetch → score → store qualified
  └── Source 2 (r/forhire)    → fetch → score → store qualified
  └── Source 3 (r/uefn)       → fetch → score → store qualified
  └── ...all sources done...
  └── RUN COMPLETE ✅

Next run:
  └── Manual trigger by user (Run Now button)
  OR
  └── Auto next day (24h later) if mission still active
```

**Key Rules:**
- One run = ALL sources for ALL active missions — nothing partial
- Speed: sequential per-source but no unnecessary delays
- Quality: zero missed leads — content-hash deduplication, retry on 429
- Future-proof: Reddit now, Twitter/LinkedIn/Discord later — plug-in connector model

---

## Project Type: BACKEND + WEB (Full Stack)

---

## Success Criteria

- [ ] `POST /api/runs/trigger` starts a full sweep across all active mission sources
- [ ] Run has a lifecycle: `IDLE → RUNNING → COMPLETED | FAILED`
- [ ] Each source is processed one-by-one in the run queue
- [ ] Run stores: started_at, completed_at, total_sources, leads_found, leads_qualified
- [ ] Auto-schedule: next run fires 24h after last completed run (if mission active)
- [ ] Frontend shows: Run status (IDLE/RUNNING/DONE), last run time, leads found count
- [ ] `GET /api/leads?status=QUALIFIED` returns only qualified leads (already exists ✅)
- [ ] No lead duplication across runs (content_hash check already in place ✅)

---

## Current State (Honest Audit)

| Component | Status | Note |
|-----------|--------|------|
| `sync_source(db, source_id)` | ✅ EXISTS | Works perfectly — scores & stores leads |
| `MissionBasedLeadHunter.analyze()` | ✅ EXISTS | Scoring engine complete |
| Content-hash deduplication | ✅ EXISTS | No duplicate leads |
| `GET /leads?status=QUALIFIED` | ✅ EXISTS | Filter already works |
| `GET /stats` | ✅ EXISTS | Stats endpoint exists |
| Full sweep orchestrator | ❌ MISSING | Need `SyncRun` model + runner |
| Run lifecycle tracking | ❌ MISSING | No `SyncRun` DB table |
| Auto 24h schedule | ❌ MISSING | No APScheduler |
| Manual "Run Now" endpoint | ❌ MISSING | `POST /api/runs/trigger` |
| Frontend run status panel | ❌ MISSING | Shows IDLE/RUNNING/DONE |

---

## Architecture Design

### New DB Model: `SyncRun`

```python
class SyncRun(Base):
    __tablename__ = "sync_runs"

    id            # UUID - unique run ID
    mission_id    # Which mission this run belongs to (NULL = all missions)
    status        # "IDLE" | "RUNNING" | "COMPLETED" | "FAILED"
    triggered_by  # "MANUAL" | "SCHEDULER"
    started_at    # ISO timestamp
    completed_at  # ISO timestamp (NULL while running)
    total_sources # int - how many sources were in queue
    sources_done  # int - how many completed so far (live progress)
    leads_found   # int - total posts fetched
    leads_qualified # int - how many scored as QUALIFIED
    leads_skipped   # int - duplicates skipped
    error_summary # JSON string - errors per source if any
```

### New Service: `backend/services/run_service.py`

```python
def trigger_full_sweep(db, triggered_by="MANUAL") -> SyncRun:
    """
    Creates a SyncRun record, then processes each active source
    one-by-one. Updates progress in real-time. Marks COMPLETED when done.
    
    Flow:
    1. Check no run is already RUNNING (prevent double-run)
    2. Create SyncRun(status=RUNNING, started_at=now)
    3. Get all active missions
    4. For each mission → get all active sources
    5. For each source → call sync_source(db, source.id)
    6. Update run.sources_done += 1 after each source
    7. Aggregate totals into SyncRun
    8. Mark COMPLETED + set completed_at
    """
```

### Scheduler: `backend/scheduler.py`

```python
# Runs 24h after last completed run, only if mission is active
# Uses APScheduler AsyncIOScheduler
# Job: check if 24h passed since last completed run → trigger sweep
# Does NOT fire if a run is already RUNNING
```

---

## File Changes

```
backend/
  database/
    models.py            [MODIFY] Add SyncRun model
  services/
    run_service.py       [NEW] Full sweep orchestrator
  scheduler.py           [NEW] APScheduler — 24h auto-run
  routes/
    runs.py              [NEW] POST /runs/trigger, GET /runs, GET /runs/current
  main.py                [MODIFY] Register runs router + start scheduler in lifespan

frontend/
  app/
    leads/
      page.tsx           [MODIFY] Default QUALIFIED filter + show run status bar
    components/
      RunStatusBar.tsx   [NEW] Shows IDLE/RUNNING/DONE + progress + last run time
      LeadCard.tsx       [MODIFY] Make clickable → opens full detail
      LeadDetailPanel.tsx [NEW] Full lead detail: body, score, reasoning, Reddit link
```

---

## Task Breakdown

---

### PHASE 1 — SyncRun DB Model (P0)

#### Task 1.1 — Add `SyncRun` to `models.py`
- **Agent:** `backend-specialist`
- **Skill:** `database-design`
- **Dependencies:** None
- **INPUT:** `backend/database/models.py`
- **OUTPUT:** `SyncRun` table with all columns above
- **VERIFY:** `Base.metadata.create_all()` creates `sync_runs` table in jenny.db

---

### PHASE 2 — Run Service (P0)

#### Task 2.1 — Create `backend/services/run_service.py`
- **Agent:** `backend-specialist`
- **Dependencies:** Task 1.1
- **INPUT:** `sync_source()` from source_service, `SyncRun` model
- **OUTPUT:** `run_service.py` with:
  - `trigger_full_sweep(db, triggered_by)` — main orchestrator
  - `get_current_run(db)` — returns the currently RUNNING run or None
  - `get_run_history(db, limit=10)` — last N completed runs
  - `get_last_completed_run(db)` — for scheduler to check 24h timing

```python
# Core logic shape:
def trigger_full_sweep(db, triggered_by="MANUAL"):
    # Guard: don't start if already running
    if get_current_run(db):
        raise ValueError("A sync is already in progress.")
    
    # Create run record
    run = SyncRun(status="RUNNING", triggered_by=triggered_by, ...)
    db.add(run); db.commit()
    
    # Get all active missions + their active sources
    missions = db.query(Mission).filter(Mission.is_active == True).all()
    all_sources = []
    for mission in missions:
        sources = db.query(Source).filter(
            Source.mission_id == mission.id,
            Source.is_active == True
        ).all()
        all_sources.extend(sources)
    
    run.total_sources = len(all_sources)
    db.commit()
    
    total_found = 0
    total_qualified = 0
    total_skipped = 0
    errors = {}
    
    # Process each source in queue
    for source in all_sources:
        result = source_service.sync_source(db, source.id)
        total_found += result["added"] + result["skipped"]
        total_qualified += result["added"]
        total_skipped += result["skipped"]
        if result["errors"]:
            errors[source.id] = result["errors"]
        run.sources_done += 1
        db.commit()  # live progress update
    
    # Mark complete
    run.status = "COMPLETED"
    run.completed_at = now()
    run.leads_found = total_found
    run.leads_qualified = total_qualified
    run.leads_skipped = total_skipped
    run.error_summary = json.dumps(errors)
    db.commit()
    return run
```

- **VERIFY:** Call `trigger_full_sweep(db)` → SyncRun record created in DB with status COMPLETED

---

#### Task 2.2 — Make sweep run in background thread
- **Agent:** `backend-specialist`
- **Dependencies:** Task 2.1
- **OUTPUT:** `trigger_full_sweep` runs in `asyncio.to_thread()` so API doesn't block
- **VERIFY:** `POST /api/runs/trigger` returns immediately with run ID, sweep happens in background

---

### PHASE 3 — Run API Routes (P1)

#### Task 3.1 — Create `backend/routes/runs.py`
- **Agent:** `backend-specialist`
- **Dependencies:** Task 2.1, 2.2
- **INPUT:** `run_service.py`
- **OUTPUT:**

```
POST /api/runs/trigger       → starts full sweep, returns { run_id, status }
GET  /api/runs/current       → returns current RUNNING run (or null)
GET  /api/runs               → last 10 completed runs
GET  /api/runs/{run_id}      → single run details
```

- **VERIFY:** All 4 endpoints return correct data via /docs

---

#### Task 3.2 — Register runs router in `main.py`
- **Agent:** `backend-specialist`
- **OUTPUT:** `app.include_router(runs.router)` added
- **VERIFY:** `/api/runs` accessible in browser

---

### PHASE 4 — Scheduler (P1)

#### Task 4.1 — Install APScheduler
- **Agent:** `backend-specialist`
- **INPUT:** `backend/requirements.txt`
- **OUTPUT:** `apscheduler>=3.10.4` added and installed
- **VERIFY:** `python -c "from apscheduler.schedulers.asyncio import AsyncIOScheduler"`

---

#### Task 4.2 — Create `backend/scheduler.py`
- **Agent:** `backend-specialist`
- **Dependencies:** Task 4.1, Task 2.1
- **OUTPUT:** `scheduler.py` with logic:
  - Check every hour if 24h has passed since last `COMPLETED` run
  - If yes AND no run is `RUNNING` AND at least 1 mission is active → trigger sweep
  - Uses `AsyncIOScheduler` with `IntervalTrigger(hours=1)`
  - Logs `SCHEDULER_TRIGGERED` event

```python
# scheduler.py shape
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

scheduler = AsyncIOScheduler()

async def check_and_run():
    db = next(get_db())
    last_run = run_service.get_last_completed_run(db)
    if last_run:
        hours_since = (now() - last_run.completed_at).total_seconds() / 3600
        if hours_since < 24:
            return  # Not time yet
    # No previous run OR 24h passed
    if run_service.get_current_run(db):
        return  # Already running
    active_missions = db.query(Mission).filter(Mission.is_active == True).count()
    if active_missions == 0:
        return  # Nothing to scan
    await asyncio.to_thread(run_service.trigger_full_sweep, db, "SCHEDULER")

scheduler.add_job(check_and_run, IntervalTrigger(hours=1))
```

---

#### Task 4.3 — Wire scheduler into `main.py` lifespan
- **Agent:** `backend-specialist`
- **OUTPUT:**
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    scheduler.start()
    yield
    scheduler.shutdown()
```
- **VERIFY:** Scheduler starts on boot, logs appear in terminal

---

### PHASE 5 — Frontend Run Status (P2)

#### Task 5.1 — `RunStatusBar` component
- **Agent:** `frontend-specialist`
- **Skill:** `frontend-design`
- **Dependencies:** Task 3.1
- **OUTPUT:** Compact bar at top of Leads page showing:
  - 🟡 **RUNNING** — "Scanning 3 / 9 sources..." (live polling)
  - 🟢 **COMPLETED** — "Last run: 2 hours ago · 4 qualified leads found"
  - ⚫ **IDLE** — "No scans yet · Run Now →"
  - 🔴 **FAILED** — "Last run failed · Retry →"
- **Polling:** `GET /api/runs/current` every 5 seconds while RUNNING, every 60s when idle
- **VERIFY:** Status updates correctly as run progresses

---

#### Task 5.2 — "Run Now" button
- **Agent:** `frontend-specialist`
- **Dependencies:** Task 3.1, Task 5.1
- **OUTPUT:** Button that calls `POST /api/runs/trigger`, disables while RUNNING
- **VERIFY:** Click → button disables → status bar shows RUNNING → re-enables on COMPLETE

---

#### Task 5.3 — `LeadDetailPanel` component
- **Agent:** `frontend-specialist`
- **OUTPUT:** Right-side panel when lead is clicked showing:
  - Post title (large, bold)
  - Score badge: `🟢 9/10 QUALIFIED` or `🔴 2/10 DISQUALIFIED`
  - Reasoning bullets: exactly why it was scored this way
  - Author + subreddit pill
  - Platform badge (Reddit / Twitter / Discord)
  - Full post body (scrollable)
  - "Open on Reddit ↗" button
  - "Archive" button
- **VERIFY:** Panel opens on lead click with correct data

---

#### Task 5.4 — Update Leads page default filter
- **Agent:** `frontend-specialist`
- **OUTPUT:**
  - Default tab = "Qualified" (not All)
  - Tab bar: `Qualified (4) | All (27) | Archived`
  - Empty state when no qualified: "🔍 Agent is scanning... Run Now to get started"
- **VERIFY:** Page loads showing only QUALIFIED leads

---

## Connector Extensibility (Future-Proof)

Current connector interface:
```python
class BaseConnector:
    def fetch(self, config: dict) -> list[RawLead]: ...
```

Future connectors just implement this interface:
- `TwitterConnector` → tweets matching keywords
- `LinkedInConnector` → posts/jobs
- `DiscordConnector` → messages in monitored servers
- `IndeedConnector` → job postings

**Run service already handles this** — it iterates all sources by `source_type` and calls the right connector. Just add a new connector file and register it in `sync_source()`.

---

## Implementation Order

```
1.1 (SyncRun model)
  ↓
2.1 (run_service — trigger_full_sweep)
2.2 (background thread)
  ↓
3.1 (runs API routes)
3.2 (register router)
  ↓
4.1 (install APScheduler)
4.2 (scheduler.py)
4.3 (wire into main.py)
  ↓ (parallel with above)
5.1 (RunStatusBar)
5.2 (Run Now button)
5.3 (LeadDetailPanel)
5.4 (Leads page filter)
```

**Estimated time:** 3-4 hours

---

## Phase X — Verification

```bash
# 1. APScheduler installed
python -c "from apscheduler.schedulers.asyncio import AsyncIOScheduler; print('ok')"

# 2. SyncRun table exists
python -c "from backend.database.models import SyncRun; print('ok')"

# 3. Manual trigger works
curl -X POST http://localhost:8000/api/runs/trigger

# 4. Current run shows progress
curl http://localhost:8000/api/runs/current

# 5. Run completes
curl http://localhost:8000/api/runs/1

# 6. Qualified leads appear
curl "http://localhost:8000/api/leads?status=QUALIFIED"

# 7. Frontend
# Open localhost:3000/leads
# → Status bar shows last run info
# → Default tab = Qualified
# → Click a lead → detail panel opens
# → Click "Run Now" → status bar switches to RUNNING
```

---

*[OK] Plan created: sync-engine.md*
