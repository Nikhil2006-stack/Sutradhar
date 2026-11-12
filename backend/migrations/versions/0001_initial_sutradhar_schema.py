"""Initial Sutradhar multi-tenant enterprise schema

Revision ID: 0001_initial_sutradhar
Revises: None
Create Date: 2026-11-12 22:50:00
"""

from typing import Sequence, Union

from alembic import op
from app.core.database import Base
import app.models  # noqa: F401

revision: str = "0001_initial_sutradhar"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)

