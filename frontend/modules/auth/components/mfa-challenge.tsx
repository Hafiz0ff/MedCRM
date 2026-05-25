'use client';

import { ShieldCheck, ArrowLeft, Loader2, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';

type MfaChallengeProps = {
  mfaToken: string;
  onSuccess: (accessToken: string) => void;
  onCancel: () => void;
};

type MfaVerifyResponse = {
  accessToken: string;
};

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
}

export function MfaChallenge({ mfaToken, onSuccess, onCancel }: MfaChallengeProps) {
  const [code, setCode] = useState('');
  const [isBackup, setIsBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = code.replace(/\s/g, '');
    const expectedLength = isBackup ? 8 : 6;

    if (cleanCode.length !== expectedLength) {
      setError(
        isBackup
          ? 'Код восстановления должен состоять из 8 символов'
          : 'Код подтверждения должен состоять из 6 цифр',
      );
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${apiBaseUrl()}/auth/2fa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mfaToken,
          code: cleanCode,
          deviceName:
            typeof window !== 'undefined' ? window.navigator.userAgent.slice(0, 100) : 'Web App',
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = 'Неверный код. Пожалуйста, попробуйте еще раз.';
        try {
          const parsed = JSON.parse(errText);
          if (parsed.message) errMsg = parsed.message;
        } catch {}
        setError(errMsg);
        return;
      }

      const data = (await response.json()) as MfaVerifyResponse;
      onSuccess(data.accessToken);
    } catch {
      setError('Ошибка сети. Проверьте подключение к серверу.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleMode = () => {
    setError(null);
    setCode('');
    setIsBackup(!isBackup);
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col items-center text-center space-y-2">
        <div className="p-3 bg-brand/10 text-brand rounded-full">
          <ShieldCheck size={28} />
        </div>
        <h2 className="text-xl font-bold text-ink">Двухфакторная защита</h2>
        <p className="text-sm text-muted max-w-[280px]">
          {isBackup
            ? 'Введите один из ваших 8-значных резервных кодов восстановления:'
            : 'Введите 6-значный одноразовый код из вашего приложения аутентификатора:'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="form flex flex-col gap-4">
        <div className="field flex flex-col gap-1.5">
          <Label
            htmlFor="mfaCode"
            className="font-semibold text-xs uppercase tracking-wider text-muted"
          >
            {isBackup ? 'Резервный код' : 'Код подтверждения'}
          </Label>
          <Input
            id="mfaCode"
            autoFocus
            type={isBackup ? 'text' : 'tel'}
            placeholder={isBackup ? '12345678' : '000 000'}
            value={code}
            onChange={(e) => {
              const val = e.target.value;
              if (isBackup) {
                // allow alphanumeric
                setCode(val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8));
              } else {
                // digits only
                setCode(val.replace(/\D/g, '').slice(0, 6));
              }
            }}
            maxLength={isBackup ? 8 : 6}
            className="text-center font-mono tracking-widest text-lg h-12 focus:border-brand"
            disabled={submitting}
            required
          />
        </div>

        {error ? (
          <div className="error text-sm text-danger font-medium text-center">{error}</div>
        ) : null}

        <Button type="submit" disabled={submitting} className="w-full h-11 text-sm font-semibold">
          {submitting ? (
            <>
              <Loader2 className="animate-spin mr-2" size={16} />
              Проверка...
            </>
          ) : (
            'Подтвердить и войти'
          )}
        </Button>

        <div className="flex items-center justify-between text-xs pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1 text-muted hover:text-ink cursor-pointer"
            disabled={submitting}
          >
            <ArrowLeft size={13} />
            Вернуться назад
          </button>

          <button
            type="button"
            onClick={handleToggleMode}
            className="flex items-center gap-1 text-brand hover:text-brand-strong font-semibold cursor-pointer"
            disabled={submitting}
          >
            <KeyRound size={13} />
            {isBackup ? 'Использовать TOTP' : 'У меня нет доступа'}
          </button>
        </div>
      </form>
    </div>
  );
}
