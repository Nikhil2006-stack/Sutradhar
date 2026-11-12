import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiClient } from '../services/api';
import { OrganizationMembership, UserProfile } from '../types';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
}

interface AuthContextValue {
  user: UserProfile | null;
  activeOrg: OrganizationMembership | null;
  organizations: OrganizationMembership[];
  isLoading: boolean;
  isDark: boolean;
  toggleDark: () => void;
  loginWithCredentials: (email: string, password: string) => Promise<void>;
  registerAccount: (payload: Record<string, unknown>) => Promise<void>;
  switchOrganization: (orgId: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (perm: string) => boolean;
  toasts: ToastMessage[];
  notify: (title: string, description?: string, type?: ToastMessage['type']) => void;
  dismissToast: (id: string) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeOrg, setActiveOrg] = useState<OrganizationMembership | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('sutradhar_theme') === 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('sutradhar_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('sutradhar_theme', 'light');
    }
  }, [isDark]);

  const toggleDark = () => setIsDark((prev) => !prev);

  const notify = useCallback(
    (title: string, description?: string, type: ToastMessage['type'] = 'success') => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, title, description, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem('sutradhar_access_token');
    if (!token) {
      setUser(null);
      setActiveOrg(null);
      setOrganizations([]);
      setIsLoading(false);
      return;
    }
    try {
      const resp = await apiClient.get('/auth/me');
      setUser(resp.data.user);
      setActiveOrg(resp.data.active_organization);
      setOrganizations(resp.data.organizations || []);
      if (resp.data.active_organization?.organization_id) {
        localStorage.setItem('sutradhar_active_org_id', resp.data.active_organization.organization_id);
      }
    } catch {
      localStorage.removeItem('sutradhar_access_token');
      localStorage.removeItem('sutradhar_refresh_token');
      setUser(null);
      setActiveOrg(null);
      setOrganizations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const loginWithCredentials = async (email: string, password: string) => {
    const resp = await apiClient.post('/auth/login', { email, password });
    const { access_token, refresh_token, user: u, active_organization, organizations: orgs } = resp.data;
    localStorage.setItem('sutradhar_access_token', access_token);
    localStorage.setItem('sutradhar_refresh_token', refresh_token);
    if (active_organization?.organization_id) {
      localStorage.setItem('sutradhar_active_org_id', active_organization.organization_id);
    }
    setUser(u);
    setActiveOrg(active_organization);
    setOrganizations(orgs || []);
    notify('Welcome back to Sutradhar', `Signed in to ${active_organization?.organization_name}`, 'success');
  };

  const registerAccount = async (payload: Record<string, unknown>) => {
    const resp = await apiClient.post('/auth/register', payload);
    const { access_token, refresh_token, user: u, active_organization, organizations: orgs } = resp.data;
    localStorage.setItem('sutradhar_access_token', access_token);
    localStorage.setItem('sutradhar_refresh_token', refresh_token);
    if (active_organization?.organization_id) {
      localStorage.setItem('sutradhar_active_org_id', active_organization.organization_id);
    }
    setUser(u);
    setActiveOrg(active_organization);
    setOrganizations(orgs || []);
    notify('Workspace Created', `Initialised ${active_organization?.organization_name}`, 'success');
  };

  const switchOrganization = async (orgId: string) => {
    localStorage.setItem('sutradhar_active_org_id', orgId);
    await refreshProfile();
    const matched = organizations.find((o) => o.organization_id === orgId);
    notify('Switched Workspace', matched ? `Active workspace: ${matched.organization_name}` : 'Updated workspace', 'info');
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('sutradhar_refresh_token');
    try {
      if (refreshToken) {
        await apiClient.post('/auth/logout', { refresh_token: refreshToken });
      }
    } catch {
      // ignore
    }
    localStorage.removeItem('sutradhar_access_token');
    localStorage.removeItem('sutradhar_refresh_token');
    localStorage.removeItem('sutradhar_active_org_id');
    setUser(null);
    setActiveOrg(null);
    setOrganizations([]);
    notify('Signed Out', 'Your session has been securely closed.', 'info');
  };

  const hasPermission = (perm: string): boolean => {
    if (!activeOrg) return false;
    return activeOrg.permissions?.includes(perm) || activeOrg.role_code === 'OWNER';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeOrg,
        organizations,
        isLoading,
        isDark,
        toggleDark,
        loginWithCredentials,
        registerAccount,
        switchOrganization,
        refreshProfile,
        logout,
        hasPermission,
        toasts,
        notify,
        dismissToast,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}

