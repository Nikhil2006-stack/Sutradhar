"""Pydantic v2 request and response schemas for Sutradhar REST API."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Auth & Organisation Schemas ---


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    phone: Optional[str] = None
    job_title: Optional[str] = "Founder & Managing Director"
    organization_name: str = Field(..., min_length=2, max_length=200)
    industry: str = "Manufacturing & Wholesale Distribution"
    gstin: Optional[str] = None
    city: Optional[str] = "Pune"
    state: Optional[str] = "Maharashtra"
    seed_demo_data: bool = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class OrganizationCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    legal_name: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    msme_udyam_no: Optional[str] = None
    industry: str = "Manufacturing & Distribution"
    city: Optional[str] = "Pune"
    state: Optional[str] = "Maharashtra"
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    seed_demo_data: bool = False


class OrganizationUpdateRequest(BaseModel):
    name: Optional[str] = None
    legal_name: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    msme_udyam_no: Optional[str] = None
    industry: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    default_tax_rate: Optional[Decimal] = None
    po_approval_threshold: Optional[Decimal] = None
    low_stock_alerts_enabled: Optional[bool] = None
    duplicate_invoice_check_enabled: Optional[bool] = None
    document_retention_days: Optional[int] = None


class MemberInviteRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=150)
    role_code: str = "PROCUREMENT_OFFICER"
    department: str = "Procurement"
    phone: Optional[str] = None
    temporary_password: Optional[str] = "Sutradhar@123"


class MemberRoleUpdateRequest(BaseModel):
    role_code: str
    department: Optional[str] = None
    status: Optional[str] = None


class UserProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    in_app_enabled: Optional[bool] = None
    email_enabled: Optional[bool] = None
    low_stock_alerts: Optional[bool] = None
    approval_reminders: Optional[bool] = None
    payment_due_alerts: Optional[bool] = None
    ai_digest_enabled: Optional[bool] = None


# --- Product, Warehouse & Inventory Schemas ---


class ProductCreateRequest(BaseModel):
    sku: str = Field(..., min_length=2, max_length=60)
    name: str = Field(..., min_length=2, max_length=200)
    barcode: Optional[str] = None
    hsn_code: Optional[str] = "8481"
    category_name: str = "Industrial Components"
    uom_symbol: str = "PCS"
    unit_cost: Decimal = Decimal("0.00")
    selling_price: Decimal = Decimal("0.00")
    tax_rate: Decimal = Decimal("18.00")
    reorder_point: Decimal = Decimal("50.00")
    safety_stock: Decimal = Decimal("20.00")
    lead_time_days: int = 7
    avg_daily_demand: Decimal = Decimal("5.00")
    preferred_supplier_id: Optional[str] = None
    is_batch_tracked: bool = False
    description: Optional[str] = None
    initial_stock: Decimal = Decimal("0.00")
    warehouse_id: Optional[str] = None


class ProductUpdateRequest(BaseModel):
    name: Optional[str] = None
    barcode: Optional[str] = None
    hsn_code: Optional[str] = None
    category_name: Optional[str] = None
    uom_symbol: Optional[str] = None
    unit_cost: Optional[Decimal] = None
    selling_price: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = None
    reorder_point: Optional[Decimal] = None
    safety_stock: Optional[Decimal] = None
    lead_time_days: Optional[int] = None
    avg_daily_demand: Optional[Decimal] = None
    preferred_supplier_id: Optional[str] = None
    is_active: Optional[bool] = None


class WarehouseCreateRequest(BaseModel):
    code: str = Field(..., min_length=2, max_length=40)
    name: str = Field(..., min_length=2, max_length=150)
    city: str = "Pune"
    state: str = "Maharashtra"
    address: Optional[str] = None
    manager_name: Optional[str] = None
    capacity_units: int = 10000
    is_primary: bool = False


class StockMovementCreateRequest(BaseModel):
    product_id: str
    warehouse_id: str
    movement_type: str = Field(..., pattern="^(IN|OUT|ADJUSTMENT|TRANSFER_IN|TRANSFER_OUT|GRN_RECEIPT)$")
    quantity: Decimal = Field(..., gt=0)
    unit_cost: Optional[Decimal] = None
    reference_type: Optional[str] = "MANUAL"
    reference_id: Optional[str] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[date] = None
    notes: Optional[str] = None


# --- Supplier & Procurement Schemas ---


class SupplierCreateRequest(BaseModel):
    code: Optional[str] = None
    name: str = Field(..., min_length=2, max_length=200)
    category: str = "Raw Materials & Components"
    gstin: Optional[str] = None
    pan: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = "Mumbai"
    state: Optional[str] = "Maharashtra"
    payment_terms_days: int = 30
    lead_time_days: int = 7
    contact_name: Optional[str] = None
    contact_designation: Optional[str] = "Sales Manager"
    notes: Optional[str] = None


class PurchaseRequestItemInput(BaseModel):
    product_id: str
    quantity: Decimal = Field(..., gt=0)
    estimated_unit_price: Optional[Decimal] = None
    notes: Optional[str] = None


class PurchaseRequestCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    warehouse_id: Optional[str] = None
    priority: str = "HIGH"
    required_by_date: Optional[date] = None
    notes: Optional[str] = None
    items: List[PurchaseRequestItemInput]


class PurchaseOrderItemInput(BaseModel):
    product_id: str
    ordered_qty: Decimal = Field(..., gt=0)
    unit_price: Decimal = Field(..., ge=0)
    tax_rate: Decimal = Decimal("18.00")


class PurchaseOrderCreate(BaseModel):
    supplier_id: str
    warehouse_id: Optional[str] = None
    purchase_request_id: Optional[str] = None
    quotation_id: Optional[str] = None
    expected_delivery_date: Optional[date] = None
    payment_terms_days: int = 30
    notes: Optional[str] = None
    items: List[PurchaseOrderItemInput]


class ApprovalDecisionRequest(BaseModel):
    comments: Optional[str] = None


class RFQCreateRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    product_id: str
    required_qty: Decimal = Field(..., gt=0)
    purchase_request_id: Optional[str] = None
    deadline_date: Optional[date] = None
    notes: Optional[str] = None


class QuotationCreateRequest(BaseModel):
    rfq_id: Optional[str] = None
    supplier_id: str
    product_id: str
    quantity: Decimal = Field(..., gt=0)
    unit_price: Decimal = Field(..., gt=0)
    tax_rate: Decimal = Decimal("18.00")
    delivery_days: int = 7
    payment_terms_days: int = 30
    validity_date: Optional[date] = None
    notes: Optional[str] = None


class GoodsReceiptItemInput(BaseModel):
    product_id: str
    ordered_qty: Decimal = Decimal("0.00")
    received_qty: Decimal = Field(..., gt=0)
    accepted_qty: Decimal = Field(..., ge=0)
    rejected_qty: Decimal = Decimal("0.00")
    batch_number: Optional[str] = None
    expiry_date: Optional[date] = None
    remarks: Optional[str] = None


class GoodsReceiptCreateRequest(BaseModel):
    purchase_order_id: str
    warehouse_id: Optional[str] = None
    supplier_challan_no: Optional[str] = None
    notes: Optional[str] = None
    items: List[GoodsReceiptItemInput]


# --- Document, Invoice & Finance Schemas ---


class DocumentVerifyRequest(BaseModel):
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = None
    supplier_gstin: Optional[str] = None
    po_reference: Optional[str] = None
    subtotal: Decimal = Decimal("0.00")
    tax_amount: Decimal = Decimal("0.00")
    total_amount: Decimal = Decimal("0.00")
    create_payable_invoice: bool = True
    notes: Optional[str] = None


class InvoiceCreateRequest(BaseModel):
    invoice_number: str
    invoice_type: str = "PAYABLE"  # PAYABLE | RECEIVABLE
    supplier_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_gstin: Optional[str] = None
    purchase_order_id: Optional[str] = None
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    subtotal: Decimal
    tax_amount: Decimal = Decimal("0.00")
    total_amount: Decimal
    notes: Optional[str] = None


class PaymentCreateRequest(BaseModel):
    amount: Decimal = Field(..., gt=0)
    payment_method: str = "NEFT"
    reference_utr: Optional[str] = None
    payment_date: Optional[date] = None
    notes: Optional[str] = None


class ExpenseCreateRequest(BaseModel):
    category: str = "LOGISTICS"
    vendor_name: str
    expense_date: Optional[date] = None
    amount: Decimal = Field(..., gt=0)
    tax_amount: Decimal = Decimal("0.00")
    payment_status: str = "PAID"
    notes: Optional[str] = None


# --- AI, Automation & Task Schemas ---


class AIAskRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=1000)
    conversation_id: Optional[str] = None


class AIExtractAdhocRequest(BaseModel):
    raw_text: str = Field(..., min_length=10)
    doc_type: str = "INVOICE"


class AIRecommendationFeedbackRequest(BaseModel):
    helpful: Optional[bool] = True
    status: Optional[str] = None  # APPROVED_AND_EXECUTED | DISMISSED
    notes: Optional[str] = None


class WorkflowRuleCreateRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=180)
    description: Optional[str] = None
    trigger_event: str  # LOW_STOCK | INVOICE_OVERDUE | PO_APPROVAL_PENDING | SUPPLIER_HIGH_RISK | LARGE_STOCK_ADJUSTMENT
    condition_json: Dict[str, Any] = Field(default_factory=dict)
    action_type: str  # CREATE_TASK | SEND_NOTIFICATION | ESCALATE_APPROVAL | GENERATE_DRAFT_PR
    action_config_json: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


class TaskCreateRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=220)
    description: Optional[str] = None
    category: str = "OPERATIONS"
    priority: str = "HIGH"
    assigned_to_id: Optional[str] = None
    due_date: Optional[date] = None


class TaskUpdateRequest(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[date] = None

