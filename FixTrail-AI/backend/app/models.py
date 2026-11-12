
from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    Text
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
