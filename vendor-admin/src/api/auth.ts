import { api } from './client';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    fullName: string | null;
    role: string;
    emailVerifiedAt: string | null;
  };
}

export interface CurrentUser {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  role: string;
  emailVerifiedAt: string | null;
}

export const getCurrentUser = async (): Promise<CurrentUser> => {
  const { data } = await api.get('/auth/me');
  return data;
};

export const login = async (email: string, password: string): Promise<AuthSession> => {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
};

export const register = async (input: {
  email: string;
  password: string;
  fullName?: string;
}): Promise<AuthSession> => {
  const { data } = await api.post('/auth/register', input);
  return data;
};

// ── Password reset ──────────────────────────────────────────────────────

export const requestPasswordReset = async (email: string): Promise<void> => {
  await api.post('/auth/password/forgot', { email });
};

export const completePasswordReset = async (input: {
  token: string;
  newPassword: string;
}): Promise<AuthSession> => {
  const { data } = await api.post('/auth/password/reset', input);
  return data;
};

// ── Email verification ──────────────────────────────────────────────────

export const sendEmailVerification = async (): Promise<void> => {
  await api.post('/auth/email/verify/send');
};

export const verifyEmail = async (token: string): Promise<{ ok: true; email: string }> => {
  const { data } = await api.post('/auth/email/verify', { token });
  return data;
};
