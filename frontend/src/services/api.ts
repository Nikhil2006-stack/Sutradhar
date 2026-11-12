import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export function extractApiError(err: any, fallback = 'Operation failed. Please try again.'): string {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim().length > 0) {
    return detail;
  }
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item: any) => {
        const field = Array.isArray(item?.loc) ? item.loc[item.loc.length - 1] : '';
        return field ? `${field}: ${item.msg}` : item?.msg || JSON.stringify(item);
      })
      .join('; ');
  }
  if (!err?.response || err?.response?.status >= 500) {
    return 'Unable to reach the Sutradhar API server on port 8000. Ensure the backend service is running.';
  }
  return fallback;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('sutradhar_access_token');
  const orgId = localStorage.getItem('sutradhar_active_org_id');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (orgId) {
    config.headers['X-Organization-Id'] = orgId;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Auto-retry up to 3 times if backend is warming up (proxy 500/502/503/504 without JSON detail or network error)
    const isTransientProxyOrNetworkError =
      !error.response ||
      ([500, 502, 503, 504].includes(error.response.status) && !error.response?.data?.detail);

    if (originalRequest && isTransientProxyOrNetworkError) {
      originalRequest._warmupRetryCount = (originalRequest._warmupRetryCount || 0) + 1;
      if (originalRequest._warmupRetryCount <= 3) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        return apiClient(originalRequest);
      }
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('sutradhar_refresh_token');
      if (refreshToken) {
        try {
          const resp = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          const { access_token, refresh_token } = resp.data;
          localStorage.setItem('sutradhar_access_token', access_token);
          localStorage.setItem('sutradhar_refresh_token', refresh_token);
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return apiClient(originalRequest);
        } catch {
          localStorage.removeItem('sutradhar_access_token');
          localStorage.removeItem('sutradhar_refresh_token');
        }
      }
    }
    return Promise.reject(error);
  }
);
