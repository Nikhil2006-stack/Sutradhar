# Sutradhar — AI, Machine Learning & Decision Engine Design

## 1. Architectural Philosophy
Sutradhar treats AI not as an unconstrained chatbot, but as a **transparent, auditable Decision Intelligence Layer** built on top of deterministic business mathematics and verified operational records.

### Core Guardrails
1. **No Unverified Writes**: Extracted invoice/PO data remains in `EXTRACTED` state until a user with `documents:verify` or `finance:write` permission reviews and confirms it via `/api/v1/documents/{id}/verify`.
2. **No Autonomous Financial/Inventory Mutations**: Every recommendation in `ai_recommendations` requires explicit human approval (`/api/v1/ai/recommendations/{id}/approve`) before creating a Purchase Request, Purchase Order draft, or Task.
3. **No Arbitrary LLM-Generated SQL**: Natural-language business queries use intent classification mapped to parameterized, tenant-scoped, permission-checked SQLAlchemy queries combined with tenant-scoped RAG vector/semantic retrieval.

---

## 2. Module Breakdown

### 2.1 Document Intelligence Pipeline (`app/ai/document_intelligence.py`)
1. **Ingestion & Validation**: Validates file extension/MIME type (`.pdf`, `.png`, `.jpg`, `.jpeg`, `.txt`), enforces size limits (max 15 MB), and computes SHA-256 hash (`file_hash_sha256`) to detect exact duplicate uploads within the organisation.
2. **Text Extraction & OCR**:
   - Uses **PyMuPDF (`fitz`)** for native digital PDF text and layout extraction.
   - Falls back to **Tesseract OCR (`pytesseract` + `Pillow`)** for scanned PDFs and receipt images when digital text density is low.
3. **Document Classification**: Classifies documents into `INVOICE`, `PURCHASE_ORDER`, `QUOTATION`, `RECEIPT`, or `CONTRACT` using keyword/structural scoring + optional LLM classification.
4. **Structured Field Extraction**:
   - Extracts `invoice_number`, `invoice_date`, `due_date`, `supplier_name`, `supplier_gstin` (validated against Indian GSTIN regex `\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}`), `po_reference`, line items (`description`, `quantity`, `unit_price`, `tax_rate`, `line_total`), `subtotal`, `tax_amount`, and `total_amount`.
   - Performs mathematical cross-checks (`subtotal + tax_amount == total_amount`) and semantic duplicate checks (same supplier + same invoice number or same amount + date).
   - Matches against existing Purchase Orders (`purchase_orders`) to detect price or quantity discrepancies (3-way match check).

### 2.2 Business Document RAG & Decision Assistant (`app/ai/rag_assistant.py`)
1. **Chunking & Embeddings**:
   - Splits verified documents and operational records into overlapping 400-token chunks.
   - Generates embeddings via configured provider (`OpenAI` / `Gemini` embeddings or deterministic local TF-IDF / hashing vectorizer of dimension 384 stored in `document_chunks`).
2. **Tenant & Permission-Filtered Retrieval**:
   - Every retrieval query filters by `organization_id == current_org.id` and checks user role permissions (e.g., hiding financial payroll/expense specifics if user lacks `finance:read`).
3. **Hybrid Operational + Document QA**:
   - Classifies user intent across:
     - *Supplier & Quotation Queries* ("What was the last price quoted by Supplier A?", "Which supplier has the highest delivery delays?")
     - *Invoice & Payment Queries* ("Find invoices due this month", "Summarise our outstanding payments")
     - *Procurement & Inventory Queries* ("Which purchase orders are pending receipt?", "Which products are at risk of stockout?")
     - *Document Semantic Search* (Retrieving exact clauses, terms, and line items from uploaded PDFs)
   - Returns structured answers with **explicit citations** (Document ID, PO Number, Invoice Number, Supplier Code) and confidence score.

### 2.3 Inventory Demand Forecasting (`app/ai/forecasting.py`)
1. **Baseline Formula**:
   $$\text{Reorder Point (ROP)} = (\text{Average Daily Demand} \times \text{Lead Time in Days}) + \text{Safety Stock}$$
   $$\text{Safety Stock} = Z \times \sigma_d \times \sqrt{\text{Lead Time in Days}}$$
2. **Advanced Forecasting Comparison**:
   - Computes historical daily/weekly demand series from `stock_movements` (`OUT` movements).
   - Compares **Simple Moving Average (Baseline)** against **Exponential Smoothing / Linear Trend Regression (Scikit-learn)** using Mean Absolute Error (MAE) and Mean Absolute Percentage Error (MAPE) on rolling holdout windows.
   - Predicts 14-day and 30-day demand, expected stockout date, and suggested economic reorder quantity.

### 2.4 Supplier Risk & Reliability Engine (`app/ai/supplier_risk.py`)
Calculates a transparent `0–100` Reliability Score from actual operational records:
$$\text{Reliability Score} = 0.35(\text{On-Time Rate}) + 0.25(100 - \text{Delay Penalty}) + 0.20(100 - \text{Defect Penalty}) + 0.20(100 - \text{Price Volatility Penalty})$$
- **LOW RISK**: Score $\ge 80$
- **MEDIUM RISK**: $60 \le \text{Score} < 80$
- **HIGH RISK**: Score $< 60$

### 2.5 Signature Feature: 10-Scenario Action Engine (`app/ai/action_engine.py`)
Continuously evaluates the organisation's live data to generate explainable recommendations across all 10 scenarios:
1. **Imminent Stockout Before Supplier Lead Time** (e.g., 12 units left, 10/day demand, 8-day lead time).
2. **Overdue Supplier Deliveries** (PO past expected delivery date).
3. **Unusually Expensive Quotations** (Quote unit price significantly above historical/catalog cost).
4. **Possible Duplicate Invoices** (Matching invoice number or matching supplier + total amount).
5. **Invoice & Purchase Order Mismatches** (Invoice billed qty or price exceeds PO terms).
6. **Suppliers with Deteriorating Performance** (Reliability score drop / high delay & defect rates).
7. **Upcoming Payment Obligations** (Payables due within 7 days or overdue).
8. **Dead-Stock / Low-Demand Products** (High inventory value with zero/minimal outbound movement in 60+ days).
9. **Unusual Inventory Adjustments** (Large negative stock adjustments requiring audit review).
10. **Potential Cash-Flow Pressure** (30-day payables + expenses exceeding receivables + liquid buffer).

