
import uuid
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File
)
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import (
    RepairJob,
    User,
    RepairEstimate,
    RepairImage,
    RepairReview
)
from app.schemas import (
    RepairCreate,
    RepairEstimateCreate,
    RepairResponse,
    RepairEstimateResponse,
    ReviewCreate,
    ReviewResponse
)
from app.routes.auth import get_current_user, require_role


router = APIRouter()

# Store uploads inside the backend/uploads directory
BACKEND_DIR = Path(__file__).resolve().parents[2]
UPLOAD_DIR = BACKEND_DIR / "uploads" / "repairs"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# --------------------------------------------------
# CUSTOMER CREATES REPAIR
# --------------------------------------------------

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


# --------------------------------------------------
# CUSTOMER VIEWS OWN REPAIRS
# --------------------------------------------------

@router.get("/my", response_model=list[RepairResponse])
def my_repairs(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("customer"))
):
    return db.query(RepairJob).filter(
        RepairJob.customer_id == user.id
    ).order_by(RepairJob.id.desc()).all()


# --------------------------------------------------
# TECHNICIAN VIEWS AVAILABLE REPAIRS
# --------------------------------------------------

@router.get("/available", response_model=list[RepairResponse])
def available_repairs(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("technician"))
):
    return db.query(RepairJob).filter(
        (RepairJob.status == "reported") |
        (RepairJob.technician_id == user.id)
    ).order_by(RepairJob.id.desc()).all()


# --------------------------------------------------
# LEGACY CLAIM ENDPOINT
# Claiming is no longer required to submit estimates.
# --------------------------------------------------

@router.post("/{repair_id}/claim", response_model=RepairResponse)
def claim_repair(
    repair_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("technician"))
):
    repair = db.query(RepairJob).filter(
        RepairJob.id == repair_id
    ).first()

    if not repair:
        raise HTTPException(
            status_code=404,
            detail="Repair not found"
        )

    if repair.status != "reported":
        raise HTTPException(
            status_code=400,
            detail="Repair is no longer accepting estimates"
        )

    # No exclusive assignment happens here.
    return repair


# --------------------------------------------------
# TECHNICIAN SUBMITS OR UPDATES OWN ESTIMATE
# --------------------------------------------------

@router.post(
    "/{repair_id}/estimate",
    response_model=RepairEstimateResponse
)
def submit_estimate(
    repair_id: int,
    data: RepairEstimateCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("technician"))
):
    repair = db.query(RepairJob).filter(
        RepairJob.id == repair_id
    ).first()

    if not repair:
        raise HTTPException(
            status_code=404,
            detail="Repair not found"
        )

    if repair.status != "reported":
        raise HTTPException(
            status_code=400,
            detail="This repair is no longer accepting estimates"
        )

    existing = db.query(RepairEstimate).filter(
        RepairEstimate.repair_id == repair_id,
        RepairEstimate.technician_id == user.id
    ).first()

    if existing:
        existing.estimated_cost = data.estimated_cost
        existing.estimate_description = data.estimate_description

        db.commit()
        db.refresh(existing)

        return existing

    estimate = RepairEstimate(
        repair_id=repair_id,
        technician_id=user.id,
        estimated_cost=data.estimated_cost,
        estimate_description=data.estimate_description
    )

    db.add(estimate)
    db.commit()
    db.refresh(estimate)

    return estimate


# --------------------------------------------------
# CUSTOMER VIEWS ALL ESTIMATES
# --------------------------------------------------

@router.get(
    "/{repair_id}/estimates",
    response_model=list[RepairEstimateResponse]
)
def get_repair_estimates(
    repair_id: int,
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

    return db.query(RepairEstimate).filter(
        RepairEstimate.repair_id == repair_id
    ).order_by(RepairEstimate.estimated_cost.asc()).all()


# --------------------------------------------------
# CUSTOMER SELECTS TECHNICIAN ESTIMATE
# --------------------------------------------------

@router.post(
    "/{repair_id}/estimates/{estimate_id}/select",
    response_model=RepairResponse
)
def select_repair_estimate(
    repair_id: int,
    estimate_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("customer"))
):
    repair = db.query(RepairJob).filter(
        RepairJob.id == repair_id,
        RepairJob.customer_id == user.id
    ).with_for_update().first()

    if not repair:
        raise HTTPException(
            status_code=404,
            detail="Repair not found"
        )

    if repair.status != "reported":
        raise HTTPException(
            status_code=400,
            detail="A technician has already been selected or repair has progressed"
        )

    estimate = db.query(RepairEstimate).filter(
        RepairEstimate.id == estimate_id,
        RepairEstimate.repair_id == repair_id
    ).first()

    if not estimate:
        raise HTTPException(
            status_code=404,
            detail="Estimate not found"
        )

    technician = db.query(User).filter(
        User.id == estimate.technician_id,
        User.role == "technician"
    ).first()

    if not technician:
        raise HTTPException(
            status_code=400,
            detail="Invalid technician"
        )

    repair.technician_id = estimate.technician_id
    repair.estimated_cost = estimate.estimated_cost
    repair.estimate_description = estimate.estimate_description
    repair.status = "estimated"

    db.commit()
    db.refresh(repair)

    return repair


