
from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    Text,
    UniqueConstraint
)
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="customer")

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


class RepairJob(Base):
    __tablename__ = "repair_jobs"

    id = Column(Integer, primary_key=True, index=True)

    customer_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    technician_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )

    appliance_name = Column(String(100), nullable=False)
    problem_description = Column(Text, nullable=False)

    status = Column(
        String(30),
        nullable=False,
        default="reported"
    )

    # Stores the selected technician's estimate
    estimated_cost = Column(Integer, nullable=True)
    estimate_description = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )


class RepairEstimate(Base):
    __tablename__ = "repair_estimates"

    __table_args__ = (
        UniqueConstraint(
            "repair_id",
            "technician_id",
            name="uq_repair_technician_estimate"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    repair_id = Column(
        Integer,
        ForeignKey("repair_jobs.id"),
        nullable=False
    )

    technician_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    estimated_cost = Column(Integer, nullable=False)
    estimate_description = Column(Text, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


class RepairImage(Base):
    __tablename__ = "repair_images"

    id = Column(Integer, primary_key=True, index=True)

    repair_id = Column(
        Integer,
        ForeignKey("repair_jobs.id"),
        nullable=False
    )

    uploaded_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    image_type = Column(String(30), nullable=False)
    file_path = Column(String(500), nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


class RepairReview(Base):
    __tablename__ = "repair_reviews"

    id = Column(Integer, primary_key=True, index=True)

    repair_id = Column(
        Integer,
        ForeignKey("repair_jobs.id"),
        unique=True,
        nullable=False
    )

    customer_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    technician_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


class RepairPassport(Base):
    __tablename__ = "repair_passports"

    id = Column(Integer, primary_key=True, index=True)

    passport_number = Column(
        String(50),
        unique=True,
        index=True,
        nullable=False
    )

    repair_id = Column(
        Integer,
        ForeignKey("repair_jobs.id"),
        unique=True,
        nullable=False
    )

    customer_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    technician_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    appliance_name = Column(String(100), nullable=False)
    problem_description = Column(Text, nullable=False)
    approved_repair_description = Column(Text, nullable=False)
    approved_cost = Column(Integer, nullable=False)

    repair_status = Column(
        String(30),
        nullable=False,
        default="completed"
    )

    completed_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )
