
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine
from app.routes import health, auth, repairs

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FixTrail AI",
    description="AI-powered repair verification and digital warranty platform",
    version="1.0.0"
)

# Frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Upload directory
BACKEND_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BACKEND_DIR / "uploads"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
(UPLOAD_DIR / "repairs").mkdir(parents=True, exist_ok=True)

# Serve uploaded images
app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOAD_DIR)),
    name="uploads"
)

# API routers
app.include_router(
    health.router,
    prefix="/api",
    tags=["Health"]
)

app.include_router(
    auth.router,
    prefix="/api/auth",
    tags=["Authentication"]
)

app.include_router(
    repairs.router,
    prefix="/api/repairs",
    tags=["Repairs"]
)


@app.get("/")
def root():
    return {
        "message": "Welcome to FixTrail AI",
        "status": "running"
    }
