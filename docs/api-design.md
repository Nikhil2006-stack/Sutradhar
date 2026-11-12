# Sutradhar — REST API Architecture (`/api/v1`)

## 1. API Design Standards
- **Base Prefix**: `/api/v1`
- **Documentation**: Interactive OpenAPI 3.1 / Swagger UI at `/docs` and ReDoc at `/redoc`.
- **Authentication**: `Authorization: Bearer <access_token>` (JWT). Refresh tokens issued and rotated via `/api/v1/auth/refresh`.
- **Tenant Isolation**: Active organisation resolved from `X-Organization-Id` request header (or user's default organisation membership) and validated against active `Membership` + role permissions.
- **Standard Response & Error Envelope**: Consistent Pydantic v2 schemas, pagination (`items`, `total`, `page`, `size`), filtering, and structured HTTP exception responses.

## 2. Endpoint Reference Matrix

### Authentication & Identity (`/api/v1/auth`)
- `POST /api/v1/auth/register` — Register user and optionally bootstrap initial organisation.
- `POST /api/v1/auth/login` — Authenticate with email/password; returns access token, refresh token, user profile, and organisation memberships.
- `POST /api/v1/auth/refresh` — Rotate refresh token and issue new access token.
- `POST /api/v1/auth/logout` — Revoke active refresh token.
- `GET /api/v1/auth/me` — Current authenticated user profile, active organisation, role, and permissions.

### Organisations & Members (`/api/v1/organizations`, `/api/v1/members`)
- `GET /api/v1/organizations/me` — List all organisations the user belongs to and active organisation details.
- `POST /api/v1/organizations` — Create a new multi-tenant organisation workspace with default roles, UoMs, categories, and settings.
- `GET /api/v1/organizations/{id}` — Retrieve organisation profile and settings.
- `PATCH /api/v1/organizations/{id}` — Update organisation profile and operational settings.
- `GET /api/v1/members` — List organisation members, roles, departments, and status.
- `POST /api/v1/members/invite` — Invite or provision a team member with a specific role.
- `PATCH /api/v1/members/{id}/role` — Update member role or status.

### Products & Inventory Intelligence (`/api/v1/products`, `/api/v1/inventory`, `/api/v1/warehouses`)
- `GET /api/v1/products` — Paginated product catalogue with search, category filter, low-stock filter, and live stock totals.
- `POST /api/v1/products` — Create SKU with HSN code, GST rate, reorder point, safety stock, and initial stock optional ledger entry.
- `PATCH /api/v1/products/{id}` — Update product specifications and reorder thresholds.
- `DELETE /api/v1/products/{id}` — Soft-deactivate product SKU.
- `GET /api/v1/warehouses` — List organisation warehouses and stock valuations.
- `POST /api/v1/warehouses` — Create warehouse location.
- `GET /api/v1/inventory/balances` — Multi-warehouse stock balances (`on_hand`, `reserved`, `available`, valuation, reorder status).
- `POST /api/v1/inventory/movements` — Record atomic stock movement (`IN`, `OUT`, `ADJUSTMENT`, `TRANSFER`) updating `inventory_balances`.
- `GET /api/v1/inventory/movements` — Immutable stock movement ledger with filters.
- `GET /api/v1/inventory/alerts` — Low-stock, stockout risk, dead-stock, and expiring batch alerts.
- `GET /api/v1/inventory/forecast` — SKU-level demand forecasting, reorder point calculation, and baseline vs Holt-Winters/Linear trend error evaluation.

### Suppliers & Procurement (`/api/v1/suppliers`, `/api/v1/purchase-requests`, `/api/v1/purchase-orders`, `/api/v1/rfqs`, `/api/v1/quotations`, `/api/v1/approvals`, `/api/v1/goods-receipts`)
- `GET /api/v1/suppliers` — Supplier directory with reliability scores and risk categories.
- `POST /api/v1/suppliers` — Onboard new supplier with GSTIN, payment terms, and lead time.
- `GET /api/v1/suppliers/{id}` — Detailed supplier profile, contacts, PO history, and documents.
- `GET /api/v1/suppliers/{id}/performance` — Explainable supplier reliability scorecard and price fluctuation history.
- `POST /api/v1/purchase-requests` & `GET /api/v1/purchase-requests` — Create and list purchase requisitions; auto-creates approval workflow entries.
- `POST /api/v1/purchase-orders` & `GET /api/v1/purchase-orders` & `GET /api/v1/purchase-orders/{id}` — Create, list, and inspect purchase orders.
- `GET /api/v1/approvals`, `POST /api/v1/approvals/{id}/approve`, `POST /api/v1/approvals/{id}/reject` — Multi-level approval centre.
- `POST /api/v1/rfqs`, `GET /api/v1/rfqs`, `POST /api/v1/quotations`, `GET /api/v1/quotations/compare` — RFQ management and side-by-side supplier quotation comparison.
- `POST /api/v1/goods-receipts` & `GET /api/v1/goods-receipts` — Goods Receipt Notes (GRN) that verify received quantities, update PO fulfillment status, and post stock-in ledger movements.

### AI Document Intelligence & Finance (`/api/v1/documents`, `/api/v1/invoices`, `/api/v1/finance`)
- `POST /api/v1/documents/upload` — Upload PDF/image with SHA-256 duplicate detection and private storage.
- `GET /api/v1/documents` & `GET /api/v1/documents/{id}` — List and inspect documents and extraction payloads.
- `POST /api/v1/documents/{id}/process` — Trigger OCR, classification, structured field extraction, and RAG chunk indexing.
- `POST /api/v1/documents/{id}/verify` — Human verification and correction of extracted fields; optionally creates verified Payable Invoice and matches against PO.
- `POST /api/v1/invoices`, `GET /api/v1/invoices`, `POST /api/v1/invoices/{id}/verify`, `POST /api/v1/invoices/{id}/payments` — Accounts payable & receivable management and 3-way PO matching.
- `GET /api/v1/finance/payables`, `GET /api/v1/finance/receivables`, `GET /api/v1/finance/cashflow`, `GET /api/v1/finance/expenses`, `POST /api/v1/finance/expenses` — Financial intelligence, aging buckets, cash-flow projections, and P&L summary.

### AI Decision Engine, Automation, Analytics, Notifications & Audit
- `POST /api/v1/ai/ask` — Tenant-isolated RAG + business database query assistant with source citations.
- `POST /api/v1/ai/extract` — Ad-hoc text/document structured extraction endpoint.
- `GET /api/v1/ai/recommendations` — Signature Business Intelligence & Action Engine recommendations across all 10 operational risk scenarios.
- `POST /api/v1/ai/recommendations/generate` — Re-evaluate live operational ledger and generate fresh explainable recommendations.
- `POST /api/v1/ai/recommendations/{id}/approve` — Human approval to execute the recommended business action (e.g., create draft PR/PO, create follow-up task, flag discrepancy) with full audit logging.
- `POST /api/v1/ai/recommendations/{id}/feedback` — Submit feedback or dismiss recommendation.
- `GET /api/v1/workflow-rules`, `POST /api/v1/workflow-rules`, `POST /api/v1/workflow-rules/evaluate`, `GET /api/v1/workflow-runs` — Custom automation rules and execution logs.
- `GET /api/v1/tasks`, `POST /api/v1/tasks`, `PATCH /api/v1/tasks/{id}` — Operational task management.
- `GET /api/v1/analytics/overview`, `GET /api/v1/analytics/inventory`, `GET /api/v1/analytics/suppliers`, `GET /api/v1/analytics/finance` — Real-time aggregated KPIs and chart series.
- `GET /api/v1/notifications`, `PATCH /api/v1/notifications/{id}/read`, `POST /api/v1/notifications/read-all` — In-app notification centre.
- `GET /api/v1/audit-logs` — Immutable tenant-scoped security and operational audit trail.

