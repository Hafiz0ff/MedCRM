import { create } from 'zustand';

export interface Clinic {
  tenantId: string;
  tenantCode: string;
  clinicName: string;
  patientId: string;
}

interface AuthState {
  isAuthenticated: boolean;
  clinics: Clinic[];
  activeClinic: Clinic | null;
  theme: 'light' | 'dark';
  setAuthenticated: (val: boolean) => void;
  setClinics: (clinics: Clinic[]) => void;
  setActiveClinic: (clinic: Clinic) => void;
  toggleTheme: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: typeof window !== 'undefined' && !!localStorage.getItem('portal_token'),
  clinics: [],
  activeClinic: null,
  theme:
    typeof window !== 'undefined'
      ? (localStorage.getItem('portal_theme') as 'light' | 'dark') || 'light'
      : 'light',
  setAuthenticated: (val) => set({ isAuthenticated: val }),
  setClinics: (clinics) => set({ clinics, activeClinic: clinics[0] ?? null }),
  setActiveClinic: (clinic) => set({ activeClinic: clinic }),
  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('portal_theme', next);
    set({ theme: next });
  },
  logout: () => {
    localStorage.removeItem('portal_token');
    document.cookie = 'portal_token=; path=/; max-age=0';
    set({ isAuthenticated: false, clinics: [], activeClinic: null });
  },
}));
