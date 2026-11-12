
import os

from fastapi.staticfiles import StaticFiles
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app import models
from app.routes import health, auth, repairs

load_dotenv()

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FixTrail AI",
    description="AI-powered repair verification and warranty platform",
    version="1.0.0"
)

Path("uploads/repairs").mkdir(parents=True, exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory="uploads"),
    name="uploads"
)

frontend_url = os.getenv(
    "FRONTEND_URL",
    "http://localhost:5173"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(repairs.router, prefix="/api/repairs", tags=["Repairs"])


@app.get("/")
def home():
    return {"message": "Welcome to FixTrail AI API"}
