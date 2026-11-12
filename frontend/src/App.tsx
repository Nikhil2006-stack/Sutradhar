import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PublicLayout } from './layouts/PublicLayout';
import { AppLayout } from './layouts/AppLayout';
import {
  LandingPage,
  FeaturesPage,
  AboutPage,
  PricingPage,
  ContactPage,
  LoginPage,
  RegisterPage,
} from './pages/PublicPages';
import {
  MainDashboardPage,
  RecommendationsCentrePage,
  AIAssistantPage,
} from './pages/DashboardAndAI';
import {
  InventoryDashboardPage,
  ProductCataloguePage,
  WarehouseManagementPage,
  StockMovementsPage,
  InventoryAlertsForecastPage,
} from './pages/InventoryPages';
import {
  SupplierDirectoryPage,
  SupplierProfilePage,
  SupplierAnalyticsPage,
  PurchaseRequestsPage,
  PurchaseOrdersPage,
  ApprovalsCentrePage,
  RFQManagementPage,
  QuotationComparisonPage,
  GoodsReceivingPage,
} from './pages/SupplierProcurementPages';
import {
  DocumentCentrePage,
  InvoiceVerificationPage,
  AccountsPayablePage,
  AccountsReceivablePage,
  CashflowAnalyticsPage,
  WorkflowAutomationPage,
  TaskManagementPage,
  NotificationsPage,
  AuditLogsPage,
  ReportsAndExportsPage,
  TeamManagementPage,
  OrganizationSettingsPage,
  UserProfilePage,
} from './pages/DocumentsFinanceGovernancePages';

export const App: React.FC = () => {
  return (
    <Routes>
      {/* 7 Public Website Pages */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* 30 Authenticated Enterprise SaaS Pages */}
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<MainDashboardPage />} />
        <Route path="recommendations" element={<RecommendationsCentrePage />} />
        <Route path="ai-assistant" element={<AIAssistantPage />} />

        <Route path="inventory" element={<InventoryDashboardPage />} />
        <Route path="products" element={<ProductCataloguePage />} />
        <Route path="warehouses" element={<WarehouseManagementPage />} />
        <Route path="stock-movements" element={<StockMovementsPage />} />
        <Route path="inventory-alerts" element={<InventoryAlertsForecastPage />} />

        <Route path="suppliers" element={<SupplierDirectoryPage />} />
        <Route path="suppliers/:id" element={<SupplierProfilePage />} />
        <Route path="supplier-analytics" element={<SupplierAnalyticsPage />} />
        <Route path="purchase-requests" element={<PurchaseRequestsPage />} />
        <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="approvals" element={<ApprovalsCentrePage />} />
        <Route path="rfqs" element={<RFQManagementPage />} />
        <Route path="quotations" element={<QuotationComparisonPage />} />
        <Route path="goods-receiving" element={<GoodsReceivingPage />} />

        <Route path="documents" element={<DocumentCentrePage />} />
        <Route path="invoice-verification" element={<InvoiceVerificationPage />} />
        <Route path="payables" element={<AccountsPayablePage />} />
        <Route path="receivables" element={<AccountsReceivablePage />} />
        <Route path="cashflow" element={<CashflowAnalyticsPage />} />

        <Route path="workflows" element={<WorkflowAutomationPage />} />
        <Route path="tasks" element={<TaskManagementPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
        <Route path="reports" element={<ReportsAndExportsPage />} />
        <Route path="team" element={<TeamManagementPage />} />
        <Route path="settings" element={<OrganizationSettingsPage />} />
        <Route path="profile" element={<UserProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;

