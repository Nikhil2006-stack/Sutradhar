import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Bot,
  Boxes,
  CheckCircle2,
  FileCheck2,
  GitBranch,
  Layers,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Badge } from '../components/ui/Common';
import { extractApiError } from '../services/api';

export const LandingPage: React.FC = () => {
  return (
    <div className="space-y-20 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-navy-900 text-white py-20 sm:py-28 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3.5 py-1 text-xs font-semibold text-teal-300">
              <Sparkles className="h-3.5 w-3.5" /> Built for Indian MSMEs, Manufacturers & Wholesale Distributors
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
              One intelligent workspace to manage, understand and improve your entire business operation.
            </h1>
            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
              Replace disconnected Excel sheets, WhatsApp threads, and manual invoice entry with{' '}
              <strong className="text-white">Sutradhar</strong> — uniting multi-warehouse inventory, supplier SLAs,
              procurement approvals, OCR document extraction, GST-ready payables, and an explainable AI Action Engine.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-blue-500 shadow-lg transition"
              >
                Launch Live Interactive Demo <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-6 py-3.5 text-sm font-semibold text-slate-100 hover:bg-slate-800 transition"
              >
                Register Your Organisation
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-800/80 text-xs text-slate-300">
              <div>
                <p className="text-xl font-bold text-white">10 Scenarios</p>
                <p>Live AI Risk & Action Engine</p>
              </div>
              <div>
                <p className="text-xl font-bold text-teal-400">3-Way Match</p>
                <p>PO, GRN & Invoice Verification</p>
              </div>
              <div>
                <p className="text-xl font-bold text-white">100% Human-in-Loop</p>
                <p>Audited RBAC & Tenant Isolation</p>
              </div>
            </div>
          </div>

          {/* Interactive Signature Feature Preview Card */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/95 p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Signature Action Engine Alert
                  </span>
                </div>
                <span className="rounded bg-red-500/20 px-2 py-0.5 text-[11px] font-bold text-red-300 border border-red-500/30">
                  CRITICAL STOCKOUT RISK
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Product A — SS316 High-Pressure Ball Valve (50mm)
                </h3>
                <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                  <strong>12 PCS</strong> remaining in Chakan Hub. Daily consumption averages{' '}
                  <strong>10 PCS/day</strong> (1.2 days of supply left), while supplier{' '}
                  <em>Shree Ganesh Steels</em> has an <strong>8-day lead time</strong>.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-950/90 p-3 border border-slate-800 text-center">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Current Stock</p>
                  <p className="text-sm font-bold text-red-400">12 PCS</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Daily Demand</p>
                  <p className="text-sm font-bold text-white">10 PCS/day</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Lead Time</p>
                  <p className="text-sm font-bold text-amber-300">8 Days</p>
                </div>
              </div>
              <div className="rounded-xl bg-blue-950/40 border border-blue-800/50 p-3 text-xs text-blue-200">
                <strong>Recommended Action (Confidence 94.5%):</strong> Generate Emergency Purchase Request for{' '}
                <strong>168 PCS</strong> (₹4,11,600) — requires Human Approval.
              </div>
              <Link
                to="/login"
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-teal-400 transition"
              >
                Review & Approve in Live Workspace <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 12 Real-World Operational Problems Solved */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <Badge variant="info">Enterprise Operational Continuity</Badge>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Engineered for Real Indian Manufacturing & Distribution Workflows
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Every module in Sutradhar is interconnected—from RFQ quotation comparison to GRN batch receiving,
            OCR invoice verification, and automated MSME payment reminders.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: Boxes,
              title: 'Inventory & Reorder Intelligence',
              desc: 'Multi-warehouse ledger, batch/expiry tracking, reorder-point mathematics, and Holt trend demand forecasting.',
            },
            {
              icon: FileCheck2,
              title: 'AI Document OCR & 3-Way Match',
              desc: 'Extract GSTIN, HSN line items, and totals from PDF invoices; detect duplicates and PO mismatches before human sign-off.',
            },
            {
              icon: Users,
              title: 'Supplier Reliability & RFQ Compare',
              desc: 'Track on-time delivery %, average delay days, defect rates, and price volatility across every vendor.',
            },
            {
              icon: Bot,
              title: 'Explainable RAG & Action Engine',
              desc: 'Query your business records in plain English with document citations and execute 1-click human-approved actions.',
            },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-3"
              >
                <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{f.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export const FeaturesPage: React.FC = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
    <div className="max-w-3xl space-y-3">
      <Badge variant="info">8 Interconnected Core Modules</Badge>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
        Complete Platform Capabilities
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Sutradhar connects 68 operational capabilities across inventory, procurement, suppliers, AI document extraction,
        finance, and workflow automation.
      </p>
    </div>

    <div className="grid md:grid-cols-2 gap-6">
      {[
        {
          title: 'A. Multi-Tenant Organisation & RBAC',
          items: [
            '6 Indian MSME roles (Owner, Operations Mgr, Finance Mgr, Procurement Officer, Warehouse Employee, Auditor)',
            'Multi-company workspace switching with strict backend database isolation',
            'Granular permission enforcement & immutable security audit logs',
          ],
        },
        {
          title: 'B. AI Document Intelligence',
          items: [
            'PDF & scanned image upload with PyMuPDF + Tesseract OCR pipeline',
            'Automatic Indian GSTIN, invoice number, PO reference, and tax extraction',
            'SHA-256 & semantic duplicate invoice detection + mandatory human verification',
          ],
        },
        {
          title: 'C. Multi-Warehouse Inventory & Forecasting',
          items: [
            'SKU & barcode catalogue with HSN codes and configurable GST slabs',
            'Atomic stock movement ledger (IN, OUT, GRN, ADJUSTMENT) with batch & expiry tracking',
            'Reorder Point = Avg Daily Demand × Lead Time + Safety Stock & 14-day forecasting',
          ],
        },
        {
          title: 'D. Supplier & Procurement Lifecycle',
          items: [
            'Supplier reliability scorecard (On-time %, delay days, defect %, price volatility)',
            'Purchase Requests -> Multi-level Approvals -> RFQs -> Quotation Comparison -> PO -> GRN',
            'Automated 3-way matching between Purchase Order, GRN, and Supplier Invoice',
          ],
        },
      ].map((mod) => (
        <div
          key={mod.title}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3"
        >
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{mod.title}</h3>
          <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
            {mod.items.map((it) => (
              <li key={it} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  </div>
);

export const PricingPage: React.FC = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
    <div className="text-center max-w-2xl mx-auto space-y-2">
      <Badge variant="info">Transparent INR Plans (Illustrative)</Badge>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
        Built for Growing Indian MSMEs & Enterprises
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        All plans include INR currency formatting, GST tax configuration, and human-approved AI safety guardrails.
      </p>
    </div>

    <div className="grid md:grid-cols-3 gap-6">
      {[
        {
          name: 'MSME Starter',
          price: '₹4,999 / month',
          subtitle: 'For single-plant manufacturers & wholesale traders',
          features: ['Up to 2 Warehouses & 10 Users', 'Inventory & Purchase Order Management', '100 AI Document Extractions / mo', 'Standard Reorder Alerts'],
          highlight: false,
        },
        {
          name: 'Growth Operations (Popular)',
          price: '₹12,999 / month',
          subtitle: 'For multi-warehouse distributors & mid-sized factories',
          features: ['Unlimited Warehouses & 35 Users', 'Full 10-Scenario AI Action Engine', '3-Way PO-GRN-Invoice Matching', 'RAG Business Assistant & Workflow Rules'],
          highlight: true,
        },
        {
          name: 'Enterprise Multi-Company',
          price: '₹29,999 / month',
          subtitle: 'For industrial groups with multiple GSTIN entities',
          features: ['Unlimited Multi-Company Workspaces', 'Custom RBAC & Auditor Portal', 'Dedicated S3 Storage & API Keys', 'Priority SLA & Custom ERP Webhooks'],
          highlight: false,
        },
      ].map((plan) => (
        <div
          key={plan.name}
          className={`rounded-2xl border p-6 flex flex-col justify-between ${
            plan.highlight
              ? 'border-blue-600 bg-slate-900 text-white shadow-xl'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
          }`}
        >
          <div className="space-y-4">
            <h3 className="text-lg font-bold">{plan.name}</h3>
            <p className="text-2xl font-extrabold">{plan.price}</p>
            <p className={`text-xs ${plan.highlight ? 'text-slate-300' : 'text-slate-500'}`}>
              {plan.subtitle}
            </p>
            <ul className="space-y-2.5 pt-4 border-t border-slate-200/20 text-xs">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-teal-400 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
          <Link
            to="/register"
            className={`mt-8 block text-center rounded-xl py-2.5 text-xs font-bold transition ${
              plan.highlight
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800'
            }`}
          >
            Start Free Trial Workspace
          </Link>
        </div>
      ))}
    </div>
  </div>
);

export const AboutPage: React.FC = () => (
  <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
    <Badge variant="info">Architecture & Engineering Philosophy</Badge>
    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
      About Sutradhar — Decision Intelligence Platform
    </h1>
    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
      In Indian classical theatre, the <strong>Sutradhar</strong> is the master coordinator who connects every actor,
      scene, and cue into a coherent performance. Our platform brings that same orchestration to Indian MSMEs—connecting
      inventory ledgers, supplier reliability data, procurement approvals, PDF documents, and financial obligations.
    </p>
    <div className="grid sm:grid-cols-3 gap-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <ShieldCheck className="h-6 w-6 text-blue-600 mb-2" />
        <h3 className="text-sm font-bold">Human-in-the-Loop Safety</h3>
        <p className="mt-1 text-xs text-slate-500">
          AI never autonomously mutates stock balances, approves payments, or issues POs without human authorization.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <TrendingUp className="h-6 w-6 text-teal-600 mb-2" />
        <h3 className="text-sm font-bold">Transparent Mathematics</h3>
        <p className="mt-1 text-xs text-slate-500">
          Every reorder point, forecast error (MAE/MAPE), and supplier reliability score is computed from verifiable database records.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <GitBranch className="h-6 w-6 text-amber-600 mb-2" />
        <h3 className="text-sm font-bold">Production-Grade Stack</h3>
        <p className="mt-1 text-xs text-slate-500">
          React 18 + TypeScript, FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL + pgvector, Redis, Celery, and Docker.
        </p>
      </div>
    </div>
  </div>
);

export const ContactPage: React.FC = () => {
  const { notify } = useAuth();
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
    notify('Enquiry Submitted', 'Our solutions engineering team will reach out within 4 business hours.', 'success');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid md:grid-cols-2 gap-10">
      <div className="space-y-4">
        <Badge variant="info">Enterprise Onboarding & Support</Badge>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contact the Sutradhar Team</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Schedule a guided walkthrough for your manufacturing plant or wholesale distribution network.
        </p>
        <div className="space-y-3 pt-4 text-xs text-slate-600 dark:text-slate-300">
          <p className="flex items-center gap-2.5"><MapPin className="h-4 w-4 text-blue-600" /> Baner-Pashan Link Road, Pune, Maharashtra 411045</p>
          <p className="flex items-center gap-2.5"><Phone className="h-4 w-4 text-blue-600" /> +91 20 6721 4400 (Mon–Sat, 9:00 AM – 7:00 PM IST)</p>
          <p className="flex items-center gap-2.5"><Mail className="h-4 w-4 text-blue-600" /> enterprise@sutradhar.ai</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-xs"
      >
        <div>
          <label className="block text-xs font-semibold mb-1">Full Name *</label>
          <input required type="text" placeholder="Rajesh Kulkarni" className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Work Email *</label>
          <input required type="email" placeholder="rajesh@company.in" className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Operational Requirement *</label>
          <textarea required rows={3} placeholder="Tell us about your warehouses, SKU count, and procurement workflow..." className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700">
          {sent ? 'Enquiry Received ✓' : 'Send Enquiry'}
        </button>
      </form>
    </div>
  );
};

export const LoginPage: React.FC = () => {
  const { loginWithCredentials, notify } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('arjun.mehta@sutradhar.ai');
  const [password, setPassword] = useState('Sutradhar@123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginWithCredentials(email, password);
      navigate('/app/dashboard');
    } catch (err: any) {
      const msg = extractApiError(err, 'Invalid email or password.');
      setError(msg);
      notify('Authentication Failed', msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const quickFill = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Sutradhar@123');
    setError('');
    setLoading(true);
    try {
      await loginWithCredentials(demoEmail, 'Sutradhar@123');
      navigate('/app/dashboard');
    } catch (err: any) {
      const msg = extractApiError(err, 'Demo login failed.');
      setError(msg);
      notify('Authentication Failed', msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-lg space-y-6">
        <div className="space-y-1.5 text-center">
          <div className="h-10 w-10 rounded-xl bg-slate-900 dark:bg-blue-600 text-white flex items-center justify-center mx-auto">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Sign in to Sutradhar</h1>
          <p className="text-xs text-slate-500">Access your multi-tenant business operations workspace</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 p-3 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Work Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Signing In...' : 'Sign In to Workspace'}
          </button>
        </form>

        {/* One-Click RBAC Role Demo Selector */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Quick Demo Role Accounts (Password: Sutradhar@123)
          </p>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            {[
              { label: 'Owner / Super Admin', email: 'arjun.mehta@sutradhar.ai' },
              { label: 'Operations Manager', email: 'priya.sharma@sutradhar.demo' },
              { label: 'Finance Manager', email: 'amit.verma@sutradhar.demo' },
              { label: 'Procurement Officer', email: 'vikram.joshi@sutradhar.demo' },
              { label: 'Warehouse Employee', email: 'ramesh.patil@sutradhar.demo' },
              { label: 'Auditor (Read-Only)', email: 'meera.iyer@sutradhar.demo' },
            ].map((r) => (
              <button
                key={r.email}
                type="button"
                onClick={() => quickFill(r.email)}
                className="rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 truncate"
              >
                <span className="font-semibold block text-slate-800 dark:text-slate-200">{r.label}</span>
                <span className="text-[10px] text-slate-400 truncate block">{r.email}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-slate-500">
          New to Sutradhar?{' '}
          <Link to="/register" className="font-semibold text-blue-600 hover:underline">
            Create an Organisation Workspace
          </Link>
        </p>
      </div>
    </div>
  );
};

export const RegisterPage: React.FC = () => {
  const { registerAccount, notify } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [gstin, setGstin] = useState('');
  const [city, setCity] = useState('Pune');
  const [seedDemo, setSeedDemo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    setLoading(true);
    try {
      await registerAccount({
        full_name: fullName,
        email,
        password,
        organization_name: orgName,
        gstin: gstin || undefined,
        city,
        state: 'Maharashtra',
        seed_demo_data: seedDemo,
      });
      navigate('/app/dashboard');
    } catch (err: any) {
      const msg = extractApiError(err, 'Registration failed.');
      setError(msg);
      notify('Registration Error', msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-lg space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Register Organisation Workspace
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Set up your multi-tenant Indian MSME workspace with RBAC permissions
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Your Full Name *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Vikramaditya Deshmukh"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Work Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vikram@company.in"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Organisation / Company Legal Name *</label>
            <input
              type="text"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Sahyadri Precision Forgings Pvt. Ltd."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">GSTIN (Optional)</label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                placeholder="27AABCS1429B1Z1"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Primary Hub City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Password (min 8 chars) *</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-start gap-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <input
              type="checkbox"
              checked={seedDemo}
              onChange={(e) => setSeedDemo(e.target.checked)}
              className="mt-0.5 rounded"
            />
            <span>
              <strong>Include Labelled Demonstration Dataset:</strong> Pre-populate sample Indian MSME products,
              warehouses, suppliers, and AI recommendations (uncheck to start with a clean empty workspace).
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Provisioning Workspace...' : 'Create Organisation & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
};

