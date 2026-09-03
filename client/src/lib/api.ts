import axios, { AxiosError, AxiosRequestConfig } from 'axios';

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

// ---- Single-flight refresh -------------------------------------------------
// Concurrent 401s await one shared promise, since parallel refresh calls would trip the server's token-theft detection and wipe the session.

let refreshPromise: Promise<string> | null = null;

async function performRefresh(): Promise<string> {
  // Use the bare axios module (not the `api` instance) so this call does NOT
  // re-enter our response interceptor — otherwise a 401 from the refresh
  // endpoint itself would recurse.
  const { data } = await axios.post(
    `${API_BASE}/auth/refresh-token`,
    {},
    { withCredentials: true }
  );
  const newAccessToken = data?.data?.accessToken;
  if (!newAccessToken || typeof newAccessToken !== 'string') {
    throw new Error('Refresh response missing accessToken');
  }
  localStorage.setItem('accessToken', newAccessToken);
  return newAccessToken;
}

/** Return the in-flight refresh promise or start one, so any number of concurrent callers share a single network call. */
function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = performRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

function handleAuthFailure() {
  localStorage.removeItem('accessToken');
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

// Response interceptor — handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (AxiosRequestConfig & { _retry?: boolean })
      | undefined;

    // Routes that must NOT trigger a refresh retry on 401 — either public
    // (no token to refresh) or the refresh endpoint itself (would loop).
    const noRetryAuthRoutes = [
      '/auth/login',
      '/auth/register',
      '/auth/refresh-token',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/verify-email',
      '/auth/verify-otp',
      '/auth/send-otp',
    ];
    const isNoRetryRoute = noRetryAuthRoutes.some((r) => originalRequest?.url?.includes(r));

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isNoRetryRoute
    ) {
      originalRequest._retry = true;

      try {
        const newAccessToken = await refreshAccessToken();
        originalRequest.headers = originalRequest.headers || {};
        (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Only a 401 or 403 from the refresh endpoint ends the session, since network errors and 5xx are usually a transient cold start.
        const refreshStatus = (refreshError as AxiosError)?.response?.status;
        if (refreshStatus === 401 || refreshStatus === 403) {
          handleAuthFailure();
        }
        return Promise.reject(error);
      }
    }

    // Normalize validation errors: if response has field-level errors,
    // replace generic "Validation failed" message with the first specific error
    if (error.response?.data) {
      const data = error.response.data as { errors?: Record<string, unknown>; message?: string };
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
