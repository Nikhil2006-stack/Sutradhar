"""Role-Based Access Control (RBAC) roles and granular permission matrix."""

from __future__ import annotations

from typing import Dict, List, Set

ROLE_OWNER = "OWNER"
ROLE_OPERATIONS_MANAGER = "OPERATIONS_MANAGER"
ROLE_FINANCE_MANAGER = "FINANCE_MANAGER"
ROLE_PROCUREMENT_OFFICER = "PROCUREMENT_OFFICER"
ROLE_WAREHOUSE_EMPLOYEE = "WAREHOUSE_EMPLOYEE"
ROLE_AUDITOR = "AUDITOR"

ALL_PERMISSIONS: Dict[str, tuple[str, str]] = {
    "org:read": ("organization", "View organisation profile and settings"),
    "org:manage": ("organization", "Manage organisation settings, members, and roles"),
    "inventory:read": ("inventory", "View products, warehouses, balances, and alerts"),
    "inventory:write": ("inventory", "Create/update products, warehouses, and stock movements"),
    "inventory:approve": ("inventory", "Approve stock adjustments"),
    "suppliers:read": ("suppliers", "View supplier directory and performance analytics"),
    "suppliers:write": ("suppliers", "Onboard and update suppliers and supplier documents"),
    "procurement:read": ("procurement", "View purchase requests, RFQs, quotations, POs, and GRNs"),
    "procurement:write": ("procurement", "Create purchase requests, RFQs, quotations, POs, and GRNs"),
    "procurement:approve": ("procurement", "Approve or reject purchase requests and purchase orders"),
    "documents:read": ("documents", "View and search uploaded business documents"),
    "documents:write": ("documents", "Upload and process invoices, receipts, and contracts"),
    "documents:verify": ("documents", "Verify extracted document data into business records"),
    "finance:read": ("finance", "View payables, receivables, expenses, and cashflow analytics"),
    "finance:write": ("finance", "Record invoices, payments, and expenses"),
    "ai:read": ("ai", "Query AI assistant and view business recommendations"),
    "ai:action_approve": ("ai", "Approve and execute AI-recommended business actions"),
    "workflows:read": ("workflows", "View workflow automation rules, runs, and tasks"),
    "workflows:write": ("workflows", "Create and manage workflow automation rules and tasks"),
    "audit:read": ("security", "Inspect immutable organisation audit logs"),
}

ROLE_DEFINITIONS: List[Dict[str, object]] = [
    {
        "code": ROLE_OWNER,
        "name": "Organisation Owner / Super Admin",
        "description": "Full administrative and operational control across the organisation.",
        "permissions": list(ALL_PERMISSIONS.keys()),
    },
    {
        "code": ROLE_OPERATIONS_MANAGER,
        "name": "Operations Manager",
        "description": "Manages inventory, warehouses, suppliers, procurement, approvals, and workflows.",
        "permissions": [
            "org:read",
            "inventory:read",
            "inventory:write",
            "inventory:approve",
            "suppliers:read",
            "suppliers:write",
            "procurement:read",
            "procurement:write",
            "procurement:approve",
            "documents:read",
            "documents:write",
            "documents:verify",
            "finance:read",
            "ai:read",
            "ai:action_approve",
            "workflows:read",
            "workflows:write",
            "audit:read",
        ],
    },
    {
        "code": ROLE_FINANCE_MANAGER,
        "name": "Finance Manager",
        "description": "Manages accounts payable, receivable, invoices, payments, cashflow, and financial approvals.",
        "permissions": [
            "org:read",
            "inventory:read",
            "suppliers:read",
            "procurement:read",
            "procurement:approve",
            "documents:read",
            "documents:write",
            "documents:verify",
            "finance:read",
            "finance:write",
            "ai:read",
            "ai:action_approve",
            "workflows:read",
            "audit:read",
        ],
    },
    {
        "code": ROLE_PROCUREMENT_OFFICER,
        "name": "Procurement Officer",
        "description": "Manages suppliers, RFQs, quotations, purchase requests, and purchase orders.",
        "permissions": [
            "org:read",
            "inventory:read",
            "suppliers:read",
            "suppliers:write",
            "procurement:read",
            "procurement:write",
            "documents:read",
            "documents:write",
            "ai:read",
            "workflows:read",
        ],
    },
    {
        "code": ROLE_WAREHOUSE_EMPLOYEE,
        "name": "Warehouse Employee",
        "description": "Handles stock-in/out movements, batch tracking, barcode lookups, and Goods Receipt Notes.",
        "permissions": [
            "org:read",
            "inventory:read",
            "inventory:write",
            "procurement:read",
            "procurement:write",
            "documents:read",
            "documents:write",
            "workflows:read",
        ],
    },
    {
        "code": ROLE_AUDITOR,
        "name": "Auditor / Read-Only User",
        "description": "Read-only access across inventory, procurement, finance, documents, and audit logs.",
        "permissions": [
            "org:read",
            "inventory:read",
            "suppliers:read",
            "procurement:read",
            "documents:read",
            "finance:read",
            "ai:read",
            "workflows:read",
            "audit:read",
        ],
    },
]


def get_permissions_for_role(role_code: str) -> Set[str]:
    """Return the set of permission codes granted to a role code."""
    for role_def in ROLE_DEFINITIONS:
        if role_def["code"] == role_code:
            return set(role_def["permissions"])  # type: ignore[arg-type]
    return {"org:read"}

