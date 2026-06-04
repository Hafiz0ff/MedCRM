'use client';

let inMemoryAccessToken: string | undefined = undefined;
let refreshingPromise: Promise<string | undefined> | null = null;

/**
 * Sets the active client access token in memory.
 */
export function setAccessToken(token: string | undefined): void {
  inMemoryAccessToken = token;
}

/**
 * Retrieves the active access token from memory.
 */
export function getAccessToken(): string | undefined {
  return inMemoryAccessToken;
}

/**
 * Executes a silent refresh call to fetch a new access token from the HTTP-only cookie.
 */
async function refreshAccessTokenClientSide(): Promise<string | undefined> {
  if (refreshingPromise) {
    return refreshingPromise;
  }

  refreshingPromise = (async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/auth/refresh`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        },
      );
      if (response.ok) {
        const data = await response.json();
        const token = data.accessToken;
        if (typeof token === 'string') {
          setAccessToken(token);
          return token;
        }
      }
    } catch (err) {
      console.error('Failed to refresh access token client side:', err);
    } finally {
      refreshingPromise = null;
    }
    return undefined;
  })();

  return refreshingPromise;
}

/**
 * Wrapper for standard fetch calls that injects Bearer credentials and handles silent refreshes.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let token = getAccessToken();

  // Try to refresh silently first if token is missing
  if (!token && path !== '/auth/login' && path !== '/auth/refresh' && path !== '/auth/mfa/verify') {
    token = await refreshAccessTokenClientSide();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers as Record<string, string>),
  };

  let response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}${path}`,
    {
      ...init,
      headers,
      credentials: 'include',
    },
  );

  // If 401, refresh token and retry
  if (
    response.status === 401 &&
    path !== '/auth/login' &&
    path !== '/auth/refresh' &&
    path !== '/auth/mfa/verify'
  ) {
    const newToken = await refreshAccessTokenClientSide();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}${path}`,
        {
          ...init,
          headers,
          credentials: 'include',
        },
      );
    }
  }

  if (!response.ok) {
    const body = await response.text();
    let errorMessage = `Request failed: ${response.status}`;

    // Safely parse the response to avoid exposing raw internal details
    try {
      const errorObj = JSON.parse(body);
      if (errorObj?.error?.message) {
        errorMessage = errorObj.error.message;
      } else if (errorObj?.message) {
        errorMessage = errorObj.message;
      }
    } catch {
      // Keep default request failed message
    }

    throw new Error(errorMessage);
  }

  return (await response.json()) as T;
}
