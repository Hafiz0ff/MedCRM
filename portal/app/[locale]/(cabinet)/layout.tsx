'use client';

import {
  LayoutDashboard,
  CalendarPlus,
  ClockArrowUp,
  UserRound,
  LogOut,
  ChevronDown,
  Building2,
  Menu,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ReactNode, useEffect, useState, use } from 'react';
import { PortalApi } from '@/lib/api';
import { useAuthStore, Clinic } from '@/lib/store';

interface CabinetLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

const navItems = [
  { key: 'dashboard', href: '/cabinet', icon: LayoutDashboard },
  { key: 'booking', href: '/cabinet/booking', icon: CalendarPlus },
  { key: 'history', href: '/cabinet/history', icon: ClockArrowUp },
  { key: 'profile', href: '/cabinet/profile', icon: UserRound },
] as const;

export default function CabinetLayout({ children, params }: CabinetLayoutProps) {
  const { locale } = use(params);
  const t = useTranslations('cabinet.nav');
  const router = useRouter();

  const {
    isAuthenticated,
    clinics,
    activeClinic,
    setClinics,
    setActiveClinic,
    setAuthenticated,
    logout,
  } = useAuthStore();

  const [clinicDropdownOpen, setClinicDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState('');

  // Detect current path for active nav highlighting
  useEffect(() => {
    setCurrentPath(window.location.pathname);
  }, []);

  // Auth guard
  useEffect(() => {
    const token = localStorage.getItem('portal_token');
    if (!token) {
      router.replace(`/${locale}/login`);
      return;
    }
    setAuthenticated(true);
  }, [locale, router, setAuthenticated]);

  // Load clinics
  useEffect(() => {
    if (!isAuthenticated) return;
    PortalApi.get<{ clinics: Clinic[] }>('/portal/v1/auth/clinics')
      .then((data) => setClinics(data.clinics))
      .catch(() => {});
  }, [isAuthenticated, setClinics]);

  // Apply saved theme
  useEffect(() => {
    const saved = localStorage.getItem('portal_theme') as 'light' | 'dark' | null;
    if (saved) document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const handleLogout = () => {
    logout();
    router.replace(`/${locale}/login`);
  };

  const handleNav = (href: string) => {
    const fullPath = `/${locale}${href}`;
    setCurrentPath(fullPath);
    setMobileMenuOpen(false);
    router.push(fullPath);
  };

  const isActive = (href: string) => {
    const fullPath = `/${locale}${href}`;
    if (href === '/cabinet') return currentPath === fullPath;
    return currentPath.startsWith(fullPath);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-bg">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-64 fixed inset-y-0 left-0 z-30 bg-surface/80 backdrop-blur-xl border-r border-line">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-line">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-sm">
            MC
          </div>
          <span className="text-lg font-bold text-ink tracking-tight">MedCRM</span>
        </div>

        {/* Clinic selector */}
        {clinics.length > 0 && (
          <div className="px-4 py-3 border-b border-line">
            <button
              onClick={() => setClinicDropdownOpen(!clinicDropdownOpen)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-surface-soft hover:bg-surface-muted text-sm transition-colors duration-200"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Building2 size={16} className="text-brand shrink-0" />
                <span className="truncate text-ink font-medium">
                  {activeClinic?.clinicName ?? t('selectClinic')}
                </span>
              </div>
              <ChevronDown
                size={14}
                className={`text-muted shrink-0 transition-transform duration-200 ${
                  clinicDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            {clinicDropdownOpen && (
              <div className="mt-1.5 py-1 rounded-xl bg-surface border border-line shadow-md overflow-hidden animate-fade-in">
                {clinics.map((c) => (
                  <button
                    key={c.tenantId}
                    onClick={() => {
                      setActiveClinic(c);
                      setClinicDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-150 ${
                      activeClinic?.tenantId === c.tenantId
                        ? 'bg-brand-soft text-brand font-medium'
                        : 'text-text hover:bg-surface-soft'
                    }`}
                  >
                    {c.clinicName}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ key, href, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleNav(href)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive(href)
                  ? 'bg-brand-soft text-brand shadow-sm'
                  : 'text-muted hover:text-ink hover:bg-surface-soft'
              }`}
            >
              <Icon
                size={20}
                className={`shrink-0 transition-colors duration-200 ${
                  isActive(href) ? 'text-brand' : 'text-faint group-hover:text-muted'
                }`}
              />
              {t(key)}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 pb-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-danger hover:bg-danger-soft transition-all duration-200"
          >
            <LogOut size={20} />
            {t('logout')}
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top bar (mobile) */}
        <header className="sticky top-0 z-20 lg:hidden flex items-center justify-between h-14 px-4 bg-surface/80 backdrop-blur-xl border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-xs">
              MC
            </div>
            <span className="text-base font-bold text-ink">MedCRM</span>
          </div>

          {/* Clinic selector (mobile) */}
          {clinics.length > 1 && (
            <button
              onClick={() => setClinicDropdownOpen(!clinicDropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-soft text-xs font-medium text-ink max-w-[140px]"
            >
              <Building2 size={14} className="text-brand shrink-0" />
              <span className="truncate">{activeClinic?.clinicName}</span>
              <ChevronDown size={12} className="text-muted shrink-0" />
            </button>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-soft transition-colors"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        {/* Mobile clinic dropdown overlay */}
        {clinicDropdownOpen && (
          <div
            className="lg:hidden fixed inset-0 z-30"
            onClick={() => setClinicDropdownOpen(false)}
          >
            <div
              className="absolute top-14 right-4 left-4 bg-surface border border-line rounded-xl shadow-lg p-1 animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              {clinics.map((c) => (
                <button
                  key={c.tenantId}
                  onClick={() => {
                    setActiveClinic(c);
                    setClinicDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-colors ${
                    activeClinic?.tenantId === c.tenantId
                      ? 'bg-brand-soft text-brand font-medium'
                      : 'text-text hover:bg-surface-soft'
                  }`}
                >
                  {c.clinicName}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mobile slide-out menu */}
        {mobileMenuOpen && (
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="absolute right-0 top-0 bottom-0 w-64 bg-surface border-l border-line shadow-xl animate-fade-in flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 h-14 border-b border-line">
                <span className="font-semibold text-ink">{t('menu')}</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-soft"
                >
                  <X size={18} />
                </button>
              </div>
              <nav className="flex-1 px-3 py-4 space-y-1">
                {navItems.map(({ key, href, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => handleNav(href)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive(href)
                        ? 'bg-brand-soft text-brand'
                        : 'text-muted hover:text-ink hover:bg-surface-soft'
                    }`}
                  >
                    <Icon size={20} />
                    {t(key)}
                  </button>
                ))}
              </nav>
              <div className="px-3 pb-6">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-danger hover:bg-danger-soft transition-all duration-200"
                >
                  <LogOut size={20} />
                  {t('logout')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8 pb-24 lg:pb-8">{children}</main>

        {/* ── Bottom Mobile Navigation ── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-surface/90 backdrop-blur-xl border-t border-line">
          <div className="flex items-stretch justify-around h-16">
            {navItems.map(({ key, href, icon: Icon }) => (
              <button
                key={key}
                onClick={() => handleNav(href)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 text-[11px] font-medium transition-colors duration-200 ${
                  isActive(href) ? 'text-brand' : 'text-muted'
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl transition-all duration-200 ${
                    isActive(href) ? 'bg-brand-soft' : ''
                  }`}
                >
                  <Icon size={20} strokeWidth={isActive(href) ? 2.5 : 2} />
                </div>
                <span>{t(key)}</span>
              </button>
            ))}
          </div>
          {/* Safe area for iPhone notch */}
          <div className="h-[env(safe-area-inset-bottom)]" />
        </nav>
      </div>
    </div>
  );
}
