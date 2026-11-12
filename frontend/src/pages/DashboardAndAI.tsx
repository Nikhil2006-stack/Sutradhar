import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileText,
  RefreshCw,
  Send,
  ShieldAlert,
  ShoppingCart,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiClient } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { AIRecommendationItem, formatINR, formatIndianDate } from '../types';
import {
  Badge,
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonBlock,
  statusBadgeVariant,
} from '../components/ui/Common';

export const MainDashboardPage: React.FC = () => {
  const { activeOrg } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/analytics/overview');
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview, activeOrg?.organization_id]);

  if (loading) return <SkeletonBlock rows={6} />;
  if (error) return <ErrorState message={error} onRetry={fetchOverview} />;

  const kpis = data?.kpis || {};
  const isEmptyWorkspace = (kpis.total_skus || 0) === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Operations & Decision Dashboard"
        subtitle={`Real-time operational ledger for ${activeOrg?.organization_name} (${activeOrg?.city || 'India'})`}
        badge={data?.is_demo_workspace ? 'Labelled Demo Dataset Active' : 'Live Production Ledger'}
        actions={
          <>
            <Link
              to="/app/recommendations"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Sparkles className="h-3.5 w-3.5" /> Action Engine ({kpis.open_ai_recommendations_count || 0})
            </Link>
            <Link
              to="/app/documents"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50"
            >
              <FileText className="h-3.5 w-3.5" /> Upload Invoice / PO
            </Link>
          </>
        }
      />

      {isEmptyWorkspace ? (
        <EmptyState
          title="Welcome to your new clean Organisation Workspace!"
          description="This workspace currently has 0 products and 0 transactions. Start by adding products to your catalogue, onboarding suppliers, or uploading an invoice PDF."
          actionLabel="Add First Product SKU"
          onAction={() => (window.location.href = '/app/products')}
        />
      ) : (
        <>
          {/* 8 Linked Operational KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              to="/app/inventory"
              className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-blue-500 transition"
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Total Inventory Value</span>
                <Boxes className="h-4 w-4 text-blue-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {formatINR(kpis.total_inventory_value_inr)}
              </p>
              <p className="mt-1 text-xs text-blue-600 group-hover:underline flex items-center gap-1">
                Across {kpis.total_skus} active SKUs <ArrowRight className="h-3 w-3" />
              </p>
            </Link>

            <Link
              to="/app/inventory-alerts"
              className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-red-500 transition"
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Low-Stock / Stockout Risk</span>
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-red-600">
                {kpis.low_stock_products_count} SKUs
              </p>
              <p className="mt-1 text-xs text-slate-500 group-hover:underline flex items-center gap-1">
                View Reorder & Forecast Alerts <ArrowRight className="h-3 w-3" />
              </p>
            </Link>

            <Link
              to="/app/purchase-orders"
              className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-blue-500 transition"
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Pending Purchase Orders</span>
                <ShoppingCart className="h-4 w-4 text-teal-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {kpis.pending_purchase_orders_count} Open POs
              </p>
              <p className="mt-1 text-xs text-slate-500 group-hover:underline flex items-center gap-1">
                Track Deliveries & GRNs <ArrowRight className="h-3 w-3" />
              </p>
            </Link>

            <Link
              to="/app/approvals"
              className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-amber-500 transition"
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Pending Approvals</span>
                <ClipboardCheck className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-amber-600">
                {kpis.pending_approvals_count} Awaiting
              </p>
              <p className="mt-1 text-xs text-slate-500 group-hover:underline flex items-center gap-1">
                Open Approval Centre <ArrowRight className="h-3 w-3" />
              </p>
            </Link>

            <Link
              to="/app/payables"
              className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-blue-500 transition"
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Outstanding Payables (AP)</span>
                <CreditCard className="h-4 w-4 text-rose-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {formatINR(kpis.outstanding_payables_inr)}
              </p>
              <p className="mt-1 text-xs text-slate-500 group-hover:underline flex items-center gap-1">
                Manage Supplier Invoices <ArrowRight className="h-3 w-3" />
              </p>
            </Link>

            <Link
              to="/app/receivables"
              className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-emerald-500 transition"
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Outstanding Receivables (AR)</span>
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-600">
                {formatINR(kpis.outstanding_receivables_inr)}
              </p>
              <p className="mt-1 text-xs text-slate-500 group-hover:underline flex items-center gap-1">
                Customer Collections <ArrowRight className="h-3 w-3" />
              </p>
            </Link>

            <Link
              to="/app/supplier-analytics"
              className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-blue-500 transition"
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Avg Supplier Reliability</span>
                <ShieldAlert className="h-4 w-4 text-blue-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {kpis.avg_supplier_reliability} / 100
              </p>
              <p className="mt-1 text-xs text-slate-500 group-hover:underline flex items-center gap-1">
                Supplier Risk Scorecard <ArrowRight className="h-3 w-3" />
              </p>
            </Link>

            <Link
              to="/app/recommendations"
              className="group rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 p-5 shadow-xs hover:border-blue-500 transition"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-blue-700 dark:text-blue-300">
                <span>AI Action Recommendations</span>
                <Sparkles className="h-4 w-4 text-blue-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-blue-700 dark:text-blue-300">
                {kpis.open_ai_recommendations_count} Active
              </p>
              <p className="mt-1 text-xs text-blue-600 group-hover:underline flex items-center gap-1">
                Review & Approve Actions <ArrowRight className="h-3 w-3" />
              </p>
            </Link>
          </div>

          {/* Analytics Charts Row */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    SKU Stock Levels vs Reorder Points
                  </h3>
                  <p className="text-xs text-slate-500">Identifies SKUs operating below safety thresholds</p>
                </div>
                <Link to="/app/inventory-alerts" className="text-xs font-semibold text-blue-600 hover:underline">
                  Forecast Details →
                </Link>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.inventory_chart || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                    <XAxis dataKey="sku" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="on_hand" name="On-Hand Qty" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="reorder_point" name="Reorder Point" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Supplier Reliability & On-Time Delivery (%)
                  </h3>
                  <p className="text-xs text-slate-500">Measurable SLA tracking across active vendors</p>
                </div>
                <Link to="/app/supplier-analytics" className="text-xs font-semibold text-blue-600 hover:underline">
                  Full Scorecard →
                </Link>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.supplier_chart || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="reliability_score" name="Reliability Score" fill="#0d9488" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="on_time_rate" name="On-Time Delivery %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Signature AI Insights, Deadlines & Recent Activity */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Signature Business Intelligence & Action Engine Alerts
                  </h3>
                </div>
                <Link to="/app/recommendations" className="text-xs font-semibold text-blue-600 hover:underline">
                  View All & Approve →
                </Link>
              </div>
              <div className="space-y-3">
                {(data.ai_insights || []).map((ins: any) => (
                  <div
                    key={ins.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={statusBadgeVariant(ins.severity)}>{ins.severity}</Badge>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{ins.title}</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{ins.reasoning}</p>
                    </div>
                    <Link
                      to="/app/recommendations"
                      className="shrink-0 rounded-lg bg-slate-900 dark:bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                    >
                      Inspect & Act
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Upcoming Deadlines</h3>
                </div>
                <div className="space-y-2.5">
                  {(data.upcoming_deadlines || []).map((dl: any, idx: number) => (
                    <Link
                      key={idx}
                      to={dl.link}
                      className="block rounded-lg border border-slate-100 dark:border-slate-800 p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs"
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="truncate">{dl.title}</span>
                        <Badge variant={dl.days_remaining < 0 ? 'danger' : 'warning'}>
                          {dl.days_remaining < 0
                            ? `${Math.abs(dl.days_remaining)}d overdue`
                            : `In ${dl.days_remaining}d`}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Due: {formatIndianDate(dl.due_date)}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Audit Activity</h3>
                  <Link to="/app/audit-logs" className="text-xs text-blue-600 hover:underline">
                    Full Log →
                  </Link>
                </div>
                <div className="space-y-2 text-xs">
                  {(data.recent_activities || []).slice(0, 4).map((act: any) => (
                    <div key={act.id} className="border-b border-slate-100 dark:border-slate-800 pb-2 last:border-none">
                      <p className="font-medium text-slate-800 dark:text-slate-200">{act.summary}</p>
                      <p className="text-[10px] text-slate-400">
                        {act.actor_email} • {formatIndianDate(act.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// =============================================================================
// SIGNATURE FEATURE: BUSINESS INTELLIGENCE & ACTION ENGINE CENTRE
// =============================================================================

export const RecommendationsCentrePage: React.FC = () => {
  const { notify, hasPermission } = useAuth();
  const [items, setItems] = useState<AIRecommendationItem[]>([]);
  const [providerStatus, setProviderStatus] = useState<any>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/ai/recommendations', {
        params: categoryFilter ? { category: categoryFilter } : {},
      });
      setItems(res.data.items || []);
      setProviderStatus(res.data.provider_status);
    } catch {
      notify('Error', 'Unable to load AI recommendations', 'error');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, notify]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  const handleRescan = async () => {
    setScanning(true);
    try {
      const res = await apiClient.post('/ai/recommendations/generate');
      notify('Live Intelligence Scan Complete', `Generated ${res.data.generated_count} explainable recommendations.`, 'success');
      await loadRecommendations();
    } catch {
      notify('Scan Failed', 'Could not run recommendation scan', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleApproveAndExecute = async (rec: AIRecommendationItem) => {
    try {
      const res = await apiClient.post(`/ai/recommendations/${rec.id}/approve`, {
        helpful: true,
        notes: 'Human-approved via Business Recommendations Centre',
      });
      notify('Action Executed & Audited', res.data.execution_result, 'success');
      await loadRecommendations();
    } catch (err: any) {
      notify('Permission / Execution Error', err.response?.data?.detail || 'Failed to execute action', 'error');
    }
  };

  const handleDismiss = async (recId: string) => {
    try {
      await apiClient.post(`/ai/recommendations/${recId}/feedback`, {
        helpful: false,
        status: 'DISMISSED',
        notes: 'Dismissed by operator',
      });
      notify('Recommendation Dismissed', 'Status updated in audit history.', 'info');
      await loadRecommendations();
    } catch {
      notify('Error', 'Could not update recommendation', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Signature Feature: Business Intelligence & Action Engine"
        subtitle="Explainable operational risk detection → cited evidence → human-approved automated actions → immutable audit trail."
        badge="10-Scenario Engine"
        actions={
          <button
            type="button"
            onClick={handleRescan}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning Live Ledger...' : 'Re-Run Live Intelligence Scan'}
          </button>
        }
      />

      {/* Safety & Provider Banner */}
      <div className="rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/60 dark:bg-teal-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="space-y-0.5">
          <p className="font-bold text-teal-900 dark:text-teal-200">
            Human-in-the-Loop Governance Active
          </p>
          <p className="text-teal-800 dark:text-teal-300">
            AI never autonomously modifies stock balances, approves payments, or issues purchase orders without your explicit approval below.
          </p>
        </div>
        {providerStatus && (
          <Badge variant="info">{providerStatus.model}</Badge>
        )}
      </div>

      {/* Scenario Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { code: '', label: 'All Scenarios' },
          { code: 'STOCKOUT_RISK', label: 'Stockout vs Lead Time' },
          { code: 'OVERDUE_DELIVERY', label: 'Overdue Deliveries' },
          { code: 'EXPENSIVE_QUOTATION', label: 'Expensive Quotations' },
          { code: 'PO_INVOICE_MISMATCH', label: 'PO-Invoice Mismatch' },
          { code: 'SUPPLIER_DETERIORATION', label: 'Supplier Deterioration' },
          { code: 'PAYMENT_OBLIGATION', label: 'Upcoming Payables' },
          { code: 'DEAD_STOCK', label: 'Dead Stock' },
          { code: 'CASHFLOW_PRESSURE', label: 'Cash-Flow Pressure' },
        ].map((f) => (
          <button
            key={f.code}
            type="button"
            onClick={() => setCategoryFilter(f.code)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              categoryFilter === f.code
                ? 'bg-slate-900 text-white dark:bg-blue-600'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonBlock rows={4} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No active recommendations for this filter"
          description="Click 'Re-Run Live Intelligence Scan' to evaluate current stock balances, supplier delays, and payables."
          actionLabel="Run Scan Now"
          onAction={handleRescan}
        />
      ) : (
        <div className="space-y-4">
          {items.map((rec) => (
            <div
              key={rec.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusBadgeVariant(rec.severity)}>{rec.severity}</Badge>
                  <Badge variant="default">{rec.category.replace(/_/g, ' ')}</Badge>
                  <Badge variant={statusBadgeVariant(rec.status)}>{rec.status}</Badge>
                  <span className="text-xs text-slate-400">
                    Confidence: <strong>{rec.confidence_score}%</strong>
                  </span>
                </div>
                {rec.expected_stockout_date && (
                  <span className="text-xs font-semibold text-red-600">
                    Projected Stockout Date: {formatIndianDate(rec.expected_stockout_date)}
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{rec.title}</h3>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {rec.reasoning}
                </p>
              </div>

              {/* Quantitative Metrics Grid when Stockout/Inventory Recommendation */}
              {rec.current_stock !== null && rec.current_stock !== undefined && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3.5 border border-slate-200/80 dark:border-slate-700 text-xs">
                  <div>
                    <span className="text-slate-400 block">Product</span>
                    <strong className="text-slate-900 dark:text-white">{rec.product_name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Current Stock</span>
                    <strong className="text-red-600">{rec.current_stock} units</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Avg Daily Demand</span>
                    <strong className="text-slate-900 dark:text-white">{rec.avg_daily_demand} / day</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Supplier Lead Time</span>
                    <strong className="text-amber-600">{rec.lead_time_days} days ({rec.supplier_name})</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Suggested Reorder Qty</span>
                    <strong className="text-emerald-600">{rec.suggested_reorder_qty} units</strong>
                  </div>
                </div>
              )}

              {/* Traceable Supporting Evidence */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Traceable Supporting Records & Evidence
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {(rec.supporting_evidence || []).map((ev, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs bg-slate-50/40 dark:bg-slate-950/40"
                    >
                      <span className="text-[11px] text-slate-400 block">{ev.metric}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">{ev.value}</span>
                      <span className="text-[10px] text-blue-600 block mt-0.5">Source: {ev.source}</span>
                    </div>
                  ))}
                </div>
                {rec.uncertainty_notes && (
                  <p className="text-[11px] text-slate-400 italic">
                    Uncertainty / Methodology Note: {rec.uncertainty_notes}
                  </p>
                )}
              </div>

              {/* Action Execution Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs">
                  <span className="font-semibold text-slate-500">Recommended Next Step: </span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{rec.recommended_action}</span>
                  {rec.execution_result && (
                    <p className="mt-1 text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {rec.execution_result}
                    </p>
                  )}
                </div>

                {rec.status === 'OPEN' && (
                  <div className="flex items-center gap-2 shrink-0">
                    {hasPermission('ai:action_approve') && (
                      <button
                        type="button"
                        onClick={() => handleApproveAndExecute(rec)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" /> Approve & Execute Action
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDismiss(rec.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" /> Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// AI BUSINESS DECISION ASSISTANT & DOCUMENT RAG
// =============================================================================

export const AIAssistantPage: React.FC = () => {
  const { notify } = useAuth();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Array<any>>([]);
  const [providerStatus, setProviderStatus] = useState<any>(null);
  const [asking, setAsking] = useState(false);

  const samplePrompts = [
    'What was the last price quoted by Shree Ganesh Steels?',
    'Find invoices due this month and summarise our outstanding payments.',
    'Which supplier has the highest delivery delays?',
    'Which purchase orders are pending receipt?',
    'Which products are at risk of stockout before supplier lead time?',
  ];

  useEffect(() => {
    apiClient
      .get('/ai/conversations')
      .then((res) => {
        setProviderStatus(res.data.provider_status);
        const firstConv = res.data.items?.[0];
        if (firstConv?.messages) {
          setMessages(firstConv.messages);
        }
      })
      .catch(() => {});
  }, []);

  const sendQuery = async (qText: string) => {
    if (!qText.trim()) return;
    const userMsg = { id: Date.now().toString(), role: 'user', content: qText };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion('');
    setAsking(true);
    try {
      const res = await apiClient.post('/ai/ask', { question: qText });
      setProviderStatus(res.data.provider_status);
      setMessages((prev) => [
        ...prev,
        {
          id: res.data.message_id,
          role: 'assistant',
          content: res.data.answer,
          intent: res.data.intent,
          citations: res.data.citations,
          confidence: res.data.confidence,
        },
      ]);
    } catch (err: any) {
      notify('AI Assistant Error', err.response?.data?.detail || 'Query failed', 'error');
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Business Decision Assistant & Document RAG"
        subtitle="Ask natural-language questions across your authorised inventory, suppliers, POs, invoices, and uploaded PDF documents."
        badge={providerStatus?.active_provider?.toUpperCase() || 'RAG Engine'}
      />

      {providerStatus && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 px-4 py-2.5 text-xs text-blue-800 dark:text-blue-200 flex items-center justify-between">
          <span>{providerStatus.status_message}</span>
          <Badge variant="info">Tenant & RBAC Isolated</Badge>
        </div>
      )}

      {/* Sample Query Chips */}
      <div className="flex flex-wrap gap-2">
        {samplePrompts.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => sendQuery(p)}
            className="rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-blue-500 hover:text-blue-600 transition"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chat Transcript */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 min-h-96 max-h-[540px] overflow-y-auto space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-16 space-y-2 text-slate-400">
            <Bot className="h-10 w-10 mx-auto text-blue-600" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Ask anything about your operations, suppliers, invoices, or contracts
            </p>
            <p className="text-xs">Click any sample prompt above or type your question below.</p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-3xl rounded-2xl px-4 py-3 text-xs sm:text-sm space-y-2 ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="whitespace-pre-line leading-relaxed">{m.content}</div>
                {m.citations && m.citations.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Verified Source Citations:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {m.citations.map((cit: any, i: number) => (
                        <span
                          key={i}
                          title={cit.snippet}
                          className="inline-flex items-center gap-1 rounded bg-white dark:bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700"
                        >
                          [{cit.source_type}: {cit.reference}] {cit.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {asking && (
          <div className="text-xs text-slate-400 animate-pulse">
            Retrieving tenant-filtered business records and document chunks...
          </div>
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendQuery(question);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask e.g. 'What was the last price quoted by Shree Ganesh Steels?' or 'Find invoices due this month'..."
          className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm"
        />
        <button
          type="submit"
          disabled={asking}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> Ask Sutradhar
        </button>
      </form>
    </div>
  );
};

