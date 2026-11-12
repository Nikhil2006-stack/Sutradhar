export interface OrganizationMembership {
  membership_id?: string;
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  industry: string;
  gstin?: string;
  city?: string;
  state?: string;
  currency: string;
  role_code: string;
  role_name: string;
  department?: string;
  is_default?: boolean;
  permissions: string[];
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  job_title?: string;
  last_login_at?: string;
}

export interface AIRecommendationItem {
  id: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  product_id?: string;
  supplier_id?: string;
  product_name?: string;
  supplier_name?: string;
  current_stock?: number;
  avg_daily_demand?: number;
  lead_time_days?: number;
  expected_stockout_date?: string;
  suggested_reorder_qty?: number;
  reasoning: string;
  supporting_evidence: Array<{ metric: string; value: string; source: string }>;
  confidence_score: number;
  uncertainty_notes?: string;
  recommended_action: string;
  action_type: string;
  status: 'OPEN' | 'APPROVED_AND_EXECUTED' | 'DISMISSED';
  execution_result?: string;
  feedback_helpful?: boolean;
  feedback_notes?: string;
  approved_at?: string;
  created_at?: string;
}

export function formatINR(amount: number | undefined | null): string {
  const num = Number(amount ?? 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatIndianDate(isoDate: string | undefined | null): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

