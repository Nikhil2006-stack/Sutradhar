import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  GitBranch,
  Play,
  Plus,
  Search,
  Shield,
  Upload,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { apiClient } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { formatINR, formatIndianDate } from '../types';
import {
  Badge,
  EmptyState,
  Modal,
  PageHeader,
  SkeletonBlock,
  statusBadgeVariant,
} from '../components/ui/Common';

// =============================================================================
// AI DOCUMENT CENTRE & INVOICE VERIFICATION
// =============================================================================

export const DocumentCentrePage: React.FC = () => {
  const { notify, hasPermission } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/documents', {
        params: search ? { search } : {},
      });
      setDocs(res.data.items || []);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('doc_type', 'INVOICE');
      const res = await apiClient.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      notify(
        res.data.is_duplicate ? 'Duplicate Document Detected' : 'OCR & Extraction Complete',
        `Extracted ${res.data.extraction?.invoice_number} (Confidence ${res.data.extraction?.confidence_score}%)`,
        res.data.is_duplicate ? 'warning' : 'success'
      );
      load();
    } catch (err: any) {
      notify('Upload Failed', err.response?.data?.detail || 'Invalid document file', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSampleInvoiceUpload = async () => {
    setUploading(true);
    try {
      const sampleText = [
        'TAX INVOICE',
        'Supplier: Shree Ganesh Steels & Alloys Pvt. Ltd.',
        'GSTIN: 27AABCS1429B1Z1',
        `Invoice No: INV-GS-${Math.floor(1000 + Math.random() * 8999)}`,
        'PO Number: PO-202611-501',
        'Subtotal: INR 122,500.00',
        'Total GST: INR 22,050.00',
        'Grand Total: INR 144,550.00',
      ].join('\n');
      const blob = new Blob([sampleText], { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', blob, 'Sample_Supplier_Tax_Invoice.txt');
      formData.append('doc_type', 'INVOICE');
      const res = await apiClient.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      notify(
        'Sample Invoice Extracted',
        `Extracted ${res.data.extraction?.invoice_number} (${formatINR(res.data.extraction?.total_amount)}) — ready for Human Verification!`,
        'success'
      );
      load();
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Document Intelligence Centre"
        subtitle="Upload PDF invoices, scanned receipts, purchase orders, and contracts for OCR extraction, SHA-256 duplicate detection, and RAG indexing."
        actions={
          hasPermission('documents:write') && (
            <>
              <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                <Upload className="h-4 w-4" />
                <span>{uploading ? 'Processing OCR...' : 'Upload PDF / Image'}</span>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={handleSampleInvoiceUpload}
                disabled={uploading}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold"
              >
                + Test Instant Sample Invoice OCR
              </button>
            </>
          )
        }
      />

      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search across uploaded filenames, extracted text, GSTIN, or invoice numbers..."
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-xs"
          />
        </div>
        <Link to="/app/invoice-verification" className="text-xs font-semibold text-blue-600 hover:underline">
          Open Human Verification Workbench →
        </Link>
      </div>

      {loading ? (
        <SkeletonBlock rows={4} />
      ) : (
        <div className="space-y-3">
          {docs.map((d) => {
            const ext = d.extraction;
            return (
              <div
                key={d.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="font-bold text-slate-900 dark:text-white">{d.original_filename}</span>
                    <Badge variant={statusBadgeVariant(d.status)}>{d.status}</Badge>
                    <Badge variant="default">{d.doc_type}</Badge>
                    {d.is_duplicate && <Badge variant="danger">SHA-256 DUPLICATE</Badge>}
                  </div>
                  {ext && (
                    <p className="text-slate-600 dark:text-slate-300">
                      Supplier: <strong>{ext.supplier_name}</strong> (GSTIN: {ext.supplier_gstin}) •
                      Ref: <strong className="font-mono">{ext.invoice_number}</strong> •
                      PO Ref: <strong className="font-mono">{ext.po_reference || 'Unlinked'}</strong> •
                      Confidence: <strong>{ext.confidence_score}%</strong>
                    </p>
                  )}
                  {ext?.validation_warnings?.length > 0 && (
                    <p className="text-amber-600 font-medium">
                      ⚠ {ext.validation_warnings.join(' | ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {ext && (
                    <div className="text-right">
                      <span className="text-sm font-bold block">{formatINR(ext.total_amount)}</span>
                      <span className="text-[10px] text-slate-400">
                        {ext.is_verified ? 'Human Verified ✓' : 'Awaiting Verification'}
                      </span>
                    </div>
                  )}
                  <Link
                    to="/app/invoice-verification"
                    className="rounded-lg bg-slate-900 dark:bg-blue-600 px-3 py-1.5 font-semibold text-white"
                  >
                    Verify Fields
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const InvoiceVerificationPage: React.FC = () => {
  const { notify, hasPermission } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [gstin, setGstin] = useState('');
  const [poRef, setPoRef] = useState('');
  const [subtotal, setSubtotal] = useState('0');
  const [taxAmount, setTaxAmount] = useState('0');
  const [totalAmount, setTotalAmount] = useState('0');

  const selectDocForEdit = (doc: any) => {
    setSelectedDoc(doc);
    const ext = doc?.extraction || {};
    setInvoiceNo(ext.invoice_number || '');
    setSupplierName(ext.supplier_name || '');
    setGstin(ext.supplier_gstin || '');
    setPoRef(ext.po_reference || '');
    setSubtotal(String(ext.subtotal || 0));
    setTaxAmount(String(ext.tax_amount || 0));
    setTotalAmount(String(ext.total_amount || 0));
  };

  const load = useCallback(async () => {
    const res = await apiClient.get('/documents');
    const items = res.data.items || [];
    setDocs(items);
    if (items.length > 0 && !selectedDoc) {
      selectDocForEdit(items[0]);
    }
  }, [selectedDoc]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConfirmVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) return;
    try {
      const res = await apiClient.post(`/documents/${selectedDoc.id}/verify`, {
        invoice_number: invoiceNo,
        supplier_name: supplierName,
        supplier_gstin: gstin,
        po_reference: poRef || null,
        subtotal: Number(subtotal),
        tax_amount: Number(taxAmount),
        total_amount: Number(totalAmount),
        create_payable_invoice: true,
      });
      notify(
        'Extraction Human-Verified & Posted',
        `3-Way PO Match Status: ${res.data.match_status} — ${res.data.match_notes}`,
        'success'
      );
      load();
    } catch (err: any) {
      notify('Verification Error', err.response?.data?.detail || 'Failed to verify', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Human-in-the-Loop Invoice Extraction & 3-Way Match Workbench"
        subtitle="Safety Rule: AI-extracted document fields are never posted to Accounts Payable without human verification and correction."
        badge="3-Way PO Matching"
      />

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-xl border bg-white dark:bg-slate-900 p-4 space-y-2.5 text-xs">
          <h3 className="font-bold text-sm">Uploaded Documents Queue</h3>
          {docs.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => selectDocForEdit(d)}
              className={`w-full text-left rounded-lg border p-3 transition ${
                selectedDoc?.id === d.id
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold truncate">{d.original_filename}</span>
                <Badge variant={statusBadgeVariant(d.status)}>{d.status}</Badge>
              </div>
              <p className="text-slate-500 mt-1">
                {d.extraction?.invoice_number} • {formatINR(d.extraction?.total_amount)}
              </p>
            </button>
          ))}
        </div>

        <div className="lg:col-span-7 rounded-xl border bg-white dark:bg-slate-900 p-6">
          {selectedDoc ? (
            <form onSubmit={handleConfirmVerification} className="space-y-4 text-xs">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-sm font-bold">Verify Extracted Fields: {selectedDoc.original_filename}</h3>
                  <p className="text-slate-400">OCR Confidence: {selectedDoc.extraction?.confidence_score}%</p>
                </div>
                <Badge variant={selectedDoc.extraction?.is_verified ? 'success' : 'warning'}>
                  {selectedDoc.extraction?.is_verified ? 'Verified' : 'Pending Human Sign-Off'}
                </Badge>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Invoice Number *</label>
                  <input required value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className="w-full rounded-lg border px-3 py-2 font-mono bg-transparent" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Purchase Order Reference (for 3-Way Match)</label>
                  <input value={poRef} onChange={(e) => setPoRef(e.target.value)} placeholder="PO-202611-501" className="w-full rounded-lg border px-3 py-2 font-mono bg-transparent" />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Supplier Name *</label>
                  <input required value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Supplier GSTIN *</label>
                  <input required value={gstin} onChange={(e) => setGstin(e.target.value)} className="w-full rounded-lg border px-3 py-2 font-mono bg-transparent" />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Taxable Subtotal (₹)</label>
                  <input type="number" step="0.01" required value={subtotal} onChange={(e) => setSubtotal(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">GST Tax Amount (₹)</label>
                  <input type="number" step="0.01" required value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Grand Total (₹)</label>
                  <input type="number" step="0.01" required value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className="w-full rounded-lg border px-3 py-2 font-bold bg-transparent" />
                </div>
              </div>

              {hasPermission('documents:verify') && (
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 font-bold text-white hover:bg-emerald-700"
                >
                  <FileCheck2 className="h-4 w-4" /> Confirm Human Verification & Post to Accounts Payable
                </button>
              )}
            </form>
          ) : (
            <EmptyState title="Select a document to verify" description="Upload a PDF or image in the Document Centre." />
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// FINANCE: ACCOUNTS PAYABLE, ACCOUNTS RECEIVABLE & CASHFLOW/P&L
// =============================================================================

export const AccountsPayablePage: React.FC = () => {
  const { notify, hasPermission } = useAuth();
  const [data, setData] = useState<any>(null);
  const [payModalInvoice, setPayModalInvoice] = useState<any>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('NEFT');

  const load = useCallback(async () => {
    const res = await apiClient.get('/finance/payables');
    setData(res.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalInvoice) return;
    try {
      await apiClient.post(`/invoices/${payModalInvoice.id}/payments`, {
        amount: Number(payAmount),
        payment_method: payMethod,
      });
      notify('Payment Recorded', `Settled ${formatINR(Number(payAmount))} via ${payMethod}.`, 'success');
      setPayModalInvoice(null);
      load();
    } catch (err: any) {
      notify('Error', err.response?.data?.detail || 'Payment failed', 'error');
    }
  };

  if (!data) return <SkeletonBlock rows={4} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts Payable & 3-Way PO Matching"
        subtitle="Track supplier invoices, MSME Section 43B(h) due dates, PO discrepancy alerts, and NEFT/RTGS settlements."
      />

      <div className="grid sm:grid-cols-3 gap-4 text-xs">
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-4">
          <span className="text-slate-400">Total Outstanding Payables</span>
          <p className="text-2xl font-bold mt-1">{formatINR(data.total_outstanding_inr)}</p>
        </div>
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-4">
          <span className="text-slate-400">Overdue Obligations</span>
          <p className="text-2xl font-bold text-red-600 mt-1">{formatINR(data.overdue_inr)}</p>
        </div>
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-4">
          <span className="text-slate-400">Due Within 7 Days</span>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatINR(data.due_within_7_days_inr)}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-white dark:bg-slate-900 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase border-b">
            <tr>
              <th className="px-4 py-3">Invoice No</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Balance Due</th>
              <th className="px-4 py-3">3-Way PO Match</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Settlement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {(data.items || []).map((inv: any) => (
              <tr key={inv.id}>
                <td className="px-4 py-3 font-mono font-bold text-blue-600">{inv.invoice_number}</td>
                <td className="px-4 py-3 font-semibold">{inv.supplier_name}</td>
                <td className="px-4 py-3">{formatIndianDate(inv.due_date)}</td>
                <td className="px-4 py-3 text-right">{formatINR(inv.total_amount)}</td>
                <td className="px-4 py-3 text-right font-bold">{formatINR(inv.balance_due)}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusBadgeVariant(inv.match_status)}>{inv.match_status}</Badge>
                  {inv.match_notes && <span className="block text-[10px] text-slate-400 max-w-xs">{inv.match_notes}</span>}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusBadgeVariant(inv.status)}>{inv.status}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  {inv.balance_due > 0 && hasPermission('finance:write') && (
                    <button
                      type="button"
                      onClick={() => {
                        setPayModalInvoice(inv);
                        setPayAmount(String(inv.balance_due));
                      }}
                      className="rounded bg-blue-600 px-3 py-1 font-semibold text-white"
                    >
                      Record Payment
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={Boolean(payModalInvoice)}
        onClose={() => setPayModalInvoice(null)}
        title={`Record Payment for ${payModalInvoice?.invoice_number}`}
      >
        <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Settlement Amount (₹) *</label>
            <input type="number" step="0.01" required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Payment Mode *</label>
            <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-slate-800">
              {['NEFT', 'RTGS', 'UPI', 'CHEQUE', 'IMPS'].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={() => setPayModalInvoice(null)} className="rounded-lg border px-4 py-2 font-semibold">Cancel</button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white">Post Settlement</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const AccountsReceivablePage: React.FC = () => {
  const { notify, hasPermission } = useAuth();
  const [data, setData] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [invNo, setInvNo] = useState('SI-BPE-2026-305');
  const [customer, setCustomer] = useState('Mahindra & Mahindra Auto Division');
  const [subtotal, setSubtotal] = useState('150000');

  const load = useCallback(async () => {
    const res = await apiClient.get('/finance/receivables');
    setData(res.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreateReceivable = async (e: React.FormEvent) => {
    e.preventDefault();
    const sub = Number(subtotal);
    const tax = Math.round(sub * 0.18 * 100) / 100;
    await apiClient.post('/invoices', {
      invoice_number: invNo,
      invoice_type: 'RECEIVABLE',
      customer_name: customer,
      subtotal: sub,
      tax_amount: tax,
      total_amount: sub + tax,
    });
    notify('Sales Invoice Recorded', `Added receivable ${invNo} for ${customer}`, 'success');
    setModalOpen(false);
    load();
  };

  if (!data) return <SkeletonBlock rows={4} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts Receivable & Customer Collections"
        subtitle="Track customer tax invoices, collection milestones, and outstanding receivables."
        actions={
          hasPermission('finance:write') && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Issue Sales Invoice
            </button>
          )
        }
      />

      <div className="grid sm:grid-cols-2 gap-4 text-xs">
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-4">
          <span className="text-slate-400">Pending Customer Receivables</span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatINR(data.total_receivable_inr)}</p>
        </div>
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-4">
          <span className="text-slate-400">Total Realised Collections</span>
          <p className="text-2xl font-bold text-blue-600 mt-1">{formatINR(data.total_collected_inr)}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-white dark:bg-slate-900 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase border-b">
            <tr>
              <th className="px-4 py-3">Invoice No</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3 text-right">Total Billed</th>
              <th className="px-4 py-3 text-right">Collected</th>
              <th className="px-4 py-3 text-right">Balance Due</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {(data.items || []).map((i: any) => (
              <tr key={i.id}>
                <td className="px-4 py-3 font-mono font-bold text-blue-600">{i.invoice_number}</td>
                <td className="px-4 py-3 font-semibold">{i.customer_name}</td>
                <td className="px-4 py-3">{formatIndianDate(i.due_date)}</td>
                <td className="px-4 py-3 text-right">{formatINR(i.total_amount)}</td>
                <td className="px-4 py-3 text-right text-emerald-600">{formatINR(i.paid_amount)}</td>
                <td className="px-4 py-3 text-right font-bold">{formatINR(i.balance_due)}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusBadgeVariant(i.status)}>{i.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Customer Receivable Invoice">
        <form onSubmit={handleCreateReceivable} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Invoice Number *</label>
            <input required value={invNo} onChange={(e) => setInvNo(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Customer Legal Name *</label>
            <input required value={customer} onChange={(e) => setCustomer(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Taxable Subtotal (₹) (18% GST auto-applied) *</label>
            <input type="number" required value={subtotal} onChange={(e) => setSubtotal(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border px-4 py-2 font-semibold">Cancel</button>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Save Receivable</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const CashflowAnalyticsPage: React.FC = () => {
  const { notify, hasPermission } = useAuth();
  const [data, setData] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [vendor, setVendor] = useState('');
  const [category, setCategory] = useState('LOGISTICS');
  const [amount, setAmount] = useState('25000');

  const load = useCallback(async () => {
    const res = await apiClient.get('/finance/cashflow');
    setData(res.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiClient.post('/finance/expenses', {
      category,
      vendor_name: vendor,
      amount: Number(amount),
    });
    notify('Expense Logged', `Recorded ₹${amount} under ${category}`, 'success');
    setModalOpen(false);
    setVendor('');
    load();
  };

  if (!data) return <SkeletonBlock rows={4} />;

  const pnl = data.pnl_summary || {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash-Flow Forecasting, Expense Categorisation & P&L Summary"
        subtitle="Operational Profit & Loss summary and 30-day cash-flow projections based on recorded invoices and expenses."
        actions={
          hasPermission('finance:write') && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Record Operating Expense
            </button>
          )
        }
      />

      <div className="grid sm:grid-cols-4 gap-4 text-xs">
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-4">
          <span className="text-slate-400">Recorded Revenue (AR)</span>
          <p className="text-xl font-bold text-emerald-600 mt-1">{formatINR(pnl.recorded_revenue_inr)}</p>
        </div>
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-4">
          <span className="text-slate-400">Recorded Purchases (AP)</span>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{formatINR(pnl.recorded_procurement_cogs_inr)}</p>
        </div>
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-4">
          <span className="text-slate-400">Operating Expenses</span>
          <p className="text-xl font-bold text-amber-600 mt-1">{formatINR(pnl.recorded_operating_expenses_inr)}</p>
        </div>
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-4">
          <span className="text-slate-400">Net Operating Surplus</span>
          <p className="text-xl font-bold text-blue-600 mt-1">{formatINR(pnl.net_operating_surplus_inr)}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-white dark:bg-slate-900 p-5 space-y-3">
        <h3 className="text-sm font-bold">30-Day Cash Inflow vs Outflow Projection (INR)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.projection_series || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
              <XAxis dataKey="horizon" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="expected_inflow" name="Expected AR Inflow" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expected_outflow" name="Scheduled AP Outflow" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Categorised Operating Expense">
        <form onSubmit={handleAddExpense} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Category *</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-slate-800">
              {['LOGISTICS', 'UTILITIES', 'PACKAGING', 'MAINTENANCE', 'RENT', 'OTHER'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">Vendor / Payee *</label>
            <input required value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Blue Dart Freight Services" className="w-full rounded-lg border px-3 py-2 bg-transparent" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Amount (₹) *</label>
            <input type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border px-4 py-2 font-semibold">Cancel</button>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Save Expense</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// =============================================================================
// WORKFLOW AUTOMATION, TASKS, NOTIFICATIONS, AUDIT, REPORTS, TEAM & SETTINGS
// =============================================================================

export const WorkflowAutomationPage: React.FC = () => {
  const { notify } = useAuth();
  const [rules, setRules] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('LOW_STOCK');
  const [action, setAction] = useState('CREATE_TASK');

  const load = useCallback(async () => {
    const [rRes, runRes] = await Promise.all([
      apiClient.get('/workflow-rules'),
      apiClient.get('/workflow-runs'),
    ]);
    setRules(rRes.data.items || []);
    setRuns(runRes.data.items || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiClient.post('/workflow-rules', {
      name,
      description: `Automated rule: When ${trigger} occurs, execute ${action}.`,
      trigger_event: trigger,
      action_type: action,
    });
    notify('Automation Rule Created', `Activated '${name}'`, 'success');
    setModalOpen(false);
    setName('');
    load();
  };

  const handleEvaluateNow = async () => {
    const res = await apiClient.post('/workflow-rules/evaluate');
    notify('Workflows Evaluated', `Executed ${res.data.evaluated_rules} active automation rules.`, 'success');
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflow Automation Builder & Escalation Engine"
        subtitle="Configure event-driven operational rules for low-stock replenishment, overdue invoice reminders, and PO approval escalations."
        actions={
          <>
            <button
              type="button"
              onClick={handleEvaluateNow}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold"
            >
              <Play className="h-3.5 w-3.5 text-emerald-600" /> Evaluate Rules Now
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Create Automation Rule
            </button>
          </>
        }
      />

      <div className="grid md:grid-cols-3 gap-4">
        {rules.map((r) => (
          <div key={r.id} className="rounded-xl border bg-white dark:bg-slate-900 p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <Badge variant="info">{r.trigger_event}</Badge>
              <Badge variant="success">ACTIVE ({r.trigger_count} runs)</Badge>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{r.name}</h3>
            <p className="text-slate-500">{r.description}</p>
            <p className="font-mono text-[11px] text-blue-600">Action → {r.action_type}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-white dark:bg-slate-900 p-5 space-y-3 text-xs">
        <h3 className="text-sm font-bold">Recent Workflow Execution Runs</h3>
        <div className="space-y-2">
          {runs.map((run) => (
            <div key={run.id} className="flex items-center justify-between border-b pb-2">
              <div>
                <span className="font-bold">{run.rule_name}</span> — <span className="text-slate-500">{run.summary}</span>
              </div>
              <Badge variant="success">{run.status}</Badge>
            </div>
          ))}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Workflow Automation Rule">
        <form onSubmit={handleCreateRule} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Rule Name *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Escalate High-Risk Supplier Delays" className="w-full rounded-lg border px-3 py-2 bg-transparent" />
          </div>
          <div>
            <label className="block font-semibold mb-1">When Trigger Event Occurs *</label>
            <select value={trigger} onChange={(e) => setTrigger(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-slate-800">
              <option value="LOW_STOCK">LOW_STOCK (SKU falls below Reorder Point)</option>
              <option value="INVOICE_OVERDUE">INVOICE_OVERDUE (Payable approaching due date)</option>
              <option value="PO_APPROVAL_PENDING">PO_APPROVAL_PENDING (Approval delayed &gt;24h)</option>
              <option value="SUPPLIER_HIGH_RISK">SUPPLIER_HIGH_RISK (Reliability score drops &lt;65)</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">Execute Automated Action *</label>
            <select value={action} onChange={(e) => setAction(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-slate-800">
              <option value="CREATE_TASK">CREATE_TASK (Assign operational task)</option>
              <option value="SEND_NOTIFICATION">SEND_NOTIFICATION (Dispatch alert)</option>
              <option value="ESCALATE_APPROVAL">ESCALATE_APPROVAL (Escalate to Owner)</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border px-4 py-2 font-semibold">Cancel</button>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Activate Rule</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const TaskManagementPage: React.FC = () => {
  const { notify } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [title, setTitle] = useState('');

  const load = useCallback(async () => {
    const res = await apiClient.get('/tasks');
    setTasks(res.data.items || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await apiClient.post('/tasks', { title, priority: 'HIGH', category: 'OPERATIONS' });
    setTitle('');
    notify('Task Created', 'Added to operational task queue.', 'success');
    load();
  };

  const toggleStatus = async (t: any) => {
    const next = t.status === 'COMPLETED' ? 'TODO' : 'COMPLETED';
    await apiClient.patch(`/tasks/${t.id}`, { status: next });
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Task Management"
        subtitle="Track manual tasks and automated tasks generated by the AI Action Engine and Workflow Rules."
      />

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add new operational task (e.g. Follow up with Shree Ganesh Steels on dispatch challan)..."
          className="flex-1 rounded-lg border px-3.5 py-2 text-xs bg-white dark:bg-slate-900"
        />
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white">
          + Add Task
        </button>
      </form>

      <div className="space-y-2.5">
        {tasks.map((t) => (
          <div
            key={t.id}
            className="rounded-xl border bg-white dark:bg-slate-900 p-4 flex items-center justify-between gap-4 text-xs"
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={t.status === 'COMPLETED'}
                onChange={() => toggleStatus(t)}
                className="mt-1 rounded"
              />
              <div>
                <p className={`font-bold ${t.status === 'COMPLETED' ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                  {t.title}
                </p>
                <p className="text-slate-500 mt-0.5">{t.description}</p>
                <span className="text-[10px] text-slate-400">
                  Source: {t.source_type} • Due: {formatIndianDate(t.due_date)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={statusBadgeVariant(t.priority)}>{t.priority}</Badge>
              <Badge variant={statusBadgeVariant(t.status)}>{t.status}</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const NotificationsPage: React.FC = () => {
  const { notify } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  const load = useCallback(async () => {
    const res = await apiClient.get('/notifications');
    setItems(res.data.items || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markAllRead = async () => {
    await apiClient.post('/notifications/read-all');
    notify('Notifications Cleared', 'All alerts marked as read.', 'info');
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global Notifications & Risk Alerts"
        subtitle="Real-time alerts across inventory thresholds, approval escalations, and AI extractions."
        actions={
          <button
            type="button"
            onClick={markAllRead}
            className="rounded-lg border px-3.5 py-2 text-xs font-semibold bg-white dark:bg-slate-900"
          >
            Mark All as Read
          </button>
        }
      />

      <div className="space-y-2.5">
        {items.map((n) => (
          <div
            key={n.id}
            className={`rounded-xl border p-4 flex items-center justify-between gap-4 text-xs ${
              n.is_read ? 'bg-white/60 dark:bg-slate-900/40 opacity-75' : 'bg-white dark:bg-slate-900 border-blue-300 dark:border-blue-800'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant={statusBadgeVariant(n.severity)}>{n.severity}</Badge>
                <span className="font-bold text-slate-900 dark:text-white">{n.title}</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300">{n.message}</p>
            </div>
            {n.link_url && (
              <Link to={n.link_url} className="font-semibold text-blue-600 hover:underline shrink-0">
                Open →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get('/audit-logs')
      .then((res) => setLogs(res.data.items || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonBlock rows={5} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Immutable Security & Operational Audit Trail"
        subtitle="Every authentication event, stock ledger mutation, approval, and human-authorized AI action is logged."
        badge="Tamper-Evident"
      />

      <div className="rounded-xl border bg-white dark:bg-slate-900 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase border-b">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Audit Summary</th>
              <th className="px-4 py-3">IP Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3 text-slate-500">{formatIndianDate(l.created_at)}</td>
                <td className="px-4 py-3 font-medium">{l.actor_email}</td>
                <td className="px-4 py-3">
                  <Badge variant="info">{l.action}</Badge>
                </td>
                <td className="px-4 py-3 font-mono">{l.entity_type}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{l.summary}</td>
                <td className="px-4 py-3 font-mono text-slate-400">{l.ip_address}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const ReportsAndExportsPage: React.FC = () => {
  const { notify } = useAuth();

  const downloadCsv = async (type: string) => {
    try {
      const res = await apiClient.get('/reports/export-csv', {
        params: { report_type: type },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sutradhar_${type}_report.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      notify('Export Downloaded', `Generated ${type.toUpperCase()} CSV report.`, 'success');
    } catch {
      notify('Export Error', 'Failed to generate CSV report', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Reports, CSV Exports & Statutory Summaries"
        subtitle="Download clean CSV data exports and printable operational summaries for auditors and management."
      />

      <div className="grid md:grid-cols-3 gap-5 text-xs">
        {[
          {
            type: 'inventory',
            title: 'SKU Catalogue & Reorder Valuation Report',
            desc: 'All active SKUs, HSN codes, unit costs, reorder points, daily demand, and supplier lead times.',
          },
          {
            type: 'suppliers',
            title: 'Supplier Reliability & SLA Compliance Report',
            desc: 'Complete vendor directory with GSTINs, on-time delivery %, defect rates, and risk categories.',
          },
          {
            type: 'invoices',
            title: 'Accounts Payable & Receivable GST Register',
            desc: 'All payable and receivable invoices, GST tax breakdowns, balances due, and 3-way PO match statuses.',
          },
        ].map((rep) => (
          <div key={rep.type} className="rounded-xl border bg-white dark:bg-slate-900 p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{rep.title}</h3>
              <p className="text-slate-500 leading-relaxed">{rep.desc}</p>
            </div>
            <button
              type="button"
              onClick={() => downloadCsv(rep.type)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 font-semibold text-white hover:bg-blue-700"
            >
              <Download className="h-4 w-4" /> Download CSV Report
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export const TeamManagementPage: React.FC = () => {
  const { notify, hasPermission } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [roleCode, setRoleCode] = useState('PROCUREMENT_OFFICER');
  const [department, setDepartment] = useState('Procurement');

  const load = useCallback(async () => {
    const res = await apiClient.get('/members');
    setMembers(res.data.items || []);
    setRoles(res.data.available_roles || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/members/invite', {
        full_name: fullName,
        email,
        role_code: roleCode,
        department,
      });
      notify('Team Member Invited', `Provisioned ${fullName} as ${roleCode}`, 'success');
      setModalOpen(false);
      setFullName('');
      setEmail('');
      load();
    } catch (err: any) {
      notify('Error', err.response?.data?.detail || 'Failed to invite member', 'error');
    }
  };

  const handleChangeRole = async (membershipId: string, newRoleCode: string) => {
    try {
      await apiClient.patch(`/members/${membershipId}/role`, { role_code: newRoleCode });
      notify('Role Updated', `Assigned role ${newRoleCode}`, 'success');
      load();
    } catch (err: any) {
      notify('Permission Denied', err.response?.data?.detail || 'Cannot update role', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Members & Role-Based Access Control (RBAC)"
        subtitle="Manage employee access across the 6 Indian MSME operational roles with backend-enforced permissions."
        actions={
          hasPermission('org:manage') && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Invite Team Member
            </button>
          )
        }
      />

      <div className="rounded-xl border bg-white dark:bg-slate-900 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase border-b">
            <tr>
              <th className="px-4 py-3">Member Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Assigned RBAC Role</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {members.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{m.full_name}</td>
                <td className="px-4 py-3 font-mono">{m.email}</td>
                <td className="px-4 py-3">{m.department}</td>
                <td className="px-4 py-3">
                  {hasPermission('org:manage') ? (
                    <select
                      value={m.role_code}
                      onChange={(e) => handleChangeRole(m.id, e.target.value)}
                      className="rounded border px-2 py-1 bg-white dark:bg-slate-800 font-semibold"
                    >
                      {roles.map((r) => (
                        <option key={r.code} value={r.code}>{r.name}</option>
                      ))}
                    </select>
                  ) : (
                    <Badge variant="navy">{m.role_name}</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="success">{m.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Invite Employee to Organisation Workspace">
        <form onSubmit={handleInvite} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Employee Full Name *</label>
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Sneha Gokhale" className="w-full rounded-lg border px-3 py-2 bg-transparent" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Work Email *</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sneha@company.in" className="w-full rounded-lg border px-3 py-2 bg-transparent" />
          </div>
          <div>
            <label className="block font-semibold mb-1">RBAC Role *</label>
            <select value={roleCode} onChange={(e) => setRoleCode(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-slate-800">
              {roles.map((r) => (
                <option key={r.code} value={r.code}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">Department</label>
            <input value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border px-4 py-2 font-semibold">Cancel</button>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Send Invitation</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const OrganizationSettingsPage: React.FC = () => {
  const { notify, refreshProfile } = useAuth();
  const [org, setOrg] = useState<any>(null);
  const [name, setName] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [city, setCity] = useState('');
  const [taxRate, setTaxRate] = useState('18');
  const [poThreshold, setPoThreshold] = useState('50000');

  useEffect(() => {
    apiClient.get('/organizations/me').then((res) => {
      const a = res.data.active_organization;
      setOrg(a);
      setName(a.name || '');
      setGstin(a.gstin || '');
      setPan(a.pan || '');
      setCity(a.city || '');
      setTaxRate(String(a.settings?.default_tax_rate ?? 18));
      setPoThreshold(String(a.settings?.po_approval_threshold ?? 50000));
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org) return;
    try {
      await apiClient.patch(`/organizations/${org.id}`, {
        name,
        gstin,
        pan,
        city,
        default_tax_rate: Number(taxRate),
        po_approval_threshold: Number(poThreshold),
      });
      await refreshProfile();
      notify('Settings Updated', 'Organisation profile and governance thresholds saved.', 'success');
    } catch (err: any) {
      notify('Update Denied', err.response?.data?.detail || 'Requires org:manage permission', 'error');
    }
  };

  if (!org) return <SkeletonBlock rows={3} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organisation Settings & Indian Statutory Metadata"
        subtitle="Configure company legal profile, GSTIN, default GST slab, PO approval threshold, and document retention policy."
      />

      <form onSubmit={handleSave} className="max-w-2xl rounded-xl border bg-white dark:bg-slate-900 p-6 space-y-4 text-xs">
        <div>
          <label className="block font-semibold mb-1">Organisation Display Name *</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block font-semibold mb-1">GSTIN</label>
            <input value={gstin} onChange={(e) => setGstin(e.target.value)} className="w-full rounded-lg border px-3 py-2 font-mono bg-transparent" />
          </div>
          <div>
            <label className="block font-semibold mb-1">PAN</label>
            <input value={pan} onChange={(e) => setPan(e.target.value)} className="w-full rounded-lg border px-3 py-2 font-mono bg-transparent" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Headquarters City</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold mb-1">Default GST Rate (%)</label>
            <input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Mandatory PO Approval Threshold (₹)</label>
            <input type="number" value={poThreshold} onChange={(e) => setPoThreshold(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
          </div>
        </div>
        <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700">
          Save Organisation Settings
        </button>
      </form>
    </div>
  );
};

export const UserProfilePage: React.FC = () => {
  const { user, activeOrg, refreshProfile, notify } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [jobTitle, setJobTitle] = useState(user?.job_title || '');
  const [phone, setPhone] = useState(user?.phone || '');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiClient.patch('/auth/profile', {
      full_name: fullName,
      job_title: jobTitle,
      phone,
    });
    await refreshProfile();
    notify('Profile Updated', 'Your personal details and preferences have been saved.', 'success');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Profile & Notification Preferences"
        subtitle={`Signed in as ${user?.email} • Active Role: ${activeOrg?.role_name}`}
      />

      <form onSubmit={handleSave} className="max-w-xl rounded-xl border bg-white dark:bg-slate-900 p-6 space-y-4 text-xs">
        <div>
          <label className="block font-semibold mb-1">Full Name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
        </div>
        <div>
          <label className="block font-semibold mb-1">Designation / Job Title</label>
          <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
        </div>
        <div>
          <label className="block font-semibold mb-1">Mobile Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
        </div>
        <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white">
          Save Profile Preferences
        </button>
      </form>
    </div>
  );
};

