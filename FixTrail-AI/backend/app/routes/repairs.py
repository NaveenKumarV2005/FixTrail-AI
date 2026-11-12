
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import RepairJob, User
from app.schemas import RepairCreate, EstimateCreate, RepairResponse
from app.routes.auth import get_current_user, require_role

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
