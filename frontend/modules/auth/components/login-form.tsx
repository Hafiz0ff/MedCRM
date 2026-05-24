'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ACCESS_TOKEN_COOKIE } from '@/shared/auth/cookies';
import { loginSchema } from '../schemas/login.schema';

type LoginResponse = {
  accessToken: string;
};

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
}

export function LoginForm() {
  const router = useRouter();
  const [tenantCode, setTenantCode] = useState('demo-clinic');
  const [email, setEmail] = useState('admin@demo.clinic');
  const [password, setPassword] = useState('Admin123!');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ tenantCode, email, password });
    if (!parsed.success) {
      setError('Проверьте tenant, email и пароль.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${apiBaseUrl()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(parsed.data)
      });

      if (!response.ok) {
        setError('Не удалось войти. Проверьте данные доступа.');
        return;
      }

      const data = (await response.json()) as LoginResponse;
      document.cookie = `${ACCESS_TOKEN_COOKIE}=${data.accessToken}; path=/; max-age=900; samesite=lax`;
      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError('API недоступен. Проверьте, что backend запущен.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="tenantCode">Код клиники</label>
        <input id="tenantCode" autoComplete="organization" value={tenantCode} onChange={(event) => setTenantCode(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="password">Пароль</label>
        <input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </div>
      {error ? <div className="error">{error}</div> : null}
      <button className="button" type="submit" disabled={submitting}>
        {submitting ? 'Вход...' : 'Войти'}
      </button>
      <p className="muted">Demo: demo-clinic · admin@demo.clinic</p>
    </form>
  );
}
