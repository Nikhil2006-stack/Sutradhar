import React from 'react';
import { AlertTriangle, CheckCircle2, Info, RefreshCw, Inbox, X } from 'lucide-react';

export const Badge: React.FC<{
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'navy';
  children: React.ReactNode;
}> = ({ variant = 'default', children }) => {
  const styles: Record<string, string> = {
    default: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
    warning: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
    danger: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800/60',
    info: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
    navy: 'bg-slate-900 text-white dark:bg-blue-600 dark:text-white border-slate-900',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${styles[variant] || styles.default}`}>
      {children}
    </span>
  );
};

export function statusBadgeVariant(status?: string): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  const s = (status || '').toUpperCase();
  if (['APPROVED', 'VERIFIED', 'RECEIVED', 'PAID', 'MATCHED', 'LOW', 'OPTIMAL', 'SUCCESS', 'COMPLETED', 'APPROVED_AND_EXECUTED', 'ACTIVE'].includes(s)) {
    return 'success';
  }
  if (['PENDING', 'PENDING_APPROVAL', 'PENDING_VERIFICATION', 'PARTIALLY_PAID', 'PARTIALLY_RECEIVED', 'MEDIUM', 'ISSUED', 'EVALUATING', 'SUBMITTED', 'IN_PROGRESS', 'EXTRACTED', 'WARNING'].includes(s)) {
    return 'warning';
  }
  if (['CRITICAL', 'HIGH', 'OVERDUE', 'REJECTED', 'DISPUTED', 'MISMATCH', 'DUPLICATE', 'FAILED', 'LOW_STOCK', 'STOCKOUT_RISK'].includes(s)) {
    return 'danger';
  }
  return 'info';
}

export const PageHeader: React.FC<{
  title: string;
  subtitle: string;
  badge?: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, badge, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
    <div>
      <div className="flex items-center gap-2.5">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h1>
        {badge && <Badge variant="info">{badge}</Badge>}
      </div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
  </div>
);

export const SkeletonBlock: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="space-y-3 py-4" aria-label="Loading content">
    {Array.from({ length: rows }).map((_, idx) => (
      <div
        key={idx}
        className="h-12 w-full rounded-lg bg-slate-200/70 dark:bg-slate-800/70 animate-pulse"
      />
    ))}
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, description, actionLabel, onAction }) => (
  <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-10 text-center">
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
      <Inbox className="h-6 w-6" />
    </div>
    <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
    <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
      {description}
    </p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export const ErrorState: React.FC<{
  message?: string;
  onRetry?: () => void;
}> = ({ message = 'Unable to load operational records.', onRetry }) => (
  <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/30 p-6 text-center">
    <AlertTriangle className="h-7 w-7 text-red-600 mx-auto" />
    <p className="mt-2 text-sm font-medium text-red-800 dark:text-red-300">{message}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </button>
    )}
  </div>
);

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export const ToastContainer: React.FC<{
  toasts: Array<{ id: string; type: 'success' | 'error' | 'info' | 'warning'; title: string; description?: string }>;
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-xl"
        >
          {t.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />}
          {t.type === 'error' && <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />}
          {(t.type === 'info' || t.type === 'warning') && <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.title}</p>
            {t.description && (
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{t.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

