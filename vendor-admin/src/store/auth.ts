import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'customer' | 'vendor_owner' | 'vendor_manager' | 'attendant' | 'admin';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  role: UserRole | null;
  setSession: (s: {
    accessToken: string;
    refreshToken: string;
    userId: string;
    role: UserRole;
  }) => void;
  clear: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      userId: null,
      role: null,
      setSession: ({ accessToken, refreshToken, userId, role }) =>
        set({ accessToken, refreshToken, userId, role }),
      clear: () => set({ accessToken: null, refreshToken: null, userId: null, role: null }),
    }),
    { name: 'fmb-vendor-auth' },
  ),
);
