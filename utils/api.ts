/** In-memory API client — no localStorage for tokens or data */

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken() {
  return authToken;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers, cache: 'no-store' });

  if (response.status === 401) {
    authToken = null;
    onUnauthorized?.();
    throw new ApiError(401, 'نشست منقضی شده است. دوباره وارد شوید.', 'UNAUTHORIZED');
  }

  if (response.status === 204) return null as T;

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.message || data?.error || 'خطا در ارتباط با سرور',
      data?.error
    );
  }

  return data as T;
}

export async function apiJson<T = unknown>(
  url: string,
  method: string,
  body?: unknown
): Promise<T> {
  return apiRequest<T>(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function uploadFile(
  file: File,
  category: 'logos' | 'avatars' | 'attachments' | 'profiles' | 'misc' = 'misc'
): Promise<{ path: string; mimeType: string; name: string; size: number }> {
  const form = new FormData();
  form.append('file', file);
  form.append('category', category);
  return apiRequest('/api/uploads', { method: 'POST', body: form });
}
