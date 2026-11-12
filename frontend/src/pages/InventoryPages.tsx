import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Package,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import {
  Line,
  LineChart,
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

export const InventoryDashboardPage: React.FC = () => {
  const [balancesData, setBalancesData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/inventory/balances');
      setBalancesData(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <SkeletonBlock rows={5} />;

  const items = balancesData?.items || [];
  const batches = balancesData?.batches || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Multi-Warehouse Inventory & Batch Ledger"
        subtitle="Live on-hand, reserved, and available stock across all warehouse locations with batch/expiry tracking."
        badge={`Total Valuation: ${formatINR(balancesData?.total_valuation_inr)}`}
        actions={
          <>
            <Link
              to="/app/stock-movements"
              className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              + Record Stock Movement
            </Link>
            <Link
              to="/app/products"
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold"
            >
              Manage SKU Catalogue
            </Link>
          </>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="No inventory balances recorded yet"
          description="Create products in the catalogue or record a stock-in movement to populate multi-warehouse balances."
        />
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Warehouse</th>
                  <th className="px-4 py-3 text-right">On-Hand</th>
                  <th className="px-4 py-3 text-right">Reorder Pt</th>
                  <th className="px-4 py-3 text-right">Unit Cost</th>
                  <th className="px-4 py-3 text-right">Valuation (INR)</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {items.map((b: any) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-semibold text-blue-600 dark:text-blue-400">{b.sku}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{b.product_name}</td>
                    <td className="px-4 py-3">{b.warehouse_name} ({b.warehouse_code})</td>
                    <td className="px-4 py-3 text-right font-bold">{b.on_hand_qty} {b.uom_symbol}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{b.reorder_point} {b.uom_symbol}</td>
                    <td className="px-4 py-3 text-right">{formatINR(b.unit_cost)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatINR(b.valuation_inr)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadgeVariant(b.status)}>{b.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {batches.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Active Batch & Expiry Tracking Register
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {batches.map((bt: any) => (
                  <div
                    key={bt.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-blue-600">{bt.batch_number}</span>
                      <Badge variant="success">{bt.quantity} units</Badge>
                    </div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{bt.product_name}</p>
                    <p className="text-[11px] text-slate-400">{bt.warehouse_name}</p>
                    <p className="text-[11px] text-slate-500">
                      Expiry: {formatIndianDate(bt.expiry_date)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export const ProductCataloguePage: React.FC = () => {
  const { notify, hasPermission } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [hsnCode, setHsnCode] = useState('84818030');
  const [categoryName, setCategoryName] = useState('Industrial Valves & Actuators');
  const [uom, setUom] = useState('PCS');
  const [unitCost, setUnitCost] = useState('1250');
  const [sellingPrice, setSellingPrice] = useState('1750');
  const [taxRate, setTaxRate] = useState('18');
  const [reorderPoint, setReorderPoint] = useState('50');
  const [safetyStock, setSafetyStock] = useState('20');
  const [leadTime, setLeadTime] = useState('7');
  const [dailyDemand, setDailyDemand] = useState('5');
  const [initialStock, setInitialStock] = useState('60');

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/products', {
        params: {
          search: search || undefined,
          low_stock_only: lowStockOnly || undefined,
        },
      });
      setProducts(res.data.items || []);
    } finally {
      setLoading(false);
    }
  }, [search, lowStockOnly]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/products', {
        sku,
        name,
        barcode: barcode || undefined,
        hsn_code: hsnCode,
        category_name: categoryName,
        uom_symbol: uom,
        unit_cost: Number(unitCost),
        selling_price: Number(sellingPrice),
        tax_rate: Number(taxRate),
        reorder_point: Number(reorderPoint),
        safety_stock: Number(safetyStock),
        lead_time_days: Number(leadTime),
        avg_daily_demand: Number(dailyDemand),
        initial_stock: Number(initialStock),
      });
      notify('Product SKU Created', `Added ${sku} (${name}) to catalogue.`, 'success');
      setModalOpen(false);
      setSku('');
      setName('');
      loadProducts();
    } catch (err: any) {
      notify('Creation Failed', err.response?.data?.detail || 'Error creating SKU', 'error');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await apiClient.delete(`/products/${id}`);
      notify('Product Archived', 'SKU removed from active catalogue.', 'info');
      setConfirmDeleteId(null);
      loadProducts();
    } catch (err: any) {
      notify('Error', err.response?.data?.detail || 'Cannot archive SKU', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Catalogue & SKU Master"
        subtitle="Manage SKUs, barcodes, Indian HSN codes, GST slabs, reorder thresholds, and stock valuations."
        actions={
          hasPermission('inventory:write') && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> Add Product SKU
            </button>
          )
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by SKU, Product Name, or Barcode..."
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-xs"
          />
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
            className="rounded"
          />
          Show Low-Stock SKUs Only
        </label>
      </div>

      {loading ? (
        <SkeletonBlock rows={5} />
      ) : products.length === 0 ? (
        <EmptyState
          title="No products match your filter"
          description="Add a new SKU to start tracking inventory balances, demand forecasts, and purchase orders."
          actionLabel="Create First SKU"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">SKU / Barcode</th>
                <th className="px-4 py-3">Product Name & Category</th>
                <th className="px-4 py-3">HSN & GST</th>
                <th className="px-4 py-3 text-right">Unit Cost</th>
                <th className="px-4 py-3 text-right">On-Hand</th>
                <th className="px-4 py-3 text-right">Reorder Pt</th>
                <th className="px-4 py-3">Risk Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400 block">{p.sku}</span>
                    <span className="text-[10px] text-slate-400">{p.barcode || 'No barcode'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-slate-900 dark:text-white block">{p.name}</span>
                    <span className="text-[11px] text-slate-400">{p.category_name} • Supplier: {p.preferred_supplier_name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block">HSN: {p.hsn_code || '—'}</span>
                    <span className="text-[10px] text-slate-400">GST {p.tax_rate}%</span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatINR(p.unit_cost)}</td>
                  <td className="px-4 py-3 text-right font-bold">
                    {p.on_hand_qty} {p.uom_symbol}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {p.reorder_point} {p.uom_symbol}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusBadgeVariant(p.risk_level)}>
                      {p.risk_level} ({p.days_of_supply}d supply)
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {hasPermission('inventory:write') && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(p.id)}
                        title="Archive SKU"
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Product Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create New Product SKU">
        <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">SKU Code *</label>
              <input required value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU-PMP-200" className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Unit of Measure *</label>
              <select value={uom} onChange={(e) => setUom(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2">
                {['PCS', 'KG', 'MTR', 'LTR', 'BOX', 'TON'].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Product Name *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Centrifugal Process Pump Impeller SS316" className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold mb-1">HSN Code</label>
              <input value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2" />
            </div>
            <div>
              <label className="block font-semibold mb-1">GST Rate (%)</label>
              <input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Barcode</label>
              <input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="8901425..." className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold mb-1">Unit Cost (₹)</label>
              <input type="number" required value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Selling Price (₹)</label>
              <input type="number" required value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Opening Stock</label>
              <input type="number" required value={initialStock} onChange={(e) => setInitialStock(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold mb-1">Reorder Point</label>
              <input type="number" required value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Avg Daily Demand</label>
              <input type="number" step="0.5" required value={dailyDemand} onChange={(e) => setDailyDemand(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Lead Time (Days)</label>
              <input type="number" required value={leadTime} onChange={(e) => setLeadTime(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border px-4 py-2 font-semibold">Cancel</button>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Save Product SKU</button>
          </div>
        </form>
      </Modal>

      {/* Destructive Action Confirmation Dialog */}
      <Modal
        open={Boolean(confirmDeleteId)}
        onClose={() => setConfirmDeleteId(null)}
        title="Confirm Archive Product SKU"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Are you sure you want to archive this product SKU from the active catalogue? Historical stock movements and audit logs will be preserved.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded-lg border px-4 py-2 font-semibold">Cancel</button>
            <button
              type="button"
              onClick={() => confirmDeleteId && handleArchive(confirmDeleteId)}
              className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
            >
              Confirm Archive
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export const WarehouseManagementPage: React.FC = () => {
  const { notify, hasPermission } = useAuth();
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('Pune');
  const [manager, setManager] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/warehouses');
      setWarehouses(res.data.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/warehouses', {
        code,
        name,
        city,
        state: 'Maharashtra',
        manager_name: manager,
        capacity_units: 15000,
      });
      notify('Warehouse Added', `Created ${code} (${name})`, 'success');
      setModalOpen(false);
      setCode('');
      setName('');
      load();
    } catch (err: any) {
      notify('Error', err.response?.data?.detail || 'Failed to add warehouse', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouse & Multi-Location Hub Management"
        subtitle="Track storage utilization, regional inventory valuations, and warehouse managers."
        actions={
          hasPermission('inventory:write') && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Add Warehouse Location
            </button>
          )
        }
      />

      {loading ? (
        <SkeletonBlock rows={3} />
      ) : (
        <div className="grid md:grid-cols-3 gap-5">
          {warehouses.map((wh) => (
            <div
              key={wh.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-blue-600">{wh.code}</span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{wh.name}</h3>
                  <p className="text-xs text-slate-500">{wh.city}, {wh.state}</p>
                </div>
                {wh.is_primary && <Badge variant="navy">Primary Hub</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-xs">
                <div>
                  <span className="text-slate-400 block">Stock Valuation</span>
                  <strong className="text-slate-900 dark:text-white">{formatINR(wh.total_valuation_inr)}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Total Units</span>
                  <strong className="text-slate-900 dark:text-white">{wh.total_units} ({wh.sku_count} SKUs)</strong>
                </div>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Capacity Utilization</span>
                  <span className="font-semibold">{wh.utilization_percent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full bg-blue-600" style={{ width: `${wh.utilization_percent}%` }} />
                </div>
                <p className="text-[11px] text-slate-400 pt-1">Manager: {wh.manager_name || 'Assigned Supervisor'}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create New Warehouse Location">
        <form onSubmit={handleCreate} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Warehouse Code *</label>
            <input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="WH-BLR-04" className="w-full rounded-lg border px-3 py-2 bg-transparent" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Facility Name *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Peenya Industrial Hub (Bengaluru)" className="w-full rounded-lg border px-3 py-2 bg-transparent" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">City *</label>
              <input required value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Facility Manager</label>
              <input value={manager} onChange={(e) => setManager(e.target.value)} placeholder="Suresh Nair" className="w-full rounded-lg border px-3 py-2 bg-transparent" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border px-4 py-2 font-semibold">Cancel</button>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Create Warehouse</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const StockMovementsPage: React.FC = () => {
  const { notify, hasPermission } = useAuth();
  const [movements, setMovements] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [movementType, setMovementType] = useState('IN');
  const [quantity, setQuantity] = useState('25');
  const [batchNumber, setBatchNumber] = useState('LOT-2026-X1');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, pRes, wRes] = await Promise.all([
        apiClient.get('/inventory/movements'),
        apiClient.get('/products'),
        apiClient.get('/warehouses'),
      ]);
      setMovements(mRes.data.items || []);
      setProducts(pRes.data.items || []);
      setWarehouses(wRes.data.items || []);
      if (pRes.data.items?.[0] && !productId) setProductId(pRes.data.items[0].id);
      if (wRes.data.items?.[0] && !warehouseId) setWarehouseId(wRes.data.items[0].id);
    } finally {
      setLoading(false);
    }
  }, [productId, warehouseId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.post('/inventory/movements', {
        product_id: productId,
        warehouse_id: warehouseId,
        movement_type: movementType,
        quantity: Number(quantity),
        batch_number: batchNumber || undefined,
        notes: notes || `${movementType} recorded via Stock Movement Ledger`,
      });
      notify(
        'Stock Movement Recorded',
        `${res.data.movement_type} of ${res.data.quantity} units posted. New balance: ${res.data.balance_after}`,
        'success'
      );
      setModalOpen(false);
      load();
    } catch (err: any) {
      notify('Stock Movement Blocked', err.response?.data?.detail || 'Error posting movement', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Immutable Stock Movement Ledger"
        subtitle="Every inventory balance change is backed by an auditable stock-in, stock-out, GRN, or adjustment transaction."
        actions={
          hasPermission('inventory:write') && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Record Stock In / Out / Adjustment
            </button>
          )
        }
      />

      {loading ? (
        <SkeletonBlock rows={5} />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">SKU & Product</th>
                <th className="px-4 py-3">Warehouse</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3 text-right">Balance After</th>
                <th className="px-4 py-3">Reference & Batch</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3 text-slate-500">{formatIndianDate(m.created_at)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={m.movement_type === 'OUT' ? 'warning' : 'success'}>
                      {m.movement_type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold text-blue-600">{m.sku}</span> — {m.product_name}
                  </td>
                  <td className="px-4 py-3">{m.warehouse_name}</td>
                  <td className="px-4 py-3 text-right font-bold">
                    {m.movement_type === 'OUT' ? '-' : '+'}{m.quantity} {m.uom_symbol}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{m.balance_after} {m.uom_symbol}</td>
                  <td className="px-4 py-3 font-mono text-[11px]">
                    {m.reference_id} {m.batch_number ? `(${m.batch_number})` : ''}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{m.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Validated Stock Movement">
        <form onSubmit={handleRecordMovement} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Product SKU *</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-slate-800">
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.sku} — {p.name} (On-hand: {p.on_hand_qty})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Warehouse *</label>
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-slate-800">
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Movement Type *</label>
              <select value={movementType} onChange={(e) => setMovementType(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-slate-800">
                <option value="IN">IN (Stock Receipt)</option>
                <option value="OUT">OUT (Production / Dispatch)</option>
                <option value="ADJUSTMENT">ADJUSTMENT (Cycle Count)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Quantity *</label>
              <input type="number" required min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Batch / Lot Number</label>
              <input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-transparent" />
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Operational Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Issued to Assembly Line 2" className="w-full rounded-lg border px-3 py-2 bg-transparent" />
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border px-4 py-2 font-semibold">Cancel</button>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Post Ledger Entry</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const InventoryAlertsForecastPage: React.FC = () => {
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [selectedSku, setSelectedSku] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get('/inventory/forecast')
      .then((res) => {
        const list = res.data.items || [];
        setForecasts(list);
        if (list.length > 0) setSelectedSku(list[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonBlock rows={5} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Alerts, Reorder-Point Mathematics & Demand Forecasting"
        subtitle="Formula: Reorder Point (ROP) = (Average Daily Demand × Supplier Lead Time) + Safety Stock. Compares 7-Day Moving Average vs Holt Exponential Smoothing."
        badge="ML Forecasting"
      />

      {/* SKU Forecast Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-4 py-3">SKU & Product</th>
              <th className="px-4 py-3 text-right">Current Stock</th>
              <th className="px-4 py-3 text-right">Daily Demand</th>
              <th className="px-4 py-3 text-right">Lead Time</th>
              <th className="px-4 py-3 text-right">Safety Stock</th>
              <th className="px-4 py-3 text-right">Reorder Pt (ROP)</th>
              <th className="px-4 py-3">Stockout Date</th>
              <th className="px-4 py-3 text-right">Suggested Order</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Model Curve</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {forecasts.map((f) => (
              <tr key={f.product_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                <td className="px-4 py-3">
                  <span className="font-mono font-bold text-blue-600 block">{f.sku}</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{f.product_name}</span>
                </td>
                <td className="px-4 py-3 text-right font-bold">{f.current_stock} {f.uom_symbol}</td>
                <td className="px-4 py-3 text-right">{f.avg_daily_demand} / day</td>
                <td className="px-4 py-3 text-right">{f.lead_time_days} days</td>
                <td className="px-4 py-3 text-right">{f.safety_stock}</td>
                <td className="px-4 py-3 text-right font-semibold">{f.reorder_point}</td>
                <td className="px-4 py-3 font-medium text-red-600">
                  {f.expected_stockout_date ? formatIndianDate(f.expected_stockout_date) : 'Safe (>180d)'}
                </td>
                <td className="px-4 py-3 text-right font-bold text-emerald-600">
                  {f.suggested_reorder_qty} {f.uom_symbol}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusBadgeVariant(f.risk_level)}>{f.risk_level}</Badge>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setSelectedSku(f)}
                    className="rounded bg-blue-50 dark:bg-blue-950 px-2.5 py-1 text-[11px] font-semibold text-blue-600"
                  >
                    Inspect Forecast
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Selected SKU Baseline vs Advanced Model Comparison */}
      {selectedSku && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                14-Day Demand Forecast Comparison: {selectedSku.product_name} ({selectedSku.sku})
              </h3>
              <p className="text-xs text-slate-500">
                Selected Winner: <strong>{selectedSku.forecast_evaluation?.selected_model}</strong> •
                14-Day Cumulative Demand Forecast: <strong>{selectedSku.forecast_evaluation?.forecast_14d_total} {selectedSku.uom_symbol}</strong>
              </p>
            </div>
            <div className="flex gap-3 text-xs">
              <div className="rounded-lg border px-3 py-1.5">
                <span className="text-slate-400 block">Baseline (7d SMA) Error</span>
                <strong>MAE: {selectedSku.forecast_evaluation?.baseline_metrics?.mae} | MAPE: {selectedSku.forecast_evaluation?.baseline_metrics?.mape_percent}%</strong>
              </div>
              <div className="rounded-lg border border-teal-500/40 bg-teal-50/40 dark:bg-teal-950/30 px-3 py-1.5">
                <span className="text-teal-600 block">Advanced (Holt Trend) Error</span>
                <strong>MAE: {selectedSku.forecast_evaluation?.advanced_metrics?.mae} | MAPE: {selectedSku.forecast_evaluation?.advanced_metrics?.mape_percent}%</strong>
              </div>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={selectedSku.forecast_evaluation?.forecast_series || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="baseline_sma_forecast" name="Baseline 7-Day SMA" stroke="#64748b" strokeWidth={2} />
                <Line type="monotone" dataKey="advanced_holt_forecast" name="Holt Trend Smoothing" stroke="#0d9488" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

