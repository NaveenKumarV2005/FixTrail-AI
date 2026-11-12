
from pydantic import BaseModel, EmailStr, Field
from typing import Literal, Optional
from datetime import datetime


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: Literal["customer", "technician"] = "customer"


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: str

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class RepairCreate(BaseModel):
    appliance_name: str = Field(min_length=2, max_length=100)
    problem_description: str = Field(
        min_length=10,
        max_length=2000
    )


class EstimateCreate(BaseModel):
    estimated_cost: int = Field(gt=0, le=10000000)
    estimate_description: str = Field(
        min_length=5,
        max_length=2000
    )


class RepairEstimateCreate(BaseModel):
    estimated_cost: int = Field(gt=0, le=10000000)
    estimate_description: str = Field(
        min_length=5,
        max_length=2000
    )


class RepairEstimateResponse(BaseModel):
    id: int
    repair_id: int
    technician_id: int
    estimated_cost: int
    estimate_description: str
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class RepairResponse(BaseModel):
    id: int
    customer_id: int
    technician_id: Optional[int]
    appliance_name: str
    problem_description: str
    status: str
    estimated_cost: Optional[int]
    estimate_description: Optional[str]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class RepairImageResponse(BaseModel):
    id: int
    repair_id: int
    uploaded_by: int
    image_type: str
    file_path: str
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = Field(
        default=None,
        max_length=1000
    )


class ReviewResponse(BaseModel):
    id: int
    repair_id: int
    customer_id: int
    technician_id: int
    rating: int
    comment: Optional[str]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}
