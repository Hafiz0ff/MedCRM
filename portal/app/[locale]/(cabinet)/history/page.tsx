'use client';

import {
  Calendar,
  User,
  Filter,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Search,
  MapPin,
  Stethoscope,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useEffect, use } from 'react';
import { PortalApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

interface PageProps {
  params: Promise<{ locale: string }>;
}

interface Visit {
  id: string;
  dateTime: string;
  doctorName: string;
  specialty: string;
  serviceName: string;
  branchName: string;
  status: 'completed' | 'cancelled' | 'no_show';
  totalAmount?: number;
}

interface VisitsResponse {
  visits: Visit[];
  total: number;
  page: number;
  limit: number;
}

type StatusFilter = 'all' | 'completed' | 'cancelled' | 'no_show';

const statusConfig: Record<
  string,
  { icon: typeof CheckCircle2; colorClass: string; bgClass: string }
> = {
  completed: { icon: CheckCircle2, colorClass: 'text-success', bgClass: 'bg-success-soft' },
  cancelled: { icon: XCircle, colorClass: 'text-danger', bgClass: 'bg-danger-soft' },
  no_show: { icon: AlertCircle, colorClass: 'text-warning', bgClass: 'bg-warning-soft' },
};

function SkeletonCard() {
  return <div className="animate-pulse bg-surface-muted rounded-2xl h-28" />;
}

export default function HistoryPage({ params }: PageProps) {
  const { locale } = use(params);
  const t = useTranslations('visits');
  const { activeClinic } = useAuthStore();

  const [visits, setVisits] = useState<Visit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const limit = 20;

  useEffect(() => {
    if (!activeClinic) return;
    setLoading(true);
    const params = new URLSearchParams({
      tenantCode: activeClinic.tenantCode,
      page: String(page),
      limit: String(limit),
    });
    if (filter !== 'all') params.set('status', filter);

    PortalApi.get<VisitsResponse>(`/portal/v1/visits/history?${params}`)
      .then((data) => {
        setVisits(data.visits);
        setTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeClinic, page, filter]);

  const totalPages = Math.ceil(total / limit);

  const filteredVisits = search
    ? visits.filter(
        (v) =>
          v.doctorName.toLowerCase().includes(search.toLowerCase()) ||
          v.serviceName.toLowerCase().includes(search.toLowerCase()),
      )
    : visits;

  const filters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t('filterAll') },
    { key: 'completed', label: t('filterCompleted') },
    { key: 'cancelled', label: t('filterCancelled') },
    { key: 'no_show', label: t('filterNoShow') },
  ];

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <h1 className="text-xl font-bold text-ink mb-5">{t('title')}</h1>

      {/* Search and filters */}
      <div className="space-y-3 mb-5">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {filters.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setFilter(key);
                setPage(1);
              }}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${
                filter === key
                  ? 'bg-brand text-white border-brand'
                  : 'bg-surface border-line text-muted hover:border-brand/30 hover:bg-surface-soft'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Visit list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredVisits.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-surface-soft flex items-center justify-center mb-4">
            <Clock size={28} className="text-faint" />
          </div>
          <p className="text-muted font-medium">{t('noVisits')}</p>
          <p className="text-sm text-faint mt-1">{t('noVisitsDesc')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredVisits.map((visit) => {
            const cfg = statusConfig[visit.status] || statusConfig.completed;
            const StatusIcon = cfg.icon;

            return (
              <button
                key={visit.id}
                onClick={() => setSelectedVisit(selectedVisit?.id === visit.id ? null : visit)}
                className="w-full text-left bg-surface rounded-2xl border border-line p-4 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-xl ${cfg.bgClass} flex items-center justify-center shrink-0 mt-0.5`}
                  >
                    <StatusIcon size={18} className={cfg.colorClass} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-ink text-sm truncate">{visit.serviceName}</p>
                      <span
                        className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold ${cfg.bgClass} ${cfg.colorClass}`}
                      >
                        {t(`status.${visit.status}`)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted">
                      <User size={12} />
                      <span>{visit.doctorName}</span>
                      <span className="text-faint">·</span>
                      <span>{visit.specialty}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-faint">
                      <Calendar size={12} />
                      <span>
                        {new Date(visit.dateTime).toLocaleDateString(locale, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Expanded details */}
                    {selectedVisit?.id === visit.id && (
                      <div className="mt-3 pt-3 border-t border-line space-y-2 animate-fade-in">
                        <div className="flex items-center gap-1.5 text-xs text-muted">
                          <MapPin size={12} />
                          <span>{visit.branchName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted">
                          <Stethoscope size={12} />
                          <span>{visit.specialty}</span>
                        </div>
                        {visit.totalAmount != null && (
                          <p className="text-sm font-semibold text-ink">
                            {visit.totalAmount.toLocaleString()} TJS
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-9 h-9 rounded-xl bg-surface border border-line flex items-center justify-center hover:bg-surface-soft disabled:opacity-30 transition-all"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-muted px-3">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-9 h-9 rounded-xl bg-surface border border-line flex items-center justify-center hover:bg-surface-soft disabled:opacity-30 transition-all"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
