'use client';

import {
  CalendarPlus,
  ClockArrowUp,
  FileText,
  CreditCard,
  Calendar,
  User,
  MapPin,
  Building2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState, use } from 'react';
import { PortalApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

interface PageProps {
  params: Promise<{ locale: string }>;
}

interface UpcomingAppointment {
  id: string;
  dateTime: string;
  doctorName: string;
  specialty: string;
  branchName: string;
  serviceName: string;
}

interface PatientProfile {
  firstName: string;
  lastName: string;
  phone: string;
  debt?: number;
}

/* ── Skeleton components ── */
function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-surface-muted ${className ?? ''}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <SkeletonBlock className="h-10 w-64" />
      <SkeletonBlock className="h-40 w-full" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <SkeletonBlock className="h-28" />
        <SkeletonBlock className="h-28" />
        <SkeletonBlock className="h-28" />
      </div>
      <SkeletonBlock className="h-32 w-full" />
    </div>
  );
}

export default function DashboardPage({ params }: PageProps) {
  const { locale } = use(params);
  const t = useTranslations('cabinet.dashboard');
  const router = useRouter();
  const { activeClinic, clinics } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingAppointment[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [profileRes, upcomingRes] = await Promise.allSettled([
          PortalApi.get<PatientProfile>('/portal/v1/profile'),
          activeClinic
            ? PortalApi.get<{ appointments: UpcomingAppointment[] }>(
                `/portal/v1/booking/upcoming?tenantCode=${activeClinic.tenantCode}`,
              )
            : Promise.resolve({ appointments: [] }),
        ]);

        if (profileRes.status === 'fulfilled') setProfile(profileRes.value);
        if (upcomingRes.status === 'fulfilled') {
          const data = upcomingRes.value;
          setUpcoming('appointments' in data ? data.appointments : []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeClinic]);

  const quickActions = [
    {
      key: 'book',
      icon: CalendarPlus,
      color: 'text-brand bg-brand-soft',
      href: `/${locale}/cabinet/booking`,
    },
    {
      key: 'viewHistory',
      icon: ClockArrowUp,
      color: 'text-violet bg-violet-soft',
      href: `/${locale}/cabinet/history`,
    },
    {
      key: 'documents',
      icon: FileText,
      color: 'text-info bg-info-soft',
      href: `/${locale}/cabinet/profile`,
    },
  ];

  if (loading) return <DashboardSkeleton />;

  const nextVisit = upcoming[0] ?? null;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      {/* Welcome header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 px-6 py-7 text-white">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles size={18} className="opacity-80" />
            <span className="text-sm font-medium opacity-90">{t('title')}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t('welcome', { name: profile?.firstName ?? '' })}
          </h1>
        </div>
        {/* Decorative circles */}
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute -right-4 bottom-0 w-20 h-20 rounded-full bg-white/5" />
      </div>

      {/* Upcoming appointment */}
      <section>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
          {t('upcoming')}
        </h2>
        {nextVisit ? (
          <div className="bg-surface rounded-2xl border border-line p-5 shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-soft flex items-center justify-center shrink-0">
                <Calendar size={22} className="text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink text-base">{nextVisit.serviceName}</p>
                <div className="flex items-center gap-1.5 mt-1.5 text-sm text-muted">
                  <User size={14} />
                  <span>{nextVisit.doctorName}</span>
                  <span className="text-faint">·</span>
                  <span>{nextVisit.specialty}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-sm text-muted">
                  <MapPin size={14} />
                  <span>{nextVisit.branchName}</span>
                </div>
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-soft text-brand text-sm font-semibold">
                  <Calendar size={14} />
                  {new Date(nextVisit.dateTime).toLocaleDateString(locale, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-surface rounded-2xl border border-line p-8 text-center shadow-sm">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-soft flex items-center justify-center mb-3">
              <Calendar size={24} className="text-faint" />
            </div>
            <p className="text-muted text-sm">{t('noVisits')}</p>
            <button
              onClick={() => router.push(`/${locale}/cabinet/booking`)}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors duration-200"
            >
              <CalendarPlus size={16} />
              {t('bookNow')}
            </button>
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
          {t('quickActions')}
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map(({ key, icon: Icon, color, href }) => (
            <button
              key={key}
              onClick={() => router.push(href)}
              className="flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-surface border border-line shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center ${color} transition-transform duration-200 group-hover:scale-110`}
              >
                <Icon size={20} />
              </div>
              <span className="text-xs font-semibold text-ink text-center leading-tight">
                {t(key)}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Debt card */}
      {profile?.debt && profile.debt > 0 ? (
        <section className="bg-warning-soft border border-warning/20 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                <CreditCard size={20} className="text-warning" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{t('debt')}</p>
                <p className="text-xl font-bold text-warning">
                  {profile.debt.toLocaleString()} TJS
                </p>
              </div>
            </div>
            <button className="px-4 py-2 rounded-xl bg-warning text-white text-sm font-semibold hover:opacity-90 transition-opacity">
              {t('payNow')}
            </button>
          </div>
        </section>
      ) : null}

      {/* Clinics */}
      {clinics.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            {t('connectedClinics')}
          </h2>
          <div className="space-y-2">
            {clinics.map((c) => (
              <div
                key={c.tenantId}
                className="flex items-center gap-3 p-4 rounded-2xl bg-surface border border-line shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-soft flex items-center justify-center shrink-0">
                  <Building2 size={18} className="text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink text-sm truncate">{c.clinicName}</p>
                  <p className="text-xs text-muted">ID: {c.tenantCode}</p>
                </div>
                <ArrowRight size={16} className="text-faint shrink-0" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
