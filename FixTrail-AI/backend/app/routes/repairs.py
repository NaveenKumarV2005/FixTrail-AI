
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import RepairJob, User
from app.schemas import RepairCreate, EstimateCreate, RepairResponse
from app.routes.auth import get_current_user, require_role

import uuid
from pathlib import Path

from fastapi import UploadFile, File
from sqlalchemy import func

from app.models import RepairImage, RepairReview
from app.schemas import ReviewCreate, ReviewResponse

router = APIRouter()


# Customer creates a repair request
@router.post("/", response_model=RepairResponse)
def create_repair(
    data: RepairCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("customer"))
):
    repair = RepairJob(
        customer_id=user.id,
        appliance_name=data.appliance_name,
        problem_description=data.problem_description,
        status="reported"
    )

    db.add(repair)
    db.commit()
    db.refresh(repair)

    return repair


# Customer sees their requests
@router.get("/my", response_model=list[RepairResponse])
def my_repairs(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("customer"))
):
    return db.query(RepairJob).filter(
        RepairJob.customer_id == user.id
    ).order_by(RepairJob.id.desc()).all()


# Technician sees unclaimed requests and their assigned jobs
@router.get("/available", response_model=list[RepairResponse])
def available_repairs(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("technician"))
):
    return db.query(RepairJob).filter(
        (RepairJob.technician_id.is_(None)) |
        (RepairJob.technician_id == user.id)
    ).order_by(RepairJob.id.desc()).all()


# Technician claims a repair
@router.post("/{repair_id}/claim", response_model=RepairResponse)
def claim_repair(
    repair_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("technician"))
):
    repair = db.query(RepairJob).filter(
        RepairJob.id == repair_id
    ).with_for_update().first()

    if not repair:
        raise HTTPException(status_code=404, detail="Repair not found")

    if repair.technician_id is not None:
        raise HTTPException(status_code=409, detail="Repair already claimed")

    if repair.status != "reported":
        raise HTTPException(status_code=400, detail="Repair cannot be claimed")

    repair.technician_id = user.id
    repair.status = "claimed"

    db.commit()
    db.refresh(repair)

    return repair


# Technician submits estimate
@router.post("/{repair_id}/estimate", response_model=RepairResponse)
def submit_estimate(
    repair_id: int,
    data: EstimateCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("technician"))
):
    repair = db.query(RepairJob).filter(
        RepairJob.id == repair_id,
        RepairJob.technician_id == user.id
    ).first()

    if not repair:
        raise HTTPException(status_code=404, detail="Assigned repair not found")

    if repair.status != "claimed":
        raise HTTPException(
            status_code=400,
            detail="Estimate can only be submitted for a claimed repair"
        )

    repair.estimated_cost = data.estimated_cost
    repair.estimate_description = data.estimate_description
    repair.status = "estimated"

    db.commit()
    db.refresh(repair)

    return repair


# Customer approves estimate
@router.post("/{repair_id}/approve", response_model=RepairResponse)
def approve_estimate(
    repair_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("customer"))
):
    repair = db.query(RepairJob).filter(
        RepairJob.id == repair_id,
        RepairJob.customer_id == user.id
    ).first()

    if not repair:
        raise HTTPException(status_code=404, detail="Repair not found")

    if repair.status != "estimated":
        raise HTTPException(
            status_code=400,
            detail="No pending estimate to approve"
        )

    repair.status = "approved"

    db.commit()
    db.refresh(repair)

    return repair


# Technician updates work status
@router.patch("/{repair_id}/status", response_model=RepairResponse)
def update_repair_status(
    repair_id: int,
    new_status: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("technician"))
):
    allowed_transitions = {
        "approved": ["in_progress"],
        "in_progress": ["completed"]
    }

    repair = db.query(RepairJob).filter(
        RepairJob.id == repair_id,
        RepairJob.technician_id == user.id
    ).first()

    if not repair:
        raise HTTPException(status_code=404, detail="Repair not found")

    if new_status not in allowed_transitions.get(repair.status, []):
        raise HTTPException(
            status_code=400,
            detail="Invalid repair status transition"
        )

    repair.status = new_status

    db.commit()
    db.refresh(repair)

    return repair

