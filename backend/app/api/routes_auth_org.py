"""Authentication, Multi-Tenant Organisation Management, Members & RBAC API routes."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import (
    TenantContext,
    get_current_user,
    get_tenant_context,
    record_audit_log,
    require_permissions,
)
from app.core.database import get_db
from app.core.permissions import ROLE_DEFINITIONS, get_permissions_for_role
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.models.entities import (
    Membership,
    NotificationPreference,
    Organization,
    OrganizationSettings,
    RefreshToken,
    Role,
    User,
)
from app.schemas.api_schemas import (
    LoginRequest,
    MemberInviteRequest,
    MemberRoleUpdateRequest,
    OrganizationCreateRequest,
    OrganizationUpdateRequest,
    RefreshTokenRequest,
    RegisterRequest,
    UserProfileUpdateRequest,
)
from app.services.seed_service import (
    bootstrap_organization_defaults,
    ensure_system_roles_and_permissions,
    seed_organization_operational_data,
    slugify,
)

router = APIRouter()


def _serialize_user_memberships(db: Session, user: User) -> List[Dict[str, Any]]:
    memberships = (
        db.query(Membership)
        .filter(Membership.user_id == user.id, Membership.status == "ACTIVE")
        .order_by(Membership.is_default.desc(), Membership.created_at.asc())
        .all()
    )
    items: List[Dict[str, Any]] = []
    for m in memberships:
        org = db.query(Organization).filter(Organization.id == m.organization_id).first()
        role = db.query(Role).filter(Role.id == m.role_id).first()
        if org and role:
            items.append(
                {
                    "membership_id": m.id,
                    "organization_id": org.id,
                    "organization_name": org.name,
                    "organization_slug": org.slug,
                    "industry": org.industry,
                    "gstin": org.gstin,
                    "city": org.city,
                    "state": org.state,
                    "currency": org.currency,
                    "role_code": role.code,
                    "role_name": role.name,
                    "department": m.department,
                    "is_default": m.is_default,
                    "permissions": sorted(list(get_permissions_for_role(role.code))),
                }
            )
    return items


@router.post("/auth/register", status_code=status.HTTP_201_CREATED, tags=["Authentication"])
def register_user_and_organization(
    payload: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Register a new user account, create their initial multi-tenant organisation, and issue JWT tokens."""
    existing = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    role_map = ensure_system_roles_and_permissions(db)

    user = User(
        email=payload.email.lower().strip(),
        full_name=payload.full_name.strip(),
        phone=payload.phone,
        job_title=payload.job_title or "Managing Director",
        hashed_password=hash_password(payload.password),
        is_active=True,
        last_login_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.flush()

    base_slug = slugify(payload.organization_name)
    slug = base_slug
    if db.query(Organization).filter(Organization.slug == slug).first():
        slug = f"{base_slug}-{str(uuid.uuid4())[:6]}"

    org = Organization(
        name=payload.organization_name.strip(),
        slug=slug,
        legal_name=payload.organization_name.strip(),
        gstin=payload.gstin or "27AABCS9999K1Z5",
        industry=payload.industry,
        currency="INR",
        city=payload.city or "Pune",
        state=payload.state or "Maharashtra",
        email=user.email,
        phone=user.phone,
    )
    db.add(org)
    db.flush()

    owner_role = role_map["OWNER"]
    membership = Membership(
        user_id=user.id,
        organization_id=org.id,
        role_id=owner_role.id,
        department="Executive Management",
        status="ACTIVE",
        is_default=True,
    )
    db.add(membership)
    db.flush()

    if payload.seed_demo_data:
        seed_organization_operational_data(db, org, user)
    else:
        bootstrap_organization_defaults(db, org)

    raw_refresh, refresh_hash, expires_at = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            expires_at=expires_at,
            user_agent=request.headers.get("user-agent", "")[:250],
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
    )
    record_audit_log(
        db=db,
        organization_id=org.id,
        actor=user,
        action="AUTH_REGISTER",
        entity_type="USER",
        entity_id=user.id,
        summary=f"Registered user {user.email} and created organisation '{org.name}'.",
        request=request,
    )
    db.commit()

    access_token = create_access_token(
        subject=user.id,
        organization_id=org.id,
        role_code=owner_role.code,
    )
    org_memberships = _serialize_user_memberships(db, user)

    return {
        "access_token": access_token,
        "refresh_token": raw_refresh,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "phone": user.phone,
            "job_title": user.job_title,
        },
        "active_organization": org_memberships[0] if org_memberships else None,
        "organizations": org_memberships,
    }


