import { cookies } from 'next/headers';
import { ACCESS_TOKEN_COOKIE } from '@/shared/auth/cookies';
import { BootstrapPayload } from '@/shared/types/bootstrap';

function apiBaseUrl(): string {
  return process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
}

export async function getBootstrap(): Promise<BootstrapPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) {
    return null;
  }

  const response = await fetch(`${apiBaseUrl()}/auth/bootstrap`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  return (await response.json()) as BootstrapPayload;
}
