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
  };
}

export interface CurrentUser {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  role: string;
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
