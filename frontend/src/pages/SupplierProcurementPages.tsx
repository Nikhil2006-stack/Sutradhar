import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  Plus,
  Scale,
  ShoppingCart,
  Star,
  Truck,
  Users,
  XCircle,
} from 'lucide-react';
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

export const SupplierDirectoryPage: React.FC = () => {
  const { notify, hasPermission } = useAuth();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [name, setName] = useState('');
  const [gstin, setGstin] = useState('27AABCS1429B1Z1');
  const [city, setCity] = useState('Pune');
  const [leadTime, setLeadTime] = useState('7');
  const [paymentTerms, setPaymentTerms] = useState('30');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('+91 98200 12345');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/suppliers');
      setSuppliers(res.data.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/suppliers', {
        name,
        gstin,
        city,
        state: 'Maharashtra',
        lead_time_days: Number(leadTime),
        payment_terms_days: Number(paymentTerms),
        contact_name: contactName || 'Commercial Manager',
        phone,
      });
      notify('Supplier Onboarded', `Added ${name} to vendor directory.`, 'success');
      setModalOpen(false);
      setName('');
      load();
    } catch (err: any) {
      notify('Error', err.response?.data?.detail || 'Failed to onboard supplier', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Directory & Vendor Master"
        subtitle="Onboard suppliers, verify GSTINs, and monitor lead times, payment terms, and reliability scores."
        actions={
          hasPermission('suppliers:write') && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Onboard New Supplier
            </button>
          )
        }
      />

      {loading ? (
        <SkeletonBlock rows={4} />
      ) : (
        <div className="grid md:grid-cols-3 gap-5">
          {suppliers.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-blue-600">{s.code}</span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{s.name}</h3>
                    <p className="text-xs text-slate-500">GSTIN: {s.gstin || 'Unregistered'} • {s.city}</p>
                  </div>
                  <Badge variant={statusBadgeVariant(s.risk_category)}>{s.risk_category} RISK</Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Reliability</span>
                    <strong className="text-slate-900 dark:text-white">{s.reliability_score}/100</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">On-Time %</span>
                    <strong className="text-emerald-600">{s.on_time_delivery_rate}%</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Lead Time</span>
                    <strong className="text-slate-900 dark:text-white">{s.lead_time_days}d</strong>
                  </div>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                  {s.explainable_factors?.map((f: string, idx: number) => (
                    <p key={idx}>• {f}</p>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Terms: Net {s.payment_terms_days}d</span>
                <Link
                  to={`/app/suppliers/${s.id}`}
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Open Vendor Profile →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Onboard New Supplier">
        <form onSubmit={handleOnboard} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Supplier Legal Name *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Kalyani Forgings & Engineering Works" className="w-full rounded-lg border px-3 py-2 bg-transparent" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">GSTIN</label>
              <input value={gstin} onChange={(e) => setGstin(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
            </div>
            <div>
              <label className="block font-semibold mb-1">City</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Typical Lead Time (Days)</label>
              <input type="number" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Payment Terms (Days)</label>
              <input type="number" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Primary Contact Person</label>
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Anil Deshmukh" className="w-full rounded-lg border px-3 py-2 bg-transparent" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border px-4 py-2 font-semibold">Cancel</button>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Onboard Supplier</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const SupplierProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiClient
      .get(`/suppliers/${id}`)
      .then((res) => setDetail(res.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <SkeletonBlock rows={4} />;
  if (!detail) return <EmptyState title="Supplier not found" description="Return to supplier directory." />;

  const perf = detail.performance || {};

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${detail.name} (${detail.code})`}
        subtitle={`GSTIN: ${detail.gstin || 'N/A'} • ${detail.address || detail.city} • Payment Terms: Net ${detail.payment_terms_days} Days`}
        badge={`Reliability: ${perf.reliability_score}/100 (${perf.risk_category} Risk)`}
      />

      <div className="grid sm:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-4 text-xs">
          <span className="text-slate-400">On-Time Delivery Rate</span>
          <p className="text-xl font-bold text-emerald-600 mt-1">{perf.on_time_delivery_rate}%</p>
        </div>
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-4 text-xs">
          <span className="text-slate-400">Average Delivery Delay</span>
          <p className="text-xl font-bold text-amber-600 mt-1">{perf.avg_delay_days} Days</p>
        </div>
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-4 text-xs">
          <span className="text-slate-400">Quality Defect Rate</span>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{perf.defect_rate}%</p>
        </div>
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-4 text-xs">
          <span className="text-slate-400">Total Historical Spend</span>
          <p className="text-xl font-bold text-blue-600 mt-1">{formatINR(perf.total_spend_inr)}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-5 space-y-3 text-xs">
          <h3 className="text-sm font-bold">Explainable Risk & Performance Factors</h3>
          <ul className="space-y-2">
            {(perf.explainable_factors || []).map((f: string, idx: number) => (
              <li key={idx} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800">{f}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-5 space-y-3 text-xs">
          <h3 className="text-sm font-bold">Recent Purchase Orders</h3>
          <div className="space-y-2">
            {(perf.recent_purchase_orders || []).map((po: any) => (
              <div key={po.id} className="flex items-center justify-between border-b pb-2">
                <div>
                  <span className="font-mono font-bold text-blue-600">{po.po_number}</span>
                  <span className="block text-slate-400">Expected: {formatIndianDate(po.expected_delivery_date)}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold block">{formatINR(po.total_amount)}</span>
                  <Badge variant={statusBadgeVariant(po.status)}>{po.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const SupplierAnalyticsPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get('/analytics/suppliers')
      .then((res) => setItems(res.data.items || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonBlock rows={4} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Reliability & Risk Scoring Engine"
        subtitle="Deterministic vendor scoring across On-Time Delivery (35%), Delay Resilience (25%), Quality Compliance (25%), and Price Stability (15%)."
      />

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase border-b">
            <tr>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3 text-right">On-Time %</th>
              <th className="px-4 py-3 text-right">Avg Delay</th>
              <th className="px-4 py-3 text-right">Defect %</th>
              <th className="px-4 py-3 text-right">Price Volatility</th>
              <th className="px-4 py-3 text-right">Reliability Score</th>
              <th className="px-4 py-3">Risk Category</th>
              <th className="px-4 py-3">Explainable Assessment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {items.map((s) => (
              <tr key={s.supplier_id}>
                <td className="px-4 py-3">
                  <Link to={`/app/suppliers/${s.supplier_id}`} className="font-bold text-blue-600 hover:underline">
                    {s.supplier_name}
                  </Link>
                  <span className="block text-[10px] text-slate-400">{s.supplier_code}</span>
                </td>
                <td className="px-4 py-3 text-right font-semibold">{s.on_time_delivery_rate}%</td>
                <td className="px-4 py-3 text-right">{s.avg_delay_days} days</td>
                <td className="px-4 py-3 text-right">{s.defect_rate}%</td>
                <td className="px-4 py-3 text-right">{s.price_volatility_score}%</td>
                <td className="px-4 py-3 text-right font-extrabold">{s.reliability_score} / 100</td>
                <td className="px-4 py-3">
                  <Badge variant={statusBadgeVariant(s.risk_category)}>{s.risk_category}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-500">{s.explainable_factors?.[0]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const PurchaseRequestsPage: React.FC = () => {
  const { notify } = useAuth();
  const [prs, setPrs] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('100');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prRes, pRes] = await Promise.all([
        apiClient.get('/purchase-requests'),
        apiClient.get('/products'),
      ]);
      setPrs(prRes.data.items || []);
      setProducts(pRes.data.items || []);
      if (pRes.data.items?.[0] && !productId) setProductId(pRes.data.items[0].id);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.post('/purchase-requests', {
        title,
        priority: 'HIGH',
        items: [{ product_id: productId, quantity: Number(qty) }],
      });
      notify('Purchase Request Created', `${res.data.pr_number} routed to Approval Centre.`, 'success');
      setModalOpen(false);
      setTitle('');
      load();
    } catch (err: any) {
      notify('Error', err.response?.data?.detail || 'Failed to create PR', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Request Requisitions"
        subtitle="Raise internal purchase requisitions and route automatically to multi-level approval workflows."
        actions={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> New Purchase Request
          </button>
        }
      />

      {loading ? (
        <SkeletonBlock rows={4} />
      ) : (
        <div className="space-y-3">
          {prs.map((pr) => (
            <div key={pr.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-blue-600">{pr.pr_number}</span>
                  <Badge variant={statusBadgeVariant(pr.status)}>{pr.status}</Badge>
                  <Badge variant="default">{pr.priority}</Badge>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{pr.title}</h3>
                <p className="text-slate-500">
                  Items: {pr.items?.map((i: any) => `${i.product_name} (${i.quantity})`).join(', ')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-slate-900 dark:text-white">
                  {formatINR(pr.total_estimated_amount)}
                </p>
                <p className="text-[11px] text-slate-400">Required by: {formatIndianDate(pr.required_by_date)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Purchase Request">
        <form onSubmit={handleCreate} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Requisition Title *</label>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Monthly Replenishment — Assembly Line Valves" className="w-full rounded-lg border px-3 py-2 bg-transparent" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Product SKU *</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-slate-800">
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.sku} — {p.name} ({formatINR(p.unit_cost)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">Requested Quantity *</label>
            <input type="number" required min="1" value={qty} onChange={(e) => setQty(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border px-4 py-2 font-semibold">Cancel</button>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Submit for Approval</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const PurchaseOrdersPage: React.FC = () => {
  const { notify } = useAuth();
  const [pos, setPos] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [supplierId, setSupplierId] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('50');
  const [unitPrice, setUnitPrice] = useState('2450');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [poRes, sRes, pRes] = await Promise.all([
        apiClient.get('/purchase-orders'),
        apiClient.get('/suppliers'),
        apiClient.get('/products'),
      ]);
      setPos(poRes.data.items || []);
      setSuppliers(sRes.data.items || []);
      setProducts(pRes.data.items || []);
      if (sRes.data.items?.[0] && !supplierId) setSupplierId(sRes.data.items[0].id);
      if (pRes.data.items?.[0] && !productId) setProductId(pRes.data.items[0].id);
    } finally {
      setLoading(false);
    }
  }, [supplierId, productId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.post('/purchase-orders', {
        supplier_id: supplierId,
        items: [{ product_id: productId, ordered_qty: Number(qty), unit_price: Number(unitPrice), tax_rate: 18 }],
      });
      notify('Purchase Order Generated', `Created ${res.data.po_number} (${formatINR(res.data.total_amount)})`, 'success');
      setModalOpen(false);
      load();
    } catch (err: any) {
      notify('Error', err.response?.data?.detail || 'Failed to generate PO', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Order Management"
        subtitle="Issue GST-compliant Purchase Orders, track expected delivery dates, and monitor receiving status."
        actions={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Create Purchase Order
          </button>
        }
      />

      {loading ? (
        <SkeletonBlock rows={4} />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase border-b">
              <tr>
                <th className="px-4 py-3">PO Number</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Order Date</th>
                <th className="px-4 py-3">Expected Delivery</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
                <th className="px-4 py-3 text-right">GST</th>
                <th className="px-4 py-3 text-right">Total (INR)</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {pos.map((po) => (
                <tr key={po.id}>
                  <td className="px-4 py-3 font-mono font-bold text-blue-600">{po.po_number}</td>
                  <td className="px-4 py-3 font-semibold">{po.supplier_name}</td>
                  <td className="px-4 py-3">{formatIndianDate(po.order_date)}</td>
                  <td className="px-4 py-3">
                    {formatIndianDate(po.expected_delivery_date)}{' '}
                    {po.is_overdue && <Badge variant="danger">OVERDUE</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right">{formatINR(po.subtotal)}</td>
                  <td className="px-4 py-3 text-right">{formatINR(po.tax_amount)}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatINR(po.total_amount)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusBadgeVariant(po.status)}>{po.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Issue New Purchase Order">
        <form onSubmit={handleCreatePO} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Supplier *</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-slate-800">
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.code} — {s.name} (Lead time: {s.lead_time_days}d)</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">Product SKU *</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-slate-800">
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Order Quantity *</label>
              <input type="number" required value={qty} onChange={(e) => setQty(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Unit Price (₹) *</label>
              <input type="number" required value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border px-4 py-2 font-semibold">Cancel</button>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Generate PO</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const ApprovalsCentrePage: React.FC = () => {
  const { notify, hasPermission } = useAuth();
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/approvals');
      setApprovals(res.data.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id: string, action: 'approve' | 'reject') => {
    try {
      await apiClient.post(`/approvals/${id}/${action}`, {
        comments: `${action.toUpperCase()}D via Approval Centre`,
      });
      notify(`Workflow ${action === 'approve' ? 'Approved' : 'Rejected'}`, 'Status and linked record updated.', 'success');
      load();
    } catch (err: any) {
      notify('Action Denied', err.response?.data?.detail || 'Insufficient permissions', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Multi-Level Approval Centre"
        subtitle="Review, approve, or reject pending Purchase Requests, high-value Purchase Orders, and Stock Adjustments."
      />

      {loading ? (
        <SkeletonBlock rows={4} />
      ) : (
        <div className="space-y-3">
          {approvals.map((a) => (
            <div key={a.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={statusBadgeVariant(a.status)}>{a.status}</Badge>
                  <Badge variant="default">{a.entity_type}</Badge>
                  <span className="font-mono font-bold text-blue-600">{a.reference_number}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{a.title}</h3>
                <p className="text-slate-500">Value: <strong>{formatINR(a.amount)}</strong> • Level {a.level} Sign-Off</p>
              </div>

              {a.status === 'PENDING' && hasPermission('procurement:approve') && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => decide(a.id, 'approve')}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3.5 py-2 font-bold text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(a.id, 'reject')}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-300 text-red-600 px-3.5 py-2 font-bold hover:bg-red-50"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const RFQManagementPage: React.FC = () => {
  const { notify } = useAuth();
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('100');

  const load = useCallback(async () => {
    const [rRes, pRes] = await Promise.all([apiClient.get('/rfqs'), apiClient.get('/products')]);
    setRfqs(rRes.data.items || []);
    setProducts(pRes.data.items || []);
    if (pRes.data.items?.[0] && !productId) setProductId(pRes.data.items[0].id);
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiClient.post('/rfqs', { title, product_id: productId, required_qty: Number(qty) });
    notify('RFQ Issued', 'Request for Quotation published for supplier bidding.', 'success');
    setModalOpen(false);
    setTitle('');
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Request for Quotation (RFQ) Management"
        subtitle="Issue structured RFQs to multiple vendors and compare landed GST pricing and delivery commitments."
        actions={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Create New RFQ
          </button>
        }
      />

      <div className="grid md:grid-cols-2 gap-4">
        {rfqs.map((r) => (
          <div key={r.id} className="rounded-xl border bg-white dark:bg-slate-900 p-5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-blue-600">{r.rfq_number}</span>
              <Badge variant={statusBadgeVariant(r.status)}>{r.status}</Badge>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{r.title}</h3>
            <p className="text-slate-500">Product: {r.product_name} • Qty: {r.required_qty}</p>
            <div className="flex items-center justify-between pt-2 border-t">
              <span>Received Quotes: <strong>{r.quotations_count}</strong></span>
              <Link to="/app/quotations" className="font-semibold text-blue-600 hover:underline">
                Compare Quotations →
              </Link>
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create New RFQ">
        <form onSubmit={handleCreate} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">RFQ Title *</label>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Q4 Supply — Precision Ball Bearings" className="w-full rounded-lg border px-3 py-2 bg-transparent" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Product *</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-slate-800">
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">Required Quantity *</label>
            <input type="number" required value={qty} onChange={(e) => setQty(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border px-4 py-2 font-semibold">Cancel</button>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Issue RFQ</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const QuotationComparisonPage: React.FC = () => {
  const { notify } = useAuth();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/quotations/compare');
      setQuotes(res.data.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleConvertQuoteToPO = async (q: any) => {
    try {
      const res = await apiClient.post('/purchase-orders', {
        supplier_id: q.supplier_id,
        quotation_id: q.quotation_id,
        payment_terms_days: q.payment_terms_days,
        items: [
          {
            product_id: q.product_id,
            ordered_qty: q.quantity,
            unit_price: q.unit_price,
            tax_rate: 18,
          },
        ],
      });
      notify('Purchase Order Issued from Quote', `Created ${res.data.po_number} with ${q.supplier_name}.`, 'success');
    } catch (err: any) {
      notify('Error', err.response?.data?.detail || 'Could not convert quotation', 'error');
    }
  };

  if (loading) return <SkeletonBlock rows={4} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Side-by-Side Supplier Quotation Comparison Matrix"
        subtitle="Composite Value Score weights Price Competitiveness (45%), Supplier Reliability Score (35%), and Delivery Lead Time (20%)."
      />

      <div className="grid md:grid-cols-3 gap-5">
        {quotes.map((q) => (
          <div
            key={q.quotation_id}
            className={`rounded-2xl border p-5 space-y-4 text-xs ${
              q.is_recommended
                ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-md'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-blue-600">{q.quote_number}</span>
              {q.is_recommended ? (
                <Badge variant="success">★ AI Best Composite Value ({q.composite_value_score})</Badge>
              ) : (
                <Badge variant="default">Value Score: {q.composite_value_score}</Badge>
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{q.supplier_name}</h3>
              <p className="text-slate-500">{q.product_name} ({q.quantity} units)</p>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3">
              <div>
                <span className="text-slate-400 block">Quoted Unit Rate</span>
                <strong className="text-sm">{formatINR(q.unit_price)}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Landed Total (incl GST)</span>
                <strong className="text-sm text-blue-600">{formatINR(q.total_amount)}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Promised Delivery</span>
                <strong>{q.delivery_days} Days</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Vendor Reliability</span>
                <strong>{q.supplier_reliability_score}/100 ({q.supplier_risk_category})</strong>
              </div>
            </div>
            <p className="text-slate-500">{q.notes}</p>
            <button
              type="button"
              onClick={() => handleConvertQuoteToPO(q)}
              className="w-full rounded-lg bg-slate-900 dark:bg-blue-600 py-2 font-semibold text-white hover:opacity-90"
            >
              Award & Generate Purchase Order
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export const GoodsReceivingPage: React.FC = () => {
  const { notify } = useAuth();
  const [grns, setGrns] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState('');
  const [challanNo, setChallanNo] = useState('DC-2026-991');

  const load = useCallback(async () => {
    const [gRes, poRes] = await Promise.all([
      apiClient.get('/goods-receipts'),
      apiClient.get('/purchase-orders'),
    ]);
    setGrns(gRes.data.items || []);
    setPos(poRes.data.items || []);
    if (poRes.data.items?.[0] && !selectedPoId) setSelectedPoId(poRes.data.items[0].id);
  }, [selectedPoId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRecordGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    const po = pos.find((p) => p.id === selectedPoId);
    if (!po || !po.items?.length) return;
    try {
      const res = await apiClient.post('/goods-receipts', {
        purchase_order_id: po.id,
        supplier_challan_no: challanNo,
        items: po.items.map((it: any) => ({
          product_id: it.product_id,
          ordered_qty: it.ordered_qty,
          received_qty: it.ordered_qty,
          accepted_qty: it.ordered_qty,
          rejected_qty: 0,
          batch_number: `BATCH-${Date.now().toString().slice(-4)}`,
        })),
      });
      notify('GRN Recorded & Stock Updated', `${res.data.grn_number} posted stock-in to warehouse ledger.`, 'success');
      setModalOpen(false);
      load();
    } catch (err: any) {
      notify('Error', err.response?.data?.detail || 'Failed to record GRN', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goods Receipt Notes (GRN) & Quality Receiving"
        subtitle="Verify incoming supplier deliveries against Purchase Orders and automatically post accepted quantities into warehouse inventory."
        actions={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Record New Goods Receipt (GRN)
          </button>
        }
      />

      <div className="space-y-3">
        {grns.map((g) => (
          <div key={g.id} className="rounded-xl border bg-white dark:bg-slate-900 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-blue-600">{g.grn_number}</span>
                <Badge variant={statusBadgeVariant(g.status)}>{g.status}</Badge>
                <span className="text-slate-400">Linked PO: {g.po_number}</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {g.supplier_name} → {g.warehouse_name}
              </h3>
              <p className="text-slate-500">
                Challan: {g.supplier_challan_no} • Items: {g.items?.map((i: any) => `${i.product_name} (Accepted: ${i.accepted_qty})`).join(', ')}
              </p>
            </div>
            <div className="text-right text-slate-500">
              Received: {formatIndianDate(g.received_date)}
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Goods Receipt Note (GRN)">
        <form onSubmit={handleRecordGRN} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Select Purchase Order *</label>
            <select value={selectedPoId} onChange={(e) => setSelectedPoId(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-slate-800">
              {pos.map((p) => (
                <option key={p.id} value={p.id}>{p.po_number} — {p.supplier_name} ({formatINR(p.total_amount)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">Supplier Delivery Challan No *</label>
            <input required value={challanNo} onChange={(e) => setChallanNo(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border px-4 py-2 font-semibold">Cancel</button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white">Verify & Post Stock-In</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

