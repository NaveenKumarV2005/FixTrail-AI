
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import RepairJob, RepairPassport, User
from app.schemas import RepairPassportResponse
from app.routes.auth import require_role


router = APIRouter()


def generate_passport_number():
    unique_code = uuid.uuid4().hex[:10].upper()
    return f"FT-PASS-{unique_code}"


# Customer views all their repair passports
@router.get(
    "/my",
    response_model=list[RepairPassportResponse]
)
def get_my_passports(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("customer"))
):
    return db.query(RepairPassport).filter(
        RepairPassport.customer_id == user.id
    ).order_by(
        RepairPassport.id.desc()
    ).all()


# Customer views one passport
@router.get(
    "/{passport_number}",
    response_model=RepairPassportResponse
)
def get_passport(
    passport_number: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("customer"))
):
    passport = db.query(RepairPassport).filter(
        RepairPassport.passport_number == passport_number,
        RepairPassport.customer_id == user.id
    ).first()

    if not passport:
        raise HTTPException(
            status_code=404,
            detail="Repair passport not found"
        )

    return passport


# Internal helper used when a repair is completed
def create_repair_passport(
    repair: RepairJob,
    db: Session
):
    existing = db.query(RepairPassport).filter(
        RepairPassport.repair_id == repair.id
    ).first()

    if existing:
        return existing

    if not repair.technician_id:
        raise ValueError("Repair has no assigned technician")

    if repair.estimated_cost is None:
        raise ValueError("Approved repair cost is missing")

    passport = RepairPassport(
        passport_number=generate_passport_number(),
        repair_id=repair.id,
        customer_id=repair.customer_id,
        technician_id=repair.technician_id,
        appliance_name=repair.appliance_name,
        problem_description=repair.problem_description,
        approved_repair_description=repair.estimate_description or "",
        approved_cost=repair.estimated_cost,
        repair_status="completed"
    )

    db.add(passport)
    return passport
