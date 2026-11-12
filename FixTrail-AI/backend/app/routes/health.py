from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "application": "FixTrail AI",
        "message": "Backend is running successfully"
    }