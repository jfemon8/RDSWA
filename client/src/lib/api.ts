import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Routes that should NOT trigger a refresh retry on 401 — either public
    // (no token to refresh) or the refresh endpoint itself (would loop).
    const noRetryAuthRoutes = ['/auth/login', '/auth/register', '/auth/refresh-token', '/auth/forgot-password', '/auth/reset-password', '/auth/verify-email', '/auth/verify-otp', '/auth/send-otp'];
    const isNoRetryRoute = noRetryAuthRoutes.some((r) => originalRequest.url?.includes(r));
    if (error.response?.status === 401 && !originalRequest._retry && !isNoRetryRoute) {
      originalRequest._retry = true;

      try {
        const { data } = await axios.post(`${API_BASE}/auth/refresh-token`, {}, { withCredentials: true });
        const newAccessToken = data.data.accessToken;
        localStorage.setItem('accessToken', newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch {
        localStorage.removeItem('accessToken');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }

    // Normalize validation errors: if response has field-level errors,
    // replace generic "Validation failed" message with the first specific error
    if (error.response?.data) {
      const data = error.response.data;
      if (data.errors && typeof data.errors === 'object' && data.message === 'Validation failed') {
        for (const messages of Object.values(data.errors)) {
          if (Array.isArray(messages) && messages.length > 0) {
            data.message = messages[0];
            break;
          }
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