@router.post("/auth/login", tags=["Authentication"])
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Authenticate user credentials and issue JWT access + refresh tokens."""
    user = (
        db.query(User)
        .filter(User.email == payload.email.lower().strip(), User.is_active.is_(True))
        .first()
    )
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email address or password.",
        )

    user.last_login_at = datetime.now(timezone.utc)
    org_memberships = _serialize_user_memberships(db, user)
    if not org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User has no active organisation memberships.",
        )

    active_org = org_memberships[0]
    raw_refresh, refresh_hash, expires_at = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            expires_at=expires_at,
            user_agent=request.headers.get("user-agent", "")[:250],
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
    )
    record_audit_log(
        db=db,
        organization_id=active_org["organization_id"],
        actor=user,
        action="AUTH_LOGIN",
        entity_type="USER",
        entity_id=user.id,
        summary=f"User {user.email} signed in to workspace '{active_org['organization_name']}'.",
        request=request,
    )
    db.commit()

    access_token = create_access_token(
        subject=user.id,
        organization_id=active_org["organization_id"],
        role_code=active_org["role_code"],
    )

    return {
        "access_token": access_token,
        "refresh_token": raw_refresh,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "phone": user.phone,
            "job_title": user.job_title,
        },
        "active_organization": active_org,
        "organizations": org_memberships,
    }


@router.post("/auth/refresh", tags=["Authentication"])
def refresh_access_token(
    payload: RefreshTokenRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Rotate refresh token and issue a fresh JWT access token."""
    token_hash = hash_token(payload.refresh_token)
    stored = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash, RefreshToken.revoked_at.is_(None))
        .first()
    )
    if not stored:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked refresh token.",
        )

    now = datetime.now(timezone.utc)
    expires_at = stored.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired.",
        )

    user = db.query(User).filter(User.id == stored.user_id, User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive.")

    stored.revoked_at = now
    new_raw, new_hash, new_exp = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=new_hash,
            expires_at=new_exp,
            user_agent=request.headers.get("user-agent", "")[:250],
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
    )
    db.commit()

    org_memberships = _serialize_user_memberships(db, user)
    active_org = org_memberships[0] if org_memberships else None
    access_token = create_access_token(
        subject=user.id,
        organization_id=active_org["organization_id"] if active_org else None,
        role_code=active_org["role_code"] if active_org else None,
    )
    return {
        "access_token": access_token,
        "refresh_token": new_raw,
        "token_type": "bearer",
    }


