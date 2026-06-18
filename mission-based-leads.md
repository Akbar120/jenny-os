# Implementation Plan — Mission-Based Lead Generation Architecture

This plan pivots Jenny OS from a single-agent UEFN lead hunter to a generic, multi-mission lead generation platform. Instead of using hardcoded platform rules, the system will support creating dynamic "Missions" (e.g. 3D Character Artist, AI Automation Agency, Video Editor) with custom keyword arrays and qualification score thresholds.

---

## 🏗️ Proposed Changes

### 1. Database Schema Extensions (SQLite)

We will introduce a `missions` table and update the `leads` table.

#### `missions` Table (NEW)
```sql
CREATE TABLE missions (
    id              TEXT PRIMARY KEY,          -- UUID string
    mission_name    TEXT NOT NULL,             -- e.g. "3D Character Artist Leads"
    target_service  TEXT NOT NULL,             -- e.g. "3D Character Artist"
    keywords        TEXT NOT NULL,             -- JSON array of strings: json.dumps(list[str])
    score_threshold INTEGER NOT NULL DEFAULT 7, -- 0 to 10 scale
    is_active       BOOLEAN NOT NULL DEFAULT 1, -- Active (1) or Paused (0)
    created_at      TEXT NOT NULL              -- ISO 8601 UTC
);
```

#### `leads` Table (MODIFY)
Add new columns to support mission linking, relevance scoring, and backward compatibility:
- `mission_id`: `TEXT` (Foreign Key pointing to `missions.id`, nullable for legacy leads)
- `target_service`: `TEXT` (Target service configured in the active mission)
- `service_match`: `BOOLEAN` (True if any keyword matched, False otherwise)
- `relevance_score`: `INTEGER` (Keyword density score: 0, 3, 5, or 8)

*Index modification*: Change `content_hash` UNIQUE constraint to composite UNIQUE on `(mission_id, content_hash)` so that the same lead can be mapped to different missions independently.

---

### 2. Backend Services & Agent Logic

#### `MissionBasedLeadHunter` (NEW Agent Class)
Replaces `RuleBasedLeadHunter` and `FakeLeadHunter` stubs. It dynamically evaluates the post against the active mission keywords:
1. Normalize text and search for keywords case-insensitively.
2. Calculate score:
   - 0 keywords matched = `score = 0`
   - 1 keyword matched = `score = 3`
   - 2 keywords matched = `score = 5`
   - 3+ keywords matched = `score = 8`
3. Set `service_match = True` if `matched_keywords > 0`, else `False`.
4. Fallback classification rules to identify `intent` (e.g., look for synonyms of `"hire"` like `"need"`, `"looking for"`, `"wanted"` to set `intent = "hire"`).

#### `POST /api/analyze` (API Endpoint Modification)
- **Request Body**: `{ content: str, mission_id: str }`
- **Execution Flow**:
  1. Fetch the active `Mission` by `mission_id` from the database.
  2. Run `MissionBasedLeadHunter.analyze(content, keywords=mission.keywords)`.
  3. Validate output with `LeadHunterOutput` Pydantic model.
  4. Perform threshold evaluation:
     - `is_qualified = (intent == "hire" and relevance_score >= mission.score_threshold)`
     - Set status to `"QUALIFIED"` or `"DISQUALIFIED"`.
  5. Save to database under the target `mission_id`.

#### `Missions` Router (NEW)
- `POST /api/missions`: Create a new mission.
- `GET /api/missions`: List all missions.
- `PATCH /api/missions/{id}`: Edit details or toggle `is_active` status.

---

### 3. Frontend Pages & Components

#### [NEW] Missions Page (`/missions`)
- List of current missions (displays Name, Target Service, status badge, threshold).
- Quick toggles to pause (`is_active = false`) or resume missions.
- `[ + New Mission ]` modal/form dialog inputs:
  - Mission Name
  - Target Service
  - Keywords (comma-separated list, converted to array on POST)
  - Score Threshold (range slider 0 to 10)

#### [MODIFY] Leads Hub (`/leads`)
- **Mission Selection Dropdown**: Added at the top of the intake form. User must choose an active mission before submitting text.
- **Filtering**: Filters the left scrollable list by selected mission or shows "All".
- **Detail View**: Displays the associated `target_service` and `relevance_score` indicators.

#### [MODIFY] Dashboard (`/`)
- Display metrics (Total, Qualified, Disqualified) filtered by selected active mission.

---

## 🧪 Verification Plan

### Automated Tests
1. **test_mission_creation**: Create a mission via `POST /api/missions` and verify database write.
2. **test_mission_based_hunter**: Feed various inputs to `MissionBasedLeadHunter` and check keyword count density scores:
   - 0 keywords matched $\rightarrow$ relevance score = 0, `service_match = False`
   - 1 keyword matched $\rightarrow$ relevance score = 3, `service_match = True`
   - 2 keywords matched $\rightarrow$ relevance score = 5, `service_match = True`
   - 3+ keywords matched $\rightarrow$ relevance score = 8, `service_match = True`
3. **test_analyze_with_mission**: Post text to `/api/analyze` with `mission_id` and verify correct status assignment (e.g. status becomes `QUALIFIED` when score is 8 and threshold is 7).

## ✅ PHASE X COMPLETE
- Lint: ✅ Pass
- Security: ✅ No critical issues
- Build: ✅ Success
- Date: 2026-06-18

