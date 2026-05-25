const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export class PortalApi {
  private static getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('portal_token');
  }

  private static async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (res.status === 401) {
      localStorage.removeItem('portal_token');
      window.location.href = '/ru/login';
      throw new Error('Session expired');
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || `Request failed: ${res.status}`);
    }
    return res.json();
  }

  static get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  static post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  static put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  static delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}
