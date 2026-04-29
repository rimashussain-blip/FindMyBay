// Axios instance with auth header injection. Talks to the dev proxy at /api
// (Vite forwards to http://localhost:3000) so we don't have to deal with CORS.

import axios from 'axios';
import { useAuth } from '../store/auth';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

api.interceptors.request.use((config) => {
  const token = useAuth.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    // 401 → clear session and let the caller redirect to /login.
    if (err.response?.status === 401) {
      useAuth.getState().clear();
    }
    return Promise.reject(err);
  },
);
