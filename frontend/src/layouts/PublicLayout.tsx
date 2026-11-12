import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Layers, Moon, Sun, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ToastContainer } from '../components/ui/Common';

export const PublicLayout: React.FC = () => {
  const { user, isDark, toggleDark, toasts, dismissToast } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-slate-900 dark:bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Layers className="h-5 w-5 text-teal-400 dark:text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                SUTRADHAR
              </span>
              <span className="hidden sm:inline-block ml-2 rounded bg-blue-50 dark:bg-blue-950/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                Decision OS
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'hover:text-slate-900 dark:hover:text-white'
              }
            >
              Overview
            </NavLink>
            <NavLink
              to="/features"
              className={({ isActive }) =>
                isActive ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'hover:text-slate-900 dark:hover:text-white'
              }
            >
              Platform Features
            </NavLink>
            <NavLink
              to="/pricing"
              className={({ isActive }) =>
                isActive ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'hover:text-slate-900 dark:hover:text-white'
              }
            >
              Plans & Pricing
            </NavLink>
            <NavLink
              to="/about"
              className={({ isActive }) =>
                isActive ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'hover:text-slate-900 dark:hover:text-white'
              }
            >
              Architecture & About
            </NavLink>
            <NavLink
              to="/contact"
              className={({ isActive }) =>
                isActive ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'hover:text-slate-900 dark:hover:text-white'
              }
            >
              Contact
            </NavLink>
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleDark}
              aria-label="Toggle color theme"
              className="rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {user ? (
              <Link
                to="/app/dashboard"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
              >
                Open Workspace <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 px-3 py-2"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:hover:bg-blue-700 transition"
                >
                  Start Free Workspace
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-teal-600" />
            <span>
              <strong>SUTRADHAR</strong> — AI-Powered Business Operations, Intelligence & Decision Automation Platform for Indian MSMEs.
            </span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/features" className="hover:underline">Features</Link>
            <Link to="/pricing" className="hover:underline">Pricing</Link>
            <Link to="/about" className="hover:underline">Architecture</Link>
            <Link to="/contact" className="hover:underline">Contact</Link>
          </div>
        </div>
      </footer>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

