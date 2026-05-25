'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { loginSchema } from '../schemas/login.schema';
import { MfaChallenge } from './mfa-challenge';
import { useRouter } from '@/i18n/routing';
import { ACCESS_TOKEN_COOKIE } from '@/shared/auth/cookies';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';

type LoginResponse = {
  accessToken?: string;
  mfaRequired?: boolean;
  mfaToken?: string;
};

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
}

export function LoginForm() {
  const router = useRouter();
  const t = useTranslations('Auth');
  const [tenantCode, setTenantCode] = useState('demo-clinic');
  const [email, setEmail] = useState('admin@demo.clinic');
  const [password, setPassword] = useState('Admin123!');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ tenantCode, email, password });
    if (!parsed.success) {
      setError(t('errors.required'));
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${apiBaseUrl()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        setError(t('errors.invalid'));
        return;
      }

      const data = (await response.json()) as LoginResponse;

      if (data.mfaRequired && data.mfaToken) {
        setMfaToken(data.mfaToken);
        return;
      }

      if (data.accessToken) {
        handleAuthSuccess(data.accessToken);
      }
    } catch {
      setError('API недоступен. Проверьте, что backend запущен.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleAuthSuccess(accessToken: string) {
    document.cookie = `${ACCESS_TOKEN_COOKIE}=${accessToken}; path=/; max-age=900; samesite=lax`;
    router.replace('/dashboard');
    router.refresh();
  }

  if (mfaToken) {
    return (
      <MfaChallenge
        mfaToken={mfaToken}
        onSuccess={handleAuthSuccess}
        onCancel={() => setMfaToken(null)}
      />
    );
  }

  return (
    <form className="form flex flex-col gap-4" onSubmit={submit}>
      <div className="field flex flex-col gap-1.5">
        <Label htmlFor="tenantCode">{t('tenantCode')}</Label>
        <Input
          id="tenantCode"
          autoComplete="organization"
          value={tenantCode}
          onChange={(event) => setTenantCode(event.target.value)}
        />
      </div>
      <div className="field flex flex-col gap-1.5">
        <Label htmlFor="email">{t('email')}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="field flex flex-col gap-1.5">
        <Label htmlFor="password">{t('password')}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {error ? <div className="error text-sm text-danger font-medium">{error}</div> : null}
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? t('signingIn') : t('signIn')}
      </Button>
      <p className="muted text-xs text-muted">Demo: demo-clinic · admin@demo.clinic</p>
    </form>
  );
}
