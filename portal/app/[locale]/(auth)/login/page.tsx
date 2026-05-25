'use client';

import { Phone, Lock, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useEffect, use } from 'react';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default function LoginPage({ params }: PageProps) {
  const { locale } = use(params);
  const t = useTranslations('auth.login');
  const router = useRouter();

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const normalizePhoneNumber = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (digits.startsWith('992')) return `+${digits}`;
    if (digits.startsWith('7') || digits.startsWith('9')) return `+${digits}`;
    return digits ? `+${digits}` : '';
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(normalizePhoneNumber(e.target.value));
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 9) {
      setError(t('errorPhone'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/portal/v1/auth/otp/request`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Ошибка запроса кода');
      }

      setStep('otp');
      setTimer(300); // 5 minutes resend timer
    } catch (err: any) {
      setError(err.message || 'Не удалось отправить код подтверждения');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError(t('errorCode'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/portal/v1/auth/otp/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, code }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Неверный или просроченный код');
      }

      const session = await res.json();

      // Store accessToken in localStorage and cookie for Next.js auth verification
      localStorage.setItem('portal_token', session.accessToken);
      document.cookie = `portal_token=${session.accessToken}; path=/; max-age=3600; SameSite=Strict`;

      setSuccess(true);

      setTimeout(() => {
        router.push(`/${locale}/cabinet`);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Неверный код подтверждения');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md glass-panel p-8 rounded-2xl text-center shadow-lg border border-line animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success-soft text-success mb-6">
            <CheckCircle2 size={36} />
          </div>
          <h2 className="text-2xl font-bold text-ink mb-2">{t('successTitle')}</h2>
          <p className="text-muted text-sm">Перенаправление в личный кабинет...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface p-8 rounded-2xl shadow-lg border border-line animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-soft text-brand-600 mb-4 font-bold text-xl">
            MIS
          </div>
          <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
          <p className="text-muted text-sm mt-2">
            {step === 'phone'
              ? 'Войдите для просмотра истории приемов и медицинских карт'
              : t('enterCode')}
          </p>
        </div>

        {error ? (
          <div className="mb-6 p-4 rounded-lg bg-danger-soft text-danger text-sm border border-danger/20">
            {error}
          </div>
        ) : null}

        {step === 'phone' ? (
          <form onSubmit={handleRequestOtp} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-semibold text-ink">
                {t('phoneLabel')}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                  <Phone size={18} />
                </span>
                <input
                  id="phone"
                  type="tel"
                  placeholder={t('phonePlaceholder')}
                  value={phone}
                  onChange={handlePhoneChange}
                  className="w-full pl-12 pr-4 py-3"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold transition duration-200 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {t('sendCode')}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label htmlFor="code" className="text-sm font-semibold text-ink">
                  {t('codeLabel')}
                </label>
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="text-xs text-brand hover:underline"
                >
                  Изменить телефон
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                  <Lock size={18} />
                </span>
                <input
                  id="code"
                  type="text"
                  pattern="\d*"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full pl-12 pr-4 py-3 text-center tracking-widest text-lg font-bold"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold transition duration-200 disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : t('verify')}
            </button>

            {timer > 0 ? (
              <p className="text-center text-xs text-muted">
                Запросить код повторно через {Math.floor(timer / 60)}:
                {String(timer % 60).padStart(2, '0')}
              </p>
            ) : (
              <button
                type="button"
                onClick={handleRequestOtp}
                className="w-full text-center text-xs text-brand hover:underline"
              >
                Отправить код еще раз
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
