'use client';

import {
  User,
  Phone,
  CalendarDays,
  Building2,
  LogOut,
  Download,
  Sun,
  Moon,
  Link2,
  Unlink,
  Loader2,
  Check,
  ChevronRight,
  Shield,
  Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useEffect, use } from 'react';
import { PortalApi } from '@/lib/api';
import { useAuthStore, Clinic } from '@/lib/store';

interface PageProps {
  params: Promise<{ locale: string }>;
}

interface PatientProfile {
  firstName: string;
  lastName: string;
  phone: string;
  birthDate?: string;
  gender?: string;
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-surface-muted ${className ?? ''}`} />;
}

export default function ProfilePage({ params }: PageProps) {
  const { locale } = use(params);
  const t = useTranslations('profile');
  const router = useRouter();
  const { clinics, theme, toggleTheme, logout } = useAuthStore();

  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectCode, setConnectCode] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [connectSuccess, setConnectSuccess] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    PortalApi.get<PatientProfile>('/portal/v1/profile')
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    logout();
    router.replace(`/${locale}/login`);
  };

  const handleConnect = async () => {
    if (!connectCode.trim()) return;
    setConnecting(true);
    setConnectError('');
    setConnectSuccess(false);
    try {
      await PortalApi.post('/portal/v1/auth/clinics/connect', {
        tenantCode: connectCode.trim(),
      });
      setConnectSuccess(true);
      setConnectCode('');
      setTimeout(() => setConnectSuccess(false), 3000);
      // Refresh would reload clinics in layout
    } catch (err: unknown) {
      setConnectError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (clinic: Clinic) => {
    setDisconnecting(clinic.tenantId);
    try {
      await PortalApi.delete(`/portal/v1/auth/clinics/${clinic.tenantId}`);
    } catch {
      // silent for now
    } finally {
      setDisconnecting(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await PortalApi.post('/portal/v1/profile/export');
    } catch {
      // silent
    } finally {
      setExporting(false);
    }
  };

  const genderLabel = (g?: string) => {
    if (!g) return '—';
    return g === 'MALE' ? t('male') : t('female');
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-48" />
        <SkeletonBlock className="h-32" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
      {/* Profile header */}
      <div className="relative overflow-hidden bg-surface rounded-2xl border border-line p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 flex items-center justify-center text-white text-xl font-bold shrink-0">
            {profile?.firstName?.charAt(0)}
            {profile?.lastName?.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-ink truncate">
              {profile?.firstName} {profile?.lastName}
            </h1>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted">
              <Phone size={14} />
              <span>{profile?.phone}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Personal info */}
      <section className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-line">
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
            <Shield size={16} className="text-brand" />
            {t('personalInfo')}
          </h2>
        </div>
        <div className="divide-y divide-line">
          <InfoRow
            icon={<User size={16} className="text-muted" />}
            label={t('fullName')}
            value={`${profile?.firstName} ${profile?.lastName}`}
          />
          <InfoRow
            icon={<Phone size={16} className="text-muted" />}
            label={t('phone')}
            value={profile?.phone ?? '—'}
          />
          <InfoRow
            icon={<CalendarDays size={16} className="text-muted" />}
            label={t('birthDate')}
            value={
              profile?.birthDate
                ? new Date(profile.birthDate).toLocaleDateString(locale, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : '—'
            }
          />
          <InfoRow
            icon={<Sparkles size={16} className="text-muted" />}
            label={t('gender')}
            value={genderLabel(profile?.gender)}
          />
        </div>
      </section>

      {/* Connected clinics */}
      <section className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-line">
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
            <Building2 size={16} className="text-brand" />
            {t('connectedClinics')}
          </h2>
        </div>
        <div className="divide-y divide-line">
          {clinics.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <Building2 size={24} className="mx-auto text-faint mb-2" />
              <p className="text-sm text-muted">{t('noClinics')}</p>
            </div>
          ) : (
            clinics.map((c) => (
              <div key={c.tenantId} className="flex items-center gap-3 px-5 py-3.5">
                <div className="w-9 h-9 rounded-xl bg-brand-soft flex items-center justify-center shrink-0">
                  <Building2 size={16} className="text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">{c.clinicName}</p>
                  <p className="text-xs text-faint">{c.tenantCode}</p>
                </div>
                <button
                  onClick={() => handleDisconnect(c)}
                  disabled={disconnecting === c.tenantId}
                  className="shrink-0 w-8 h-8 rounded-lg bg-danger-soft text-danger flex items-center justify-center hover:bg-danger/10 transition-colors disabled:opacity-50"
                  title={t('disconnect')}
                >
                  {disconnecting === c.tenantId ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Unlink size={14} />
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Connect new clinic */}
        <div className="px-5 py-4 border-t border-line">
          <p className="text-xs font-medium text-muted mb-2">{t('connectNew')}</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder={t('tenantCodePlaceholder')}
                value={connectCode}
                onChange={(e) => setConnectCode(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
              />
            </div>
            <button
              onClick={handleConnect}
              disabled={connecting || !connectCode.trim()}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {connecting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : connectSuccess ? (
                <Check size={16} />
              ) : (
                t('connect')
              )}
            </button>
          </div>
          {connectError && <p className="mt-2 text-xs text-danger">{connectError}</p>}
          {connectSuccess && <p className="mt-2 text-xs text-success">{t('connectSuccess')}</p>}
        </div>
      </section>

      {/* Settings */}
      <section className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-line">
          <h2 className="text-sm font-semibold text-ink">{t('settings')}</h2>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-surface-soft transition-colors border-b border-line"
        >
          <div className="w-9 h-9 rounded-xl bg-violet-soft flex items-center justify-center shrink-0">
            {theme === 'light' ? (
              <Sun size={16} className="text-violet" />
            ) : (
              <Moon size={16} className="text-violet" />
            )}
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-ink">{t('theme')}</p>
            <p className="text-xs text-muted">
              {theme === 'light' ? t('themeLight') : t('themeDark')}
            </p>
          </div>
          <ChevronRight size={16} className="text-faint" />
        </button>

        {/* Export data */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-surface-soft transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-info-soft flex items-center justify-center shrink-0">
            {exporting ? (
              <Loader2 size={16} className="text-info animate-spin" />
            ) : (
              <Download size={16} className="text-info" />
            )}
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-ink">{t('exportData')}</p>
            <p className="text-xs text-muted">{t('exportDesc')}</p>
          </div>
          <ChevronRight size={16} className="text-faint" />
        </button>
      </section>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-danger-soft text-danger font-semibold text-sm hover:bg-danger/10 transition-colors duration-200 border border-danger/20"
      >
        <LogOut size={18} />
        {t('logout')}
      </button>

      {/* Spacer for bottom nav */}
      <div className="h-4" />
    </div>
  );
}

/* ── Info Row Component ── */
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-sm font-medium text-ink truncate">{value}</p>
      </div>
    </div>
  );
}