@router.post("/auth/logout", tags=["Authentication"])
def logout(
    payload: RefreshTokenRequest,
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Revoke refresh token on sign-out."""
    token_hash = hash_token(payload.refresh_token)
    stored = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if stored and stored.revoked_at is None:
        stored.revoked_at = datetime.now(timezone.utc)
        db.commit()
    return {"status": "logged_out"}


@router.get("/auth/me", tags=["Authentication"])
def get_me(
    ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return current authenticated user, active organisation, role, permissions, and preferences."""
    org_memberships = _serialize_user_memberships(db, ctx.user)
    prefs = (
        db.query(NotificationPreference)
        .filter(
            NotificationPreference.user_id == ctx.user.id,
            NotificationPreference.organization_id == ctx.organization.id,
        )
        .first()
    )
    return {
        "user": {
            "id": ctx.user.id,
            "email": ctx.user.email,
            "full_name": ctx.user.full_name,
            "phone": ctx.user.phone,
            "job_title": ctx.user.job_title,
            "last_login_at": ctx.user.last_login_at.isoformat() if ctx.user.last_login_at else None,
        },
        "active_organization": {
            "organization_id": ctx.organization.id,
            "organization_name": ctx.organization.name,
            "organization_slug": ctx.organization.slug,
            "industry": ctx.organization.industry,
            "gstin": ctx.organization.gstin,
            "city": ctx.organization.city,
            "state": ctx.organization.state,
            "currency": ctx.organization.currency,
            "role_code": ctx.role.code,
            "role_name": ctx.role.name,
            "permissions": sorted(list(ctx.permissions)),
        },
        "organizations": org_memberships,
        "notification_preferences": {
            "in_app_enabled": prefs.in_app_enabled if prefs else True,
            "email_enabled": prefs.email_enabled if prefs else True,
            "low_stock_alerts": prefs.low_stock_alerts if prefs else True,
            "approval_reminders": prefs.approval_reminders if prefs else True,
            "payment_due_alerts": prefs.payment_due_alerts if prefs else True,
            "ai_digest_enabled": prefs.ai_digest_enabled if prefs else True,
        },
    }


@router.patch("/auth/profile", tags=["Authentication"])
def update_user_profile(
    payload: UserProfileUpdateRequest,
    ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Update user profile and notification preferences."""
    if payload.full_name is not None:
        ctx.user.full_name = payload.full_name.strip()
    if payload.phone is not None:
        ctx.user.phone = payload.phone
    if payload.job_title is not None:
        ctx.user.job_title = payload.job_title

    prefs = (
        db.query(NotificationPreference)
        .filter(
            NotificationPreference.user_id == ctx.user.id,
            NotificationPreference.organization_id == ctx.organization.id,
        )
        .first()
    )
    if not prefs:
        prefs = NotificationPreference(user_id=ctx.user.id, organization_id=ctx.organization.id)
        db.add(prefs)

    for field in (
        "in_app_enabled",
        "email_enabled",
        "low_stock_alerts",
        "approval_reminders",
        "payment_due_alerts",
        "ai_digest_enabled",
    ):
        val = getattr(payload, field)
        if val is not None:
            setattr(prefs, field, val)

    db.commit()
    return {"status": "updated", "full_name": ctx.user.full_name}


# =============================================================================
# ORGANISATIONS
# =============================================================================


@router.get("/organizations/me", tags=["Organisations"])
def get_my_organizations(
    ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return active organisation profile + settings and all organisations the user belongs to."""
    settings = (
        db.query(OrganizationSettings)
        .filter(OrganizationSettings.organization_id == ctx.organization.id)
        .first()
    )
    return {
        "active_organization": {
            "id": ctx.organization.id,
            "name": ctx.organization.name,
            "slug": ctx.organization.slug,
            "legal_name": ctx.organization.legal_name,
            "gstin": ctx.organization.gstin,
            "pan": ctx.organization.pan,
            "msme_udyam_no": ctx.organization.msme_udyam_no,
            "industry": ctx.organization.industry,
            "currency": ctx.organization.currency,
            "address": ctx.organization.address,
            "city": ctx.organization.city,
            "state": ctx.organization.state,
            "pincode": ctx.organization.pincode,
            "phone": ctx.organization.phone,
            "email": ctx.organization.email,
            "role_code": ctx.role.code,
            "role_name": ctx.role.name,
            "settings": {
                "default_tax_rate": float(settings.default_tax_rate) if settings else 18.0,
                "date_format": settings.date_format if settings else "DD/MM/YYYY",
                "timezone": settings.timezone if settings else "Asia/Kolkata",
                "fiscal_year_start_month": settings.fiscal_year_start_month if settings else 4,
                "po_approval_threshold": float(settings.po_approval_threshold) if settings else 50000.0,
                "low_stock_alerts_enabled": settings.low_stock_alerts_enabled if settings else True,
                "duplicate_invoice_check_enabled": settings.duplicate_invoice_check_enabled if settings else True,
                "document_retention_days": settings.document_retention_days if settings else 2555,
            },
        },
        "organizations": _serialize_user_memberships(db, ctx.user),
    }


@router.post("/organizations", status_code=status.HTTP_201_CREATED, tags=["Organisations"])
def create_new_organization(
    payload: OrganizationCreateRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Create a new multi-tenant organisation workspace for the current user."""
    role_map = ensure_system_roles_and_permissions(db)
    base_slug = slugify(payload.name)
    slug = base_slug
    if db.query(Organization).filter(Organization.slug == slug).first():
        slug = f"{base_slug}-{str(uuid.uuid4())[:6]}"

    org = Organization(
        name=payload.name.strip(),
        slug=slug,
        legal_name=payload.legal_name or payload.name.strip(),
        gstin=payload.gstin,
        pan=payload.pan,
        msme_udyam_no=payload.msme_udyam_no,
        industry=payload.industry,
        currency="INR",
        city=payload.city or "Pune",
        state=payload.state or "Maharashtra",
        address=payload.address,
        phone=payload.phone,
        email=payload.email or user.email,
    )
    db.add(org)
    db.flush()

    db.add(
        Membership(
            user_id=user.id,
            organization_id=org.id,
            role_id=role_map["OWNER"].id,
            department="Executive Management",
            status="ACTIVE",
            is_default=False,
        )
    )
    db.flush()

    if payload.seed_demo_data:
        seed_organization_operational_data(db, org, user)
    else:
        bootstrap_organization_defaults(db, org)

    record_audit_log(
        db=db,
        organization_id=org.id,
        actor=user,
        action="ORGANIZATION_CREATED",
        entity_type="ORGANIZATION",
        entity_id=org.id,
        summary=f"Created new organisation workspace '{org.name}'.",
        request=request,
    )
    db.commit()

    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "industry": org.industry,
        "gstin": org.gstin,
        "city": org.city,
        "state": org.state,
        "organizations": _serialize_user_memberships(db, user),
    }


@router.get("/organizations/{org_id}", tags=["Organisations"])
def get_organization_by_id(
    org_id: str,
    ctx: TenantContext = Depends(require_permissions("org:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Retrieve organisation details (strictly isolated to member workspaces)."""
    membership = (
        db.query(Membership)
        .filter(
            Membership.user_id == ctx.user.id,
            Membership.organization_id == org_id,
            Membership.status == "ACTIVE",
        )
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You cannot access another organisation's records.",
        )

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organisation not found.")

    settings = db.query(OrganizationSettings).filter(OrganizationSettings.organization_id == org.id).first()
    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "legal_name": org.legal_name,
        "gstin": org.gstin,
        "pan": org.pan,
        "msme_udyam_no": org.msme_udyam_no,
        "industry": org.industry,
        "currency": org.currency,
        "city": org.city,
        "state": org.state,
        "address": org.address,
        "phone": org.phone,
        "email": org.email,
        "settings": {
            "default_tax_rate": float(settings.default_tax_rate) if settings else 18.0,
            "po_approval_threshold": float(settings.po_approval_threshold) if settings else 50000.0,
            "document_retention_days": settings.document_retention_days if settings else 2555,
        },
    }


@router.patch("/organizations/{org_id}", tags=["Organisations"])
def update_organization(
    org_id: str,
    payload: OrganizationUpdateRequest,
    request: Request,
    ctx: TenantContext = Depends(require_permissions("org:manage")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Update organisation business profile and operational settings."""
    if org_id != ctx.organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cross-tenant modification denied.")

    org = ctx.organization
    for attr in ("name", "legal_name", "gstin", "pan", "msme_udyam_no", "industry", "city", "state", "address", "phone", "email"):
        val = getattr(payload, attr)
        if val is not None:
            setattr(org, attr, val)

    settings = (
        db.query(OrganizationSettings).filter(OrganizationSettings.organization_id == org.id).first()
    )
    if not settings:
        settings = OrganizationSettings(organization_id=org.id)
        db.add(settings)

    for s_attr in (
        "default_tax_rate",
        "po_approval_threshold",
        "low_stock_alerts_enabled",
        "duplicate_invoice_check_enabled",
        "document_retention_days",
    ):
        val = getattr(payload, s_attr)
        if val is not None:
            setattr(settings, s_attr, val)

    record_audit_log(
        db=db,
        organization_id=org.id,
        actor=ctx.user,
        action="ORGANIZATION_SETTINGS_UPDATED",
        entity_type="ORGANIZATION",
        entity_id=org.id,
        summary=f"Updated business profile & operational settings for '{org.name}'.",
        request=request,
    )
    db.commit()
    return {"status": "updated", "organization_id": org.id, "name": org.name}


# =============================================================================
# MEMBERS & RBAC ROLES
# =============================================================================


@router.get("/members", tags=["Members & RBAC"])
def list_organization_members(
    ctx: TenantContext = Depends(require_permissions("org:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """List all members and roles in the active organisation."""
    memberships = (
        db.query(Membership)
        .filter(Membership.organization_id == ctx.organization.id)
        .order_by(Membership.created_at.asc())
        .all()
    )
    items = []
    for m in memberships:
        u = db.query(User).filter(User.id == m.user_id).first()
        r = db.query(Role).filter(Role.id == m.role_id).first()
        if u and r:
            items.append(
                {
                    "id": m.id,
                    "user_id": u.id,
                    "full_name": u.full_name,
                    "email": u.email,
                    "phone": u.phone,
                    "job_title": u.job_title,
                    "department": m.department,
                    "role_code": r.code,
                    "role_name": r.name,
                    "status": m.status,
                    "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
                    "joined_at": m.created_at.isoformat() if m.created_at else None,
                }
            )
    return {
        "items": items,
        "total": len(items),
        "available_roles": ROLE_DEFINITIONS,
    }


@router.post("/members/invite", status_code=status.HTTP_201_CREATED, tags=["Members & RBAC"])
def invite_organization_member(
    payload: MemberInviteRequest,
    request: Request,
    ctx: TenantContext = Depends(require_permissions("org:manage")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Invite or add a user to the current organisation with a designated RBAC role."""
    role_map = ensure_system_roles_and_permissions(db)
    target_role = role_map.get(payload.role_code)
    if not target_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role code: {payload.role_code}",
        )

    email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            full_name=payload.full_name.strip(),
            phone=payload.phone,
            job_title=payload.department,
            hashed_password=hash_password(payload.temporary_password or "Sutradhar@123"),
            is_active=True,
        )
        db.add(user)
        db.flush()

    existing_mem = (
        db.query(Membership)
        .filter(
            Membership.user_id == user.id,
            Membership.organization_id == ctx.organization.id,
        )
        .first()
    )
    if existing_mem:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this organisation.",
        )

    mem = Membership(
        user_id=user.id,
        organization_id=ctx.organization.id,
        role_id=target_role.id,
        department=payload.department,
        status="ACTIVE",
        is_default=False,
        invited_email=email,
    )
    db.add(mem)
    record_audit_log(
        db=db,
        organization_id=ctx.organization.id,
        actor=ctx.user,
        action="MEMBER_INVITED",
        entity_type="MEMBERSHIP",
        entity_id=mem.id,
        summary=f"Invited {user.full_name} ({user.email}) with role {target_role.name}.",
        request=request,
    )
    db.commit()

    return {
        "id": mem.id,
        "user_id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role_code": target_role.code,
        "role_name": target_role.name,
        "department": mem.department,
        "status": mem.status,
    }


@router.patch("/members/{membership_id}/role", tags=["Members & RBAC"])
def update_member_role(
    membership_id: str,
    payload: MemberRoleUpdateRequest,
    request: Request,
    ctx: TenantContext = Depends(require_permissions("org:manage")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Update a member's RBAC role, department, or status within the active organisation."""
    mem = (
        db.query(Membership)
        .filter(
            Membership.id == membership_id,
            Membership.organization_id == ctx.organization.id,
        )
        .first()
    )
    if not mem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found.")

    role_map = ensure_system_roles_and_permissions(db)
    target_role = role_map.get(payload.role_code)
    if not target_role:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role code.")

    mem.role_id = target_role.id
    if payload.department is not None:
        mem.department = payload.department
    if payload.status is not None:
        mem.status = payload.status

    record_audit_log(
        db=db,
        organization_id=ctx.organization.id,
        actor=ctx.user,
        action="MEMBER_ROLE_UPDATED",
        entity_type="MEMBERSHIP",
        entity_id=mem.id,
        summary=f"Updated member {mem.id} role to {target_role.code}.",
        request=request,
    )
    db.commit()
    return {
        "id": mem.id,
        "role_code": target_role.code,
        "role_name": target_role.name,
        "department": mem.department,
        "status": mem.status,
    }

