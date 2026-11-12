# Changelog

All notable changes to the **Sutradhar** platform are documented in this file.

## [1.0.0] - 2026-11-12

### Added
- **Multi-Tenant Architecture & RBAC**:
  - Multi-organisation workspace support with secure tenant switching (`X-Org-ID` + JWT validation) and strict tenant row isolation.
  - 6 Indian MSME roles (`OWNER`, `OPERATIONS_MANAGER`, `FINANCE_MANAGER`, `PROCUREMENT_OFFICER`, `WAREHOUSE_EMPLOYEE`, `AUDITOR`) with 30 granular permissions enforced via backend FastAPI dependencies (`require_permission`).
  - Immutable audit log (`audit_logs`) tracking user, organisation, role, IP address, and before/after JSON payloads.
- **Module B — AI Document Intelligence**:
  - Upload and processing pipeline for PDFs and images using PyMuPDF, pypdf, and Tesseract OCR fallback.
  - Automatic document classification (`INVOICE`, `PURCHASE_ORDER`, `RECEIPT`, `QUOTATION`, `CONTRACT`), Indian GSTIN regex extraction, line-item parsing, and confidence scoring.
  - Duplicate invoice detection via SHA-256 file hash and `(supplier, invoice_number, total_amount)` fingerprinting.
  - Human-in-the-loop verification workflow that creates a 3-way matched Accounts Payable invoice upon operator approval.
- **Module C — Multi-Warehouse Inventory Intelligence**:
  - Product catalogue with HSN codes, GST percentages, UOMs (`PCS`, `KG`, `BOX`, `MTR`, `LTR`), and barcode support.
  - Multi-warehouse stock ledger (`stock_ledger_entries`) preventing negative stock, supporting batch/expiry tracking, inter-warehouse transfers, and stock adjustment approvals.
  - Reorder Point calculation ($\text{ROP} = (\text{Avg Daily Usage} \times \text{Lead Time}) + \text{Safety Stock}$) and 30-day demand forecasting comparing 7-day Simple Moving Average vs Holt Linear Exponential Smoothing with backtested MAE and MAPE metrics.
- **Module D — Supplier Intelligence**:
  - Supplier onboarding with GSTIN, PAN, payment terms, lead time, and multi-metric reliability scoring (On-Time Delivery %, Price Stability, Quality Acceptance %, Quotation Responsiveness).
  - Automated supplier risk explanations and quotation comparison matrix.
- **Module E — Procurement Management**:
  - End-to-end procurement lifecycle: Purchase Requests (PR) -> Multi-level Approval Workflows -> Request for Quotations (RFQ) -> Supplier Quotation Matrix -> Purchase Orders (PO) -> Goods Received Notes (GRN) with automatic stock-in and supplier reliability updates -> 3-Way Invoice Match.
- **Module F — Financial Intelligence**:
  - Accounts Payable and Accounts Receivable tracking with aging buckets, partial/full payment recording, expense categorisation, P&L summary, and 30-day cash-flow projection.
- **Module G — AI Business Intelligence & Signature Action Engine**:
  - **Signature 10-Scenario Business Intelligence & Action Engine** evaluating live operational, procurement, supplier, inventory, and financial risks, complete with the end-to-end **Product A (Industrial Bearing SKF-6205)** stockout prediction and one-click human-approved Draft PO + Approval Task execution.
  - Permission-aware RAG Business Assistant searching across verified document chunks and live operational tables with source citations.
- **Module H — Workflow Automation & Task Management**:
  - Event-driven automation rule engine (`LOW_STOCK_DETECTED`, `INVOICE_UPLOADED`, `PO_APPROVAL_PENDING`, `SUPPLIER_DELIVERY_LATE`, `PAYMENT_OVERDUE`) and full operational task board.
- **Frontend Enterprise SaaS Interface**:
  - 37 routes (7 public marketing/auth pages + 30 authenticated application modules) built with React 18, TypeScript, Tailwind CSS, TanStack Query, Recharts, and Lucide icons, supporting dark/light themes, global search, and role switcher.
- **DevOps & Quality Assurance**:
  - Docker & Docker Compose stack (`postgres`, `redis`, `backend`, `worker`, `frontend`), Alembic migrations, Pytest backend integration suite, Vitest frontend test suite, and GitHub Actions CI/CD workflow.

