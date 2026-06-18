# Autonomous Lead Hunter — Implementation Plan

> **Goal:** Agent automatically hunts, scores, and presents only qualified leads — zero manual clicks.

---

## Overview

Currently `sync_source` must be called manually from the UI ("Sync Now" button).
The scoring engine (`MissionBasedLeadHunter`) already works correctly — it just needs to run automatically on a schedule and surface only qualified leads in a clean dashboard.

**What we're building:**
1. **Background Scheduler** — auto-syncs all active sources every N minutes
2. **Auto-Run on Startup** — immediate scan when backend boots
3. **Qualified Leads Only View** — dashboard shows ONLY `QUALIFIED` leads with full details
4. **Notification Badge** — UI shows new lead count without refresh
5. **Lead Detail Panel** — full post content, score breakdown, Reddit link, author info

---

## Project Type: BACKEND + WEB (Full Stack)

---

## Success Criteria

- [ ] Sources sync automatically every 15 minutes — no user click needed
- [ ] Only `QUALIFIED` leads (intent=hire, score >= threshold) shown by default
- [ ] Each lead shows: title, subreddit, author, score, reasoning, full body, Reddit link
- [ ] New lead count badge visible in UI nav
- [ ] Logs show scheduler activity (SCHEDULER_SYNC_STARTED, SCHEDULER_SYNC_DONE)

---

## Current Architecture (What Exists)

```
backend/
  services/
    source_service.py      - sync_source() works — just not called automatically
    intelligence_service.py - keyword gen, community discovery
    lead_service.py         - create_lead() works
    log_service.py          - logging works
  agents/
    lead_hunter/agent.py   - MissionBasedLeadHunter — scores leads correctly
  routes/
    sources.py             - POST /sources/{id}/sync — manual trigger only
    leads.py               - GET /leads — returns all leads (no filter)
  main.py                  - No scheduler — needs APScheduler
frontend/
  app/
    leads/page.tsx         - Shows all leads — needs QUALIFIED filter + detail panel
    dashboard/page.tsx     - No live badge or stats
```

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Scheduler | APScheduler (AsyncIOScheduler) | Lightweight, FastAPI-compatible |
| Background Tasks | FastAPI lifespan context | Clean startup/shutdown |
| Lead Polling | 30s frontend polling | Simple, no WebSocket overhead |
| UI State | React useState + useEffect | Already used in codebase |

---

## File Changes

```
backend/
  scheduler.py            [NEW] APScheduler setup + auto-sync job
  main.py                 [MODIFY] Add lifespan with scheduler start/stop
  routes/
    leads.py              [MODIFY] Add ?status=QUALIFIED filter + /leads/stats
frontend/
  app/
    leads/page.tsx        [MODIFY] Default filter QUALIFIED + lead detail panel
    components/
      LeadDetailPanel.tsx [NEW] Full detail view for a lead
      NavBadge.tsx        [NEW] Live new-leads badge in sidebar
```

---

## Task Breakdown

### PHASE 1 — Backend Scheduler

**Task 1.1** — Install APScheduler
- INPUT: requirements.txt
- OUTPUT: apscheduler installed
- VERIFY: `python -c "from apscheduler.schedulers.asyncio import AsyncIOScheduler"`

**Task 1.2** — Create `backend/scheduler.py`
- Runs `sync_all_active_sources()` every 15 minutes
- Fetches all active sources from DB sequentially
- Logs SCHEDULER_SYNC_STARTED and SCHEDULER_SYNC_DONE

**Task 1.3** — Wire into `main.py` lifespan
- Scheduler starts on app boot, stops on shutdown
- First run triggers immediately (within 5s of startup)

**Task 1.4** — Add `GET /leads/stats` endpoint
- Returns: `{ total, qualified, new_today, disqualified }`

**Task 1.5** — Add `?status=` filter to `GET /leads`
- `GET /leads?status=QUALIFIED` returns only qualified leads

---

### PHASE 2 — Frontend Qualified Dashboard

**Task 2.1** — LeadDetailPanel component
- Score badge (green >=7, yellow 4-6, red <4)
- Reasoning bullets
- Author, subreddit, full body
- "Open on Reddit" + "Archive" buttons

**Task 2.2** — Update Leads page
- Default tab = "Qualified" (not "All")
- Tab switcher: Qualified | All | Archived
- Click lead = opens LeadDetailPanel
- Empty state: "No qualified leads yet — agent is scanning..."

**Task 2.3** — Nav badge (polls /leads/stats every 30s)

**Task 2.4** — Scheduler status pill in Sources page
- "Next sync in 12 min" or "Sync failed"

---

### PHASE 3 — First Run Trigger

**Task 3.1** — Immediate sync on startup (no waiting 15 min for first results)

---

## Open Questions

1. **Sync interval?** 15 min default — OK, or faster (5 min)?
2. **Reddit API credentials?** Without OAuth, rate limits hit fast with many sources
3. **Warm leads tab?** Show score 4-6 in separate "Warm Leads" tab, or hide them?

---

## Verification

```bash
python -c "from apscheduler.schedulers.asyncio import AsyncIOScheduler"
# Boot backend — check logs for SCHEDULER_SYNC_STARTED within 5s
curl http://localhost:8000/leads?status=QUALIFIED
curl http://localhost:8000/leads/stats
# Open localhost:3000/leads — QUALIFIED tab default, detail panel on click
```

---

*Plan: autonomous-agent.md | Created: 2026-06-18*
