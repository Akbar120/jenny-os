from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database.engine import engine
from backend.database.models import Base
from backend.routes import leads, logs, settings, missions, sources, runs

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables are created in SQLite database
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(
    title="Jenny OS API",
    description="Backend API for Jenny OS Lead Hunter Agent",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type"],
)

# Register APIRouters
app.include_router(leads.router)
app.include_router(logs.router)
app.include_router(settings.router)
app.include_router(missions.router)
app.include_router(sources.router)
app.include_router(runs.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["backend"],
        reload_excludes=["**/settings.json", "*.db", "*.log", "**/*.db", "**/*.log", "**/jenny.db"]
    )
