// Axios instance with auth header injection.
// In dev: hits Vite's /api proxy which forwards to http://localhost:3000.
// In prod: VITE_API_BASE_URL points straight at the deployed backend FQDN.

import axios from 'axios';
import { useAuth } from '../store/auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE,
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
