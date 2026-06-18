import json
import uuid
import datetime
import threading
from sqlalchemy.orm import Session
from backend.database.models import SyncRun, Mission, Source
from backend.services import source_service, log_service
from backend.database.engine import SessionLocal


def get_current_run(db: Session) -> SyncRun | None:
    """Returns the currently RUNNING sync run, or None if idle."""
    return db.query(SyncRun).filter(SyncRun.status == "RUNNING").first()


def get_run_history(db: Session, limit: int = 10) -> list[SyncRun]:
    """Returns the last N completed/failed sync runs, newest first."""
    return (
        db.query(SyncRun)
        .filter(SyncRun.status.in_(["COMPLETED", "FAILED"]))
        .order_by(SyncRun.started_at.desc())
        .limit(limit)
        .all()
    )


def get_run_by_id(db: Session, run_id: str) -> SyncRun | None:
    """Returns a single sync run by ID."""
    return db.query(SyncRun).filter(SyncRun.id == run_id).first()


def _execute_sweep(run_id: str):
    """
    Background thread: executes the full sweep for all active missions.
    Uses its own DB session — does NOT share session with the request thread.
    """
    db: Session = SessionLocal()
    try:
        run = db.query(SyncRun).filter(SyncRun.id == run_id).first()
        if not run:
            return

        # Collect all active sources across all active missions
        active_missions = db.query(Mission).filter(Mission.is_active == True).all()
        all_sources = []
        for mission in active_missions:
            sources = (
                db.query(Source)
                .filter(Source.mission_id == mission.id, Source.is_active == True)
                .all()
            )
            all_sources.extend(sources)

        run.total_sources = len(all_sources)
        db.commit()

        log_service.create_log(
            db=db,
            event="RUN_SWEEP_STARTED",
            lead_id=None,
            mission_id=None,
            details={
                "run_id": run_id,
                "total_sources": len(all_sources),
                "triggered_by": run.triggered_by,
            },
        )

        total_found = 0
        total_qualified = 0
        total_skipped = 0
        errors: dict = {}

        for source in all_sources:
            try:
                result = source_service.sync_source(db, source.id)
                total_found += result.get("added", 0) + result.get("skipped", 0)
                total_qualified += result.get("added", 0)
                total_skipped += result.get("skipped", 0)
                if result.get("errors"):
                    errors[source.id] = result["errors"]
            except Exception as e:
                errors[source.id] = [str(e)]
            finally:
                run.sources_done = (run.sources_done or 0) + 1
                db.commit()

        # Mark run complete
        run.status = "COMPLETED"
        run.completed_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        run.leads_found = total_found
        run.leads_qualified = total_qualified
        run.leads_skipped = total_skipped
        run.error_summary = json.dumps(errors) if errors else None
        db.commit()

        log_service.create_log(
            db=db,
            event="RUN_SWEEP_COMPLETED",
            lead_id=None,
            mission_id=None,
            details={
                "run_id": run_id,
                "leads_qualified": total_qualified,
                "leads_skipped": total_skipped,
                "sources_processed": run.sources_done,
                "errors": len(errors),
            },
        )

    except Exception as fatal_err:
        try:
            run = db.query(SyncRun).filter(SyncRun.id == run_id).first()
            if run:
                run.status = "FAILED"
                run.completed_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
                run.error_summary = json.dumps({"fatal": str(fatal_err)})
                db.commit()
            log_service.create_log(
                db=db,
                event="RUN_SWEEP_FAILED",
                lead_id=None,
                mission_id=None,
                details={"run_id": run_id, "error": str(fatal_err)},
            )
        except Exception:
            pass
    finally:
        db.close()


def trigger_full_sweep(db: Session, triggered_by: str = "MANUAL") -> SyncRun:
    """
    Creates a SyncRun record and starts the full sweep in a background thread.
    Returns immediately with the run record (status=RUNNING).
    Raises ValueError if a run is already in progress.
    """
    # Guard: prevent double-run
    existing = get_current_run(db)
    if existing:
        raise ValueError(f"A sync run is already in progress (run_id: {existing.id}).")

    # Check at least one active mission with sources exists
    active_count = (
        db.query(Source)
        .join(Mission, Source.mission_id == Mission.id)
        .filter(Mission.is_active == True, Source.is_active == True)
        .count()
    )
    if active_count == 0:
        raise ValueError(
            "No active sources found. Add sources to an active mission first."
        )

    run = SyncRun(
        id=str(uuid.uuid4()),
        status="RUNNING",
        triggered_by=triggered_by,
        started_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        total_sources=0,
        sources_done=0,
        leads_found=0,
        leads_qualified=0,
        leads_skipped=0,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    # Launch background thread — does NOT block the API response
    thread = threading.Thread(target=_execute_sweep, args=(run.id,), daemon=True)
    thread.start()

    return run
