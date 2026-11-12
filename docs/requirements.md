# Sutradhar — Product & Technical Requirements Specification

## 1. Product Vision
**Sutradhar** is an AI-powered Business Operations, Intelligence, and Decision Automation SaaS platform built for Indian MSMEs, manufacturers, and wholesale distributors.

**Core Promise**: *"One intelligent workspace to manage, understand and improve your entire business operation."*

## 2. Target Operational Challenges Addressed
1. **Fragmented Data**: Replaces scattered Excel sheets, PDFs, WhatsApp messages, and disconnected tools with a single multi-tenant relational system of record.
2. **Manual Document Data Entry**: Automates invoice, receipt, purchase order, and contract extraction with OCR, field validation, duplicate detection, and mandatory human verification.
3. **Late Stockout Discovery**: Calculates reorder points, safety stock, daily consumption velocity, and expected stockout dates relative to supplier lead times.
4. **Opaque Supplier Quotations & Delays**: Tracks RFQs, multi-supplier quotation comparisons, on-time delivery percentage, average delay days, defect rates, price volatility, and explainable reliability scores.
5. **Slow Approval Bottlenecks**: Provides multi-level approval workflows with configurable rules, reminders, and escalations.
6. **Missed Financial Obligations**: Tracks Accounts Payable, Accounts Receivable, GST tax breakdowns, due-date alerts, 3-way PO-to-Invoice matching, and 30/60/90-day cash-flow projections in INR (`₹`).
7. **Unexplained Operational Risks**: Delivers the **Signature Business Intelligence & Action Engine** that links data validation, rules/analytics, ML predictions, explainable reasoning, cited evidence, and 1-click human-approved actions.

## 3. Indian Business Localization Requirements
- **Currency & Formatting**: Default INR (`₹`) with Indian numbering conventions (`₹1,25,000.00`) and `DD/MM/YYYY` date formatting.
- **Taxation & Compliance Metadata**: Support for GSTIN, PAN, HSN/SAC codes, and configurable GST slabs (`0%`, `5%`, `12%`, `18%`, `28%`). *Disclaimer: Sutradhar is an operational decision and workflow platform, not a certified statutory tax filing replacement.*
- **Units of Measurement (UoM)**: Standard Indian manufacturing & wholesale units (`PCS`, `KG`, `MTR`, `LTR`, `BOX`, `TON`, `ROLL`, `BAG`).

## 4. Multi-Tenant & Role-Based Access Requirements
| Role | Key Operational Capabilities |
|---|---|
| **Organisation Owner / Super Admin** | Full access to organisation settings, members, roles, approvals, finance, inventory, AI recommendations, and audit logs. |
| **Operations Manager** | Full management of warehouses, inventory, suppliers, procurement, approvals, analytics, and workflow rules. |
| **Finance Manager** | Full management of invoices, payables, receivables, payments, expenses, cash-flow analytics, and financial approvals. |
| **Procurement Officer** | Supplier onboarding, RFQs, quotation comparison, purchase requests, purchase orders, and document uploads. |
| **Warehouse Employee** | Product lookup, barcode scanning, stock movements (in/out), batch tracking, and Goods Receipt Notes (GRNs). |
| **Auditor / Read-Only** | Read-only inspection of all ledgers, documents, financial summaries, and immutable audit logs. |