# Customer reviews a completed repair
@router.post(
    "/{repair_id}/review",
    response_model=ReviewResponse
)
def create_repair_review(
    repair_id: int,
    data: ReviewCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("customer"))
):
    repair = db.query(RepairJob).filter(
        RepairJob.id == repair_id,
        RepairJob.customer_id == user.id
    ).first()

    if not repair:
        raise HTTPException(
            status_code=404,
            detail="Repair not found"
        )

    if repair.status != "completed":
        raise HTTPException(
            status_code=400,
            detail="You can review only completed repairs"
        )

    if repair.technician_id is None:
        raise HTTPException(
            status_code=400,
            detail="No technician assigned to this repair"
        )

    existing_review = db.query(RepairReview).filter(
        RepairReview.repair_id == repair_id
    ).first()

    if existing_review:
        raise HTTPException(
            status_code=409,
            detail="You have already reviewed this repair"
        )

    review = RepairReview(
        repair_id=repair.id,
        customer_id=user.id,
        technician_id=repair.technician_id,
        rating=data.rating,
        comment=data.comment
    )

    db.add(review)
    db.commit()
    db.refresh(review)

    return review


# View reviews for a technician
@router.get(
    "/technicians/{technician_id}/reviews"
)
def get_technician_reviews(
    technician_id: int,
    db: Session = Depends(get_db)
):
    technician = db.query(User).filter(
        User.id == technician_id,
        User.role == "technician"
    ).first()

    if not technician:
        raise HTTPException(
            status_code=404,
            detail="Technician not found"
        )

    reviews = db.query(RepairReview).filter(
        RepairReview.technician_id == technician_id
    ).order_by(RepairReview.id.desc()).all()

    average_rating = db.query(
        func.avg(RepairReview.rating)
    ).filter(
        RepairReview.technician_id == technician_id
    ).scalar()

    return {
        "technician_id": technician_id,
        "average_rating": round(float(average_rating or 0), 2),
        "total_reviews": len(reviews),
        "reviews": reviews
    }

# Create image upload directory
UPLOAD_DIR = Path("uploads/repairs")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Mount the upload directory as a static files route


# Upload damage or repair completion images
@router.post("/{repair_id}/images")
async def upload_repair_image(
    repair_id: int,
    image_type: str,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    allowed_types = [
        "customer_damage",
        "repair_completion"
    ]

    if image_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Invalid image type"
        )

    repair = db.query(RepairJob).filter(
        RepairJob.id == repair_id
    ).first()

    if not repair:
        raise HTTPException(
            status_code=404,
            detail="Repair not found"
        )

    if image_type == "customer_damage":
        if user.role != "customer" or repair.customer_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized")

        if repair.status != "reported":
            raise HTTPException(status_code=400, detail="Damage upload is closed")

    if image_type == "repair_completion":
        if user.role != "technician" or repair.technician_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized")

        if repair.status not in ["approved", "in_progress", "completed"]:
            raise HTTPException(status_code=400, detail="Invalid repair status")

    content_types = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp"
    }

    if image.content_type not in content_types:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG and WEBP images are allowed"
        )

    contents = await image.read(5 * 1024 * 1024 + 1)

    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="Maximum image size is 5 MB"
        )

    filename = uuid.uuid4().hex + content_types[image.content_type]
    save_path = UPLOAD_DIR / filename

    with open(save_path, "wb") as file:
        file.write(contents)

    record = RepairImage(
        repair_id=repair.id,
        uploaded_by=user.id,
        image_type=image_type,
        file_path=f"uploads/repairs/{filename}"
    )

    try:
        db.add(record)
        db.commit()
        db.refresh(record)
    except Exception:
        db.rollback()
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Image could not be saved")

    return {
        "message": "Image uploaded successfully",
        "image_id": record.id,
        "file_path": record.file_path
    }