import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

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
    if (error.response?.status === 401 && !originalRequest?._retry) {
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

