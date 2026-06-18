from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database.engine import get_db
from backend.services import run_service

router = APIRouter(prefix="/api/runs", tags=["Runs"])


@router.post("/trigger", status_code=status.HTTP_202_ACCEPTED)
def trigger_run(db: Session = Depends(get_db)):
    """
    Manually triggers a full sweep across all active mission sources.
    Returns immediately — sweep runs in background.
    Returns 409 if a sweep is already in progress.
    """
    try:
        run = run_service.trigger_full_sweep(db, triggered_by="MANUAL")
        return {
            "run_id": run.id,
            "status": run.status,
            "triggered_by": run.triggered_by,
            "started_at": run.started_at,
            "total_sources": run.total_sources,
            "message": "Full sweep started. Check /api/runs/current for live progress.",
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start sweep: {str(e)}",
        )


@router.get("/status")
def get_current_run(db: Session = Depends(get_db)):
    """
    Returns the currently RUNNING sync run with live progress,
    or null if no sweep is in progress.
    """
    run = run_service.get_current_run(db)
    if not run:
        return {"status": "IDLE", "run": None}
    return {
        "status": "RUNNING",
        "run": {
            "run_id": run.id,
            "status": run.status,
            "triggered_by": run.triggered_by,
            "started_at": run.started_at,
            "total_sources": run.total_sources,
            "sources_done": run.sources_done,
            "leads_qualified": run.leads_qualified,
            "leads_skipped": run.leads_skipped,
            "progress_pct": (
                round((run.sources_done / run.total_sources) * 100)
                if run.total_sources > 0
                else 0
            ),
        },
    }


@router.get("")
def list_runs(limit: int = 10, db: Session = Depends(get_db)):
    """Returns the last N completed/failed sweep runs."""
    runs = run_service.get_run_history(db, limit=limit)
    return [
        {
            "run_id": r.id,
            "status": r.status,
            "triggered_by": r.triggered_by,
            "started_at": r.started_at,
            "completed_at": r.completed_at,
            "total_sources": r.total_sources,
            "sources_done": r.sources_done,
            "leads_qualified": r.leads_qualified,
            "leads_skipped": r.leads_skipped,
            "had_errors": bool(r.error_summary),
        }
        for r in runs
    ]


@router.get("/{run_id}")
def get_run(run_id: str, db: Session = Depends(get_db)):
    """Returns full details of a single sync run by ID."""
    run = run_service.get_run_by_id(db, run_id)
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found.",
        )
    return {
        "run_id": run.id,
        "status": run.status,
        "triggered_by": run.triggered_by,
        "started_at": run.started_at,
        "completed_at": run.completed_at,
        "total_sources": run.total_sources,
        "sources_done": run.sources_done,
        "leads_found": run.leads_found,
        "leads_qualified": run.leads_qualified,
        "leads_skipped": run.leads_skipped,
        "error_summary": run.error_summary,
    }
