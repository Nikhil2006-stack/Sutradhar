import React, { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  Boxes,
  Building2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  GitBranch,
  History,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  Moon,
  Package,
  Plus,
  Receipt,
  Scale,
  Search,
  Settings,
  Shield,
  ShoppingCart,
  Sparkles,
  Sun,
  Truck,
  UserCheck,
  Users,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../services/api';
import { Badge, Modal, ToastContainer } from '../components/ui/Common';

interface NavGroup {
  label: string;
  items: Array<{
    to: string;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: string;
  }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Command & AI Intelligence',
    items: [
      { to: '/app/dashboard', label: 'Business Dashboard', icon: LayoutDashboard },
      { to: '/app/recommendations', label: 'Action Engine (USP)', icon: Sparkles, badge: 'AI' },
      { to: '/app/ai-assistant', label: 'AI Decision Assistant', icon: Bot },
    ],
  },
  {
    label: 'Inventory Intelligence',
    items: [
      { to: '/app/inventory', label: 'Inventory Overview', icon: Boxes },
      { to: '/app/products', label: 'Product Catalogue', icon: Package },
      { to: '/app/warehouses', label: 'Warehouses', icon: WarehouseIcon },
      { to: '/app/stock-movements', label: 'Movement Ledger', icon: History },
      { to: '/app/inventory-alerts', label: 'Alerts & Forecasting', icon: AlertTriangle },
    ],
  },
  {
    label: 'Suppliers & Procurement',
    items: [
      { to: '/app/suppliers', label: 'Supplier Directory', icon: Users },
      { to: '/app/supplier-analytics', label: 'Supplier Risk & SLA', icon: BarChart3 },
      { to: '/app/purchase-requests', label: 'Purchase Requests', icon: ClipboardCheck },
      { to: '/app/rfqs', label: 'RFQ Management', icon: FolderKanban },
      { to: '/app/quotations', label: 'Quotation Compare', icon: Scale },
      { to: '/app/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
      { to: '/app/approvals', label: 'Approval Centre', icon: UserCheck },
      { to: '/app/goods-receiving', label: 'Goods Receiving (GRN)', icon: Truck },
    ],
  },
  {
    label: 'Documents & Finance',
    items: [
      { to: '/app/documents', label: 'AI Document Centre', icon: FileText },
      { to: '/app/invoice-verification', label: 'Invoice Verification', icon: FileCheck2 },
      { to: '/app/payables', label: 'Accounts Payable', icon: CreditCard },
      { to: '/app/receivables', label: 'Accounts Receivable', icon: Receipt },
      { to: '/app/cashflow', label: 'Cash-Flow & P&L', icon: Activity },
    ],
  },
  {
    label: 'Automation & Governance',
    items: [
      { to: '/app/workflows', label: 'Workflow Automation', icon: GitBranch },
      { to: '/app/tasks', label: 'Task Management', icon: CheckSquare },
      { to: '/app/reports', label: 'Reports & Exports', icon: FileSpreadsheet },
      { to: '/app/notifications', label: 'Notifications', icon: Bell },
      { to: '/app/audit-logs', label: 'Security Audit Logs', icon: Shield },
      { to: '/app/team', label: 'Team & RBAC Roles', icon: Users },
      { to: '/app/settings', label: 'Organisation Settings', icon: Settings },
    ],
  },
];

export const AppLayout: React.FC = () => {
  const {
    user,
    activeOrg,
    organizations,
    isLoading,
    isDark,
    toggleDark,
    switchOrganization,
    refreshProfile,
    logout,
    toasts,
    notify,
    dismissToast,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [newOrgModal, setNewOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgGstin, setNewOrgGstin] = useState('');
  const [newOrgCity, setNewOrgCity] = useState('Pune');
  const [newOrgSeed, setNewOrgSeed] = useState(true);
  const [creatingOrg, setCreatingOrg] = useState(false);

  useEffect(() => {
    if (!user) return;
    apiClient
      .get('/notifications')
      .then((res) => setUnreadNotifs(res.data.unread_count || 0))
      .catch(() => {});
  }, [user, activeOrg, location.pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center space-y-2">
          <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center mx-auto animate-pulse">
            <Layers className="h-5 w-5" />
          </div>
          <p className="text-sm text-slate-300">Loading Sutradhar Workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const allNavItems = NAV_GROUPS.flatMap((g) => g.items);
  const filteredNavItems = searchQuery.trim()
    ? allNavItems.filter((item) => item.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const currentBreadcrumb =
    allNavItems.find((i) => location.pathname.startsWith(i.to))?.label || 'Workspace';

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setCreatingOrg(true);
    try {
      const res = await apiClient.post('/organizations', {
        name: newOrgName.trim(),
        gstin: newOrgGstin.trim() || undefined,
        city: newOrgCity.trim() || 'Pune',
        state: 'Maharashtra',
        seed_demo_data: newOrgSeed,
      });
      await switchOrganization(res.data.id);
      await refreshProfile();
      setNewOrgModal(false);
      setNewOrgName('');
      setNewOrgGstin('');
      notify('Organisation Created', `Switched to ${res.data.name}`, 'success');
    } catch (err: any) {
      notify('Failed to create organisation', err.response?.data?.detail || 'Error', 'error');
    } finally {
      setCreatingOrg(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop & Mobile Sidebar */}
      <aside
        className={`${
          collapsed ? 'w-18' : 'w-64'
        } ${
          mobileOpen ? 'fixed inset-y-0 left-0 z-50 flex' : 'hidden lg:flex'
        } flex-col bg-navy-900 text-slate-200 border-r border-slate-800 transition-all duration-200 shrink-0`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80">
          <Link to="/app/dashboard" className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
              <Layers className="h-4 w-4" />
            </div>
            {!collapsed && (
              <div className="truncate">
                <span className="font-bold tracking-tight text-white text-base">SUTRADHAR</span>
                <span className="block text-[10px] text-teal-400 font-medium uppercase tracking-wider">
                  Enterprise Operations OS
                </span>
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label="Toggle sidebar collapse"
            className="hidden lg:inline-flex rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        `flex items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                        }`
                      }
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </div>
                      {!collapsed && item.badge && (
                        <span className="rounded bg-teal-500/20 px-1.5 py-0.5 text-[10px] font-bold text-teal-300 border border-teal-500/30">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-navy-950/60">
          <div className="flex items-center justify-between gap-2">
            <Link to="/app/profile" className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-xs font-bold text-blue-300 shrink-0">
                {user.full_name.slice(0, 2).toUpperCase()}
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{user.full_name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{activeOrg?.role_name || 'Member'}</p>
                </div>
              )}
            </Link>
            {!collapsed && (
              <button
                type="button"
                onClick={() => logout().then(() => navigate('/login'))}
                title="Sign Out"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-950/60 hover:text-red-300"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-30 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen((m) => !m)}
              className="lg:hidden rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="h-5 w-5" />
            </button>
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs sm:text-sm truncate">
              <span className="text-slate-400 hidden sm:inline">Sutradhar</span>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                {currentBreadcrumb}
              </span>
            </nav>
          </div>

          {/* Global Module Quick-Jump Search */}
          <div className="relative flex-1 max-w-xs hidden md:block">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Jump to module (Inventory, PO, AI, GST)..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {filteredNavItems.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1 z-50">
                {filteredNavItems.map((item) => (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => {
                      navigate(item.to);
                      setSearchQuery('');
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-slate-800 flex items-center justify-between"
                  >
                    <span className="font-medium">{item.label}</span>
                    <span className="text-[10px] text-slate-400">{item.to}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Controls: Multi-Tenant Org Switcher, Notifications, Theme */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-slate-400 hidden sm:block" />
              <select
                aria-label="Switch active organisation workspace"
                value={activeOrg?.organization_id || ''}
                onChange={(e) => switchOrganization(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 max-w-48 truncate"
              >
                {organizations.map((org) => (
                  <option key={org.organization_id} value={org.organization_id}>
                    {org.organization_name} ({org.role_code})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setNewOrgModal(true)}
                title="Create New Organisation Workspace"
                className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <Badge variant="navy">{activeOrg?.role_code || 'OWNER'}</Badge>

            <Link
              to="/app/notifications"
              aria-label="Notifications"
              className="relative rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Bell className="h-4 w-4" />
              {unreadNotifs > 0 && (
                <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-red-600 text-[10px] font-bold text-white flex items-center justify-center">
                  {unreadNotifs}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={toggleDark}
              aria-label="Toggle dark mode"
              className="rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Page Outlet */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Create New Multi-Tenant Organisation Modal */}
      <Modal
        open={newOrgModal}
        onClose={() => setNewOrgModal(false)}
        title="Create New Multi-Tenant Organisation Workspace"
      >
        <form onSubmit={handleCreateOrg} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Organisation / Company Name *
            </label>
            <input
              type="text"
              required
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder="e.g. Sahyadri Auto Components Pvt. Ltd."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                GSTIN (Optional)
              </label>
              <input
                type="text"
                value={newOrgGstin}
                onChange={(e) => setNewOrgGstin(e.target.value)}
                placeholder="27AABCS1429B1Z1"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                City
              </label>
              <input
                type="text"
                value={newOrgCity}
                onChange={(e) => setNewOrgCity(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={newOrgSeed}
              onChange={(e) => setNewOrgSeed(e.target.checked)}
              className="rounded border-slate-300"
            />
            Populate with labelled sample Indian MSME operational data (uncheck for empty workspace)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setNewOrgModal(false)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingOrg}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creatingOrg ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

