const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * Erreur typée pour les requêtes API.
 * Permet de matcher facilement sur status code dans les hooks/composants.
 */
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

type ApiErrorBody = { error?: string; message?: string };

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  if (!API_BASE) throw new Error("NEXT_PUBLIC_API_BASE_URL is missing");

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    credentials: "include", // important pour cookies access/refresh
  });

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;

  if (!res.ok) {
    const err = data as ApiErrorBody | undefined;
    throw new ApiError(
      err?.message || err?.error || `API Error (${res.status})`,
      res.status,
      data
    );
  }

  return data as T;
}
