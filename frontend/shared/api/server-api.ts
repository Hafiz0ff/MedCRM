import { cookies } from 'next/headers';
import { BootstrapPayload } from '@/shared/types/bootstrap';

function apiBaseUrl(): string {
  return process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
}

/**
 * Server-side bootstrap fetch. Resolves a temporary access token by refreshing from the HTTP-only cookie.
 */
export async function getBootstrap(): Promise<BootstrapPayload | null> {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh_token')?.value;
    if (!refreshToken) {
      return null;
    }

    // Refresh the access token server-side using the HttpOnly refresh token
    const refreshResponse = await fetch(`${apiBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `refresh_token=${refreshToken}`,
      },
      cache: 'no-store',
    });

    if (!refreshResponse.ok) {
      return null;
    }

    const refreshData = await refreshResponse.json();
    const accessToken = refreshData.accessToken;
    if (!accessToken) {
      return null;
    }

    const response = await fetch(`${apiBaseUrl()}/auth/bootstrap`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });

    if (!response?.ok) {
      return null;
    }

    return (await response.json()) as BootstrapPayload;
  } catch (error) {
    console.error('Server-side bootstrap fetch failed:', error);
    return null;
  }
}
