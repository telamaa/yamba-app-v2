/**
 * api.ts — client fetch de l'admin (cookies admin_*, même origine D48)
 * ====================================================================
 * Un 401 déclenche UNE tentative de rafraîchissement (POST /auth/admin/refresh)
 * puis rejoue la requête ; un second 401 renvoie à /login. Aucun jeton en JS.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

export class ApiError extends Error {
  status: number;
  data?: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(`${API_BASE}/auth/admin/refresh`, { method: "POST", credentials: "include" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function raw<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    credentials: "include",
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;
  if (!res.ok) {
    const err = data as { message?: string; error?: string } | undefined;
    throw new ApiError(err?.message || err?.error || `Erreur ${res.status}`, res.status, data);
  }
  return data as T;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, opts: { auth?: boolean } = { auth: true }): Promise<T> {
  try {
    return await raw<T>(path, init);
  } catch (e) {
    if (opts.auth !== false && e instanceof ApiError && e.status === 401) {
      if (await tryRefresh()) return raw<T>(path, init);
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) window.location.assign("/login");
    }
    throw e;
  }
}

export const post = <T>(path: string, body?: unknown, opts?: { auth?: boolean }) =>
  apiFetch<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }, opts);
