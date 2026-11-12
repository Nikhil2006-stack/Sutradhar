"""FastAPI dependencies for JWT authentication, multi-tenant context, RBAC enforcement, and audit logging."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional, Set

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import get_permissions_for_role
from app.core.security import decode_access_token
from app.models.entities import AuditLog, Membership, Organization, Role, User

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class TenantContext:
    user: User
    organization: Organization
    membership: Membership
    role: Role
    permissions: Set[str]


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Authenticate user via Bearer JWT access token."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
        )
    try:
        payload = decode_access_token(credentials.credentials)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token payload.",
        )

    user = db.query(User).filter(User.id == str(user_id), User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or inactive.",
        )
    return user


def get_tenant_context(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    x_organization_id: Optional[str] = Header(default=None, alias="X-Organization-Id"),
    db: Session = Depends(get_db),
) -> TenantContext:
    """Resolve current user and enforce strict multi-tenant membership isolation."""
    user = get_current_user(credentials=credentials, db=db)

    token_org_id: Optional[str] = None
    if credentials and credentials.credentials:
        try:
            payload = decode_access_token(credentials.credentials)
            token_org_id = payload.get("org_id")
        except Exception:
            pass

    target_org_id = x_organization_id or token_org_id

    membership_query = db.query(Membership).filter(
        Membership.user_id == user.id,
        Membership.status == "ACTIVE",
    )

    membership: Optional[Membership] = None
    if target_org_id:
        membership = membership_query.filter(Membership.organization_id == target_org_id).first()
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not belong to the requested organisation workspace.",
            )
    else:
        membership = (
            membership_query.order_by(Membership.is_default.desc(), Membership.created_at.asc()).first()
        )
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No active organisation workspace found for this user.",
            )

    organization = (
        db.query(Organization)
        .filter(Organization.id == membership.organization_id, Organization.is_active.is_(True))
        .first()
    )
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation workspace not found or inactive.",
        )

    role = db.query(Role).filter(Role.id == membership.role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Assigned role not found.",
        )

    permissions = get_permissions_for_role(role.code)
    if role.permissions:
        permissions = permissions.union({perm.code for perm in role.permissions})

    return TenantContext(
        user=user,
        organization=organization,
        membership=membership,
        role=role,
        permissions=permissions,
    )


def require_permissions(*required_codes: str) -> Callable[..., TenantContext]:
    """Dependency factory enforcing RBAC permission codes on an endpoint."""

    def _checker(ctx: TenantContext = Depends(get_tenant_context)) -> TenantContext:
        missing = [code for code in required_codes if code not in ctx.permissions]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient role permissions ({ctx.role.code}). Missing: {', '.join(missing)}",
            )
        return ctx

    return _checker


def record_audit_log(
    db: Session,
    organization_id: str,
    actor: Optional[User],
    action: str,
    entity_type: str,
    entity_id: Optional[str],
    summary: str,
    metadata: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> AuditLog:
    """Create an immutable audit log entry inside the current session."""
    ip_addr = request.client.host if (request and request.client) else "127.0.0.1"
    entry = AuditLog(
        organization_id=organization_id,
        actor_id=actor.id if actor else None,
        actor_email=actor.email if actor else "system@sutradhar.ai",
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        summary=summary,
        metadata_json=metadata or {},
        ip_address=ip_addr,
    )
    db.add(entry)
    return entry

