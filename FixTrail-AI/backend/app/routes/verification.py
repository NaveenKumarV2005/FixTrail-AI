
import os
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import RepairJob, RepairImage, User
from app.routes.auth import require_role
from app.services.repair_verification import (
    verify_repair_images,
    describe_damage_image
)

from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.models import RepairJob, RepairImage, User
from app.routes.auth import require_role
from app.services.repair_verification import verify_repair_images


router = APIRouter()

logger = logging.getLogger(__name__)

# Backend directory
BACKEND_DIR = Path(__file__).resolve().parents[2]

# Allowed image upload directory
UPLOAD_DIR = (BACKEND_DIR / "uploads" / "repairs").resolve()


# ==================================================
# 1. VALIDATE IMAGE PATH
# ==================================================

def get_safe_image_path(file_path: str) -> Path:

    path = (BACKEND_DIR / file_path).resolve()

    # Prevent access outside the repair uploads directory
    if not path.is_relative_to(UPLOAD_DIR):
        raise HTTPException(
            status_code=400,
            detail="Invalid image path"
        )

    if not path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Image file not found"
        )

    return path


# ==================================================
# 2. VERIFY COMPLETED REPAIR USING GROQ AI
# ==================================================

@router.post("/repairs/{repair_id}/verify")
def verify_completed_repair(
    repair_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("customer"))
):

    # --------------------------------------------------
    # Find repair belonging to the logged-in customer
    # --------------------------------------------------

    repair = db.query(RepairJob).filter(
        RepairJob.id == repair_id,
        RepairJob.customer_id == user.id
    ).first()

    if not repair:
        raise HTTPException(
            status_code=404,
            detail="Repair not found"
        )

    # --------------------------------------------------
    # Only completed repairs can be verified
    # --------------------------------------------------

    if repair.status != "completed":
        raise HTTPException(
            status_code=400,
            detail="Only completed repairs can be verified"
        )

    # --------------------------------------------------
    # Check approved repair details
    # --------------------------------------------------

    if not repair.technician_id:
        raise HTTPException(
            status_code=400,
            detail="No technician is assigned to this repair"
        )

    if not repair.estimate_description:
        raise HTTPException(
            status_code=400,
            detail="Approved repair description is missing"
        )

    # --------------------------------------------------
    # Retrieve repair images
    # --------------------------------------------------

    images = db.query(RepairImage).filter(
        RepairImage.repair_id == repair_id
    ).order_by(
        RepairImage.id.asc()
    ).all()

    damage_images = [
        image for image in images
        if image.image_type == "customer_damage"
    ][:3]

    completion_images = [
        image for image in images
        if image.image_type == "repair_completion"
    ][:3]

    if not damage_images:
        raise HTTPException(
            status_code=400,
            detail="Original damage images are missing"
        )

    if not completion_images:
        raise HTTPException(
            status_code=400,
            detail="Repair completion images are missing"
        )

    # --------------------------------------------------
    # Validate image paths
    # --------------------------------------------------

    damage_paths = [
        get_safe_image_path(image.file_path)
        for image in damage_images
    ]

    completion_paths = [
        get_safe_image_path(image.file_path)
        for image in completion_images
    ]

    # --------------------------------------------------
    # Run Groq AI image verification
    # --------------------------------------------------

    try:

        report = verify_repair_images(
            damage_image_paths=damage_paths,
            completion_image_paths=completion_paths,
            approved_description=repair.estimate_description,
            appliance_name=repair.appliance_name
        )

    except FileNotFoundError as exc:

        logger.exception("Repair verification image not found")

        raise HTTPException(
            status_code=404,
            detail="Verification image not found"
        ) from exc

    except ValueError as exc:

        logger.exception("Invalid repair verification request")

        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc

    except RuntimeError as exc:

        logger.exception("Groq verification service error")

        raise HTTPException(
            status_code=503,
            detail="AI verification service is unavailable"
        ) from exc

    except Exception as exc:

        logger.exception("Unexpected repair verification error")

        raise HTTPException(
            status_code=500,
            detail="Repair verification failed"
        ) from exc

    # --------------------------------------------------
    # Return verification report
    # --------------------------------------------------

    return {
        "repair_id": repair.id,
        "appliance_name": repair.appliance_name,
        "approved_repair_description": repair.estimate_description,
        "provider": "Groq",
        "model": os.getenv("GROQ_MODEL"),
        "report": report
    }


# ==================================================
# 3. GENERATE DAMAGE DESCRIPTION FROM IMAGE
# ==================================================

@router.post("/describe-damage")
async def generate_damage_description(
    image: UploadFile = File(...),
    user: User = Depends(require_role("customer"))
):
    allowed_types = {
        "image/jpeg",
        "image/png",
        "image/webp"
    }

    if image.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG and WEBP images are allowed"
        )

    image_bytes = await image.read(5 * 1024 * 1024 + 1)

    if len(image_bytes) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="Maximum image size is 5 MB"
        )

    try:
        description = describe_damage_image(
            image_bytes=image_bytes,
            content_type=image.content_type
        )

        return {
            "provider": "Groq",
            "description": description
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc

    except Exception as exc:
        logger.exception("Damage description generation failed")

        raise HTTPException(
            status_code=503,
            detail="AI description service is unavailable"
        ) from exc