# --------------------------------------------------
# CUSTOMER APPROVES SELECTED ESTIMATE
# --------------------------------------------------

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
        raise HTTPException(
            status_code=404,
            detail="Repair not found"
        )

    if repair.status != "estimated":
        raise HTTPException(
            status_code=400,
            detail="No pending estimate to approve"
        )

    repair.status = "approved"

    db.commit()
    db.refresh(repair)

    return repair


# --------------------------------------------------
# TECHNICIAN UPDATES REPAIR STATUS
# --------------------------------------------------

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
        raise HTTPException(
            status_code=404,
            detail="Assigned repair not found"
        )

    if new_status not in allowed_transitions.get(repair.status, []):
        raise HTTPException(
            status_code=400,
            detail="Invalid repair status transition"
        )

    repair.status = new_status

    db.commit()
    db.refresh(repair)

    return repair


# --------------------------------------------------
# UPLOAD DAMAGE OR COMPLETION IMAGES
# --------------------------------------------------

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
            raise HTTPException(
                status_code=403,
                detail="Not authorized"
            )

        if repair.status != "reported":
            raise HTTPException(
                status_code=400,
                detail="Damage image upload is closed"
            )

    if image_type == "repair_completion":
        if user.role != "technician" or repair.technician_id != user.id:
            raise HTTPException(
                status_code=403,
                detail="Only the selected technician can upload completion images"
            )

        if repair.status not in ["approved", "in_progress"]:
            raise HTTPException(
                status_code=400,
                detail="Repair is not ready for completion images"
            )

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

    try:
        save_path.write_bytes(contents)

        record = RepairImage(
            repair_id=repair.id,
            uploaded_by=user.id,
            image_type=image_type,
            file_path=f"uploads/repairs/{filename}"
        )

        db.add(record)
        db.commit()
        db.refresh(record)

    except Exception:
        db.rollback()

        if save_path.exists():
            save_path.unlink()

        raise HTTPException(
            status_code=500,
            detail="Image could not be saved"
        )

    return {
        "message": "Image uploaded successfully",
        "image_id": record.id,
        "image_type": record.image_type,
        "file_path": record.file_path
    }


# --------------------------------------------------
# VIEW REPAIR IMAGES
# --------------------------------------------------

@router.get("/{repair_id}/images")
def get_repair_images(
    repair_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    repair = db.query(RepairJob).filter(
        RepairJob.id == repair_id
    ).first()

    if not repair:
        raise HTTPException(
            status_code=404,
            detail="Repair not found"
        )

    is_customer_owner = user.id == repair.customer_id

    is_assigned_technician = user.id == repair.technician_id

    is_evaluating_technician = (
        user.role == "technician"
        and repair.status == "reported"
    )

    if not (
        is_customer_owner
        or is_assigned_technician
        or is_evaluating_technician
    ):
        raise HTTPException(
            status_code=403,
            detail="Not authorized"
        )

    images = db.query(RepairImage).filter(
        RepairImage.repair_id == repair_id
    ).order_by(RepairImage.id.asc()).all()

    return [
        {
            "id": image.id,
            "repair_id": image.repair_id,
            "image_type": image.image_type,
            "file_path": image.file_path,
            "uploaded_by": image.uploaded_by
        }
        for image in images
    ]


# --------------------------------------------------
# CUSTOMER SUBMITS REVIEW
# --------------------------------------------------

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
            detail="No technician assigned"
        )

    existing = db.query(RepairReview).filter(
        RepairReview.repair_id == repair_id
    ).first()

    if existing:
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


# --------------------------------------------------
# VIEW TECHNICIAN REVIEWS AND AVERAGE RATING
# --------------------------------------------------

@router.get("/technicians/{technician_id}/reviews")
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
