'use client';

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Search,
  Stethoscope,
  User,
  Calendar,
  MapPin,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback, use } from 'react';
import { PortalApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

interface PageProps {
  params: Promise<{ locale: string }>;
}

interface Specialty {
  id: string;
  name: string;
  icon?: string;
}

interface Doctor {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  specialty: string;
  photoUrl?: string;
  branchId: string;
  branchName: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

const STEPS = ['specialty', 'doctor', 'datetime', 'confirm'] as const;
type Step = (typeof STEPS)[number];

/* ── Skeleton ── */
function SkeletonCard({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-surface-muted ${className ?? ''}`} />;
}

export default function BookingPage({ params }: PageProps) {
  const { locale } = use(params);
  const t = useTranslations('booking');
  const router = useRouter();
  const { activeClinic } = useAuthStore();

  const [step, setStep] = useState<Step>('specialty');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Step 2
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

  // Step 3
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Step 4
  const [otp, setOtp] = useState('');
  const [reservationId, setReservationId] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const tc = activeClinic?.tenantCode;
  const stepIndex = STEPS.indexOf(step);

  // Load specialties
  useEffect(() => {
    if (!tc) return;
    setLoading(true);
    PortalApi.get<{ specialties: Specialty[] }>(`/portal/v1/booking/specialties?tenantCode=${tc}`)
      .then((d) => setSpecialties(d.specialties))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tc]);

  // Load doctors when specialty selected
  useEffect(() => {
    if (!tc || !selectedSpecialty) return;
    setLoading(true);
    PortalApi.get<{ doctors: Doctor[] }>(
      `/portal/v1/booking/doctors?tenantCode=${tc}&specialtyId=${selectedSpecialty.id}`,
    )
      .then((d) => setDoctors(d.doctors))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tc, selectedSpecialty]);

  // Load slots when date picked
  useEffect(() => {
    if (!tc || !selectedDoctor || !selectedDate) return;
    setLoading(true);
    PortalApi.get<{ slots: TimeSlot[] }>(
      `/portal/v1/booking/slots?tenantCode=${tc}&branchId=${selectedDoctor.branchId}&employeeId=${selectedDoctor.employeeId}&date=${selectedDate}`,
    )
      .then((d) => setSlots(d.slots))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tc, selectedDoctor, selectedDate]);

  const handleSelectSpecialty = (s: Specialty) => {
    setSelectedSpecialty(s);
    setSelectedDoctor(null);
    setSelectedDate('');
    setSelectedSlot('');
    setStep('doctor');
  };

  const handleSelectDoctor = (d: Doctor) => {
    setSelectedDoctor(d);
    setSelectedDate('');
    setSelectedSlot('');
    setStep('datetime');
  };

  const handleSelectSlot = (time: string) => {
    setSelectedSlot(time);
  };

  const handleReserve = async () => {
    if (!selectedDoctor || !selectedDate || !selectedSlot || !tc) return;
    setLoading(true);
    setError('');
    try {
      const res = await PortalApi.post<{ reservationId: string }>('/portal/v1/booking/reserve', {
        tenantCode: tc,
        branchId: selectedDoctor.branchId,
        employeeId: selectedDoctor.employeeId,
        date: selectedDate,
        time: selectedSlot,
        specialtyId: selectedSpecialty?.id,
      });
      setReservationId(res.reservationId);
      setStep('confirm');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reserve');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (otp.length !== 6 || !reservationId) return;
    setConfirming(true);
    setError('');
    try {
      await PortalApi.post('/portal/v1/booking/confirm', {
        reservationId,
        code: otp,
      });
      setConfirmed(true);
      setTimeout(() => router.push(`/${locale}/cabinet`), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setConfirming(false);
    }
  };

  const goBack = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  // Calendar helpers
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfWeek = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Monday-based
  };

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const calendarDays = useCallback(() => {
    const { year, month } = calendarMonth;
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfWeek(year, month);
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [calendarMonth]);

  const formatDate = (year: number, month: number, day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const isPast = (year: number, month: number, day: number) => {
    const d = new Date(year, month, day);
    const t2 = new Date();
    t2.setHours(0, 0, 0, 0);
    return d < t2;
  };

  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const filteredSpecialties = specialties.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (confirmed) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-success-soft flex items-center justify-center">
            <Check size={32} className="text-success" />
          </div>
          <h2 className="text-xl font-bold text-ink mb-2">{t('confirmed')}</h2>
          <p className="text-sm text-muted">{t('confirmedDesc')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <div
              className={`w-full h-1.5 rounded-full transition-colors duration-300 ${
                i <= stepIndex ? 'bg-brand' : 'bg-surface-muted'
              }`}
            />
          </div>
        ))}
      </div>

      {/* Step labels */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {stepIndex > 0 && (
            <button
              onClick={goBack}
              className="w-9 h-9 rounded-xl bg-surface-soft hover:bg-surface-muted flex items-center justify-center transition-colors"
            >
              <ArrowLeft size={18} className="text-ink" />
            </button>
          )}
          <div>
            <p className="text-xs font-medium text-muted uppercase tracking-wider">
              {t('step', { current: stepIndex + 1, total: STEPS.length })}
            </p>
            <h1 className="text-xl font-bold text-ink">{t(`steps.${step}`)}</h1>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-danger-soft text-danger text-sm border border-danger/20">
          {error}
        </div>
      )}

      {/* ── Step 1: Specialties ── */}
      {step === 'specialty' && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder={t('searchSpecialty')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl"
            />
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} className="h-24" />
              ))}
            </div>
          ) : filteredSpecialties.length === 0 ? (
            <div className="text-center py-12">
              <Stethoscope size={32} className="mx-auto text-faint mb-3" />
              <p className="text-muted text-sm">{t('noSpecialties')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredSpecialties.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSelectSpecialty(s)}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-surface border border-line shadow-sm hover:shadow-md hover:border-brand/30 hover:-translate-y-0.5 transition-all duration-200 text-center group"
                >
                  <div className="w-10 h-10 rounded-xl bg-brand-soft flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                    <Stethoscope size={20} className="text-brand" />
                  </div>
                  <span className="text-sm font-semibold text-ink leading-tight">{s.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Doctors ── */}
      {step === 'doctor' && (
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} className="h-24" />)
          ) : doctors.length === 0 ? (
            <div className="text-center py-12">
              <User size={32} className="mx-auto text-faint mb-3" />
              <p className="text-muted text-sm">{t('noDoctors')}</p>
            </div>
          ) : (
            doctors.map((d) => (
              <button
                key={d.id}
                onClick={() => handleSelectDoctor(d)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-surface border border-line shadow-sm hover:shadow-md hover:border-brand/30 transition-all duration-200 text-left group"
              >
                <div className="w-14 h-14 rounded-2xl bg-surface-soft flex items-center justify-center shrink-0 overflow-hidden">
                  {d.photoUrl ? (
                    <img
                      src={d.photoUrl}
                      alt={`${d.firstName} ${d.lastName}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User size={24} className="text-faint" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink text-base">
                    {d.lastName} {d.firstName}
                  </p>
                  <p className="text-sm text-muted mt-0.5">{d.specialty}</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-faint">
                    <MapPin size={12} />
                    <span>{d.branchName}</span>
                  </div>
                </div>
                <ArrowRight
                  size={18}
                  className="text-faint group-hover:text-brand transition-colors shrink-0"
                />
              </button>
            ))
          )}
        </div>
      )}

      {/* ── Step 3: Date & Time ── */}
      {step === 'datetime' && (
        <div className="space-y-5">
          {/* Calendar */}
          <div className="bg-surface rounded-2xl border border-line p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() =>
                  setCalendarMonth((p) => {
                    const d = new Date(p.year, p.month - 1);
                    return { year: d.getFullYear(), month: d.getMonth() };
                  })
                }
                className="w-8 h-8 rounded-lg hover:bg-surface-soft flex items-center justify-center transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-semibold text-ink capitalize">
                {new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString(locale, {
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <button
                onClick={() =>
                  setCalendarMonth((p) => {
                    const d = new Date(p.year, p.month + 1);
                    return { year: d.getFullYear(), month: d.getMonth() };
                  })
                }
                className="w-8 h-8 rounded-lg hover:bg-surface-soft flex items-center justify-center transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {weekDays.map((wd) => (
                <div key={wd} className="text-[11px] font-medium text-faint py-1">
                  {wd}
                </div>
              ))}
              {calendarDays().map((day, i) => {
                if (day === null) return <div key={`empty-${i}`} />;
                const dateStr = formatDate(calendarMonth.year, calendarMonth.month, day);
                const past = isPast(calendarMonth.year, calendarMonth.month, day);
                const isSelected = selectedDate === dateStr;
                const isToday = dateStr === todayStr;

                return (
                  <button
                    key={day}
                    disabled={past}
                    onClick={() => {
                      setSelectedDate(dateStr);
                      setSelectedSlot('');
                    }}
                    className={`relative w-full aspect-square rounded-xl text-sm font-medium transition-all duration-200 ${
                      past
                        ? 'text-faint/40 cursor-not-allowed'
                        : isSelected
                          ? 'bg-brand text-white shadow-sm'
                          : isToday
                            ? 'bg-brand-soft text-brand font-bold'
                            : 'text-ink hover:bg-surface-soft'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time slots */}
          {selectedDate && (
            <div>
              <h3 className="text-sm font-semibold text-muted mb-3 flex items-center gap-1.5">
                <Clock size={14} />
                {t('availableSlots')}
              </h3>
              {loading ? (
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonCard key={i} className="h-10" />
                  ))}
                </div>
              ) : slots.filter((s) => s.available).length === 0 ? (
                <div className="text-center py-8 bg-surface rounded-2xl border border-line">
                  <Clock size={24} className="mx-auto text-faint mb-2" />
                  <p className="text-sm text-muted">{t('noSlots')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {slots
                    .filter((s) => s.available)
                    .map((s) => (
                      <button
                        key={s.time}
                        onClick={() => handleSelectSlot(s.time)}
                        className={`py-2.5 px-2 rounded-xl text-sm font-semibold transition-all duration-200 border ${
                          selectedSlot === s.time
                            ? 'bg-brand text-white border-brand shadow-sm'
                            : 'bg-surface border-line text-ink hover:border-brand/30 hover:bg-brand-soft'
                        }`}
                      >
                        {s.time}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Proceed button */}
          {selectedSlot && (
            <button
              onClick={handleReserve}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold transition-colors duration-200 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {t('reserveSlot')}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* ── Step 4: Confirm ── */}
      {step === 'confirm' && (
        <div className="space-y-5">
          {/* Summary card */}
          <div className="bg-surface rounded-2xl border border-line p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
              {t('summary')}
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Stethoscope size={18} className="text-brand shrink-0" />
                <div>
                  <p className="text-xs text-muted">{t('steps.specialty')}</p>
                  <p className="text-sm font-semibold text-ink">{selectedSpecialty?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User size={18} className="text-brand shrink-0" />
                <div>
                  <p className="text-xs text-muted">{t('steps.doctor')}</p>
                  <p className="text-sm font-semibold text-ink">
                    {selectedDoctor?.lastName} {selectedDoctor?.firstName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar size={18} className="text-brand shrink-0" />
                <div>
                  <p className="text-xs text-muted">{t('steps.datetime')}</p>
                  <p className="text-sm font-semibold text-ink">
                    {selectedDate &&
                      new Date(selectedDate).toLocaleDateString(locale, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}
                    {' · '}
                    {selectedSlot}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin size={18} className="text-brand shrink-0" />
                <div>
                  <p className="text-xs text-muted">{t('branch')}</p>
                  <p className="text-sm font-semibold text-ink">{selectedDoctor?.branchName}</p>
                </div>
              </div>
            </div>
          </div>

          {/* OTP verification */}
          <div className="bg-surface rounded-2xl border border-line p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck size={18} className="text-brand" />
              <h3 className="text-sm font-semibold text-ink">{t('otpTitle')}</h3>
            </div>
            <p className="text-sm text-muted mb-4">{t('otpDesc')}</p>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                pattern="\d*"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full pl-11 pr-4 py-3 rounded-xl text-center tracking-[0.3em] text-lg font-bold"
              />
            </div>
          </div>

          {/* Confirm button */}
          <button
            onClick={handleConfirm}
            disabled={confirming || otp.length !== 6}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold transition-colors duration-200 disabled:opacity-50"
          >
            {confirming ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <Check size={18} />
                {t('confirmBooking')}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
