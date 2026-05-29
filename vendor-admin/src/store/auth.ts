import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'customer' | 'vendor_owner' | 'vendor_manager' | 'attendant' | 'admin';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  role: UserRole | null;
  mustChangePassword: boolean;
  setSession: (s: {
    accessToken: string;
    refreshToken: string;
    userId: string;
    role: UserRole;
    mustChangePassword?: boolean;
  }) => void;
  clearMustChange: () => void;
  clear: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      userId: null,
      role: null,
      mustChangePassword: false,
      setSession: ({ accessToken, refreshToken, userId, role, mustChangePassword }) =>
        set({ accessToken, refreshToken, userId, role, mustChangePassword: mustChangePassword ?? false }),
      clearMustChange: () => set({ mustChangePassword: false }),
      clear: () =>
        set({ accessToken: null, refreshToken: null, userId: null, role: null, mustChangePassword: false }),
    }),
    { name: 'fmb-vendor-auth' },
  ),
);
