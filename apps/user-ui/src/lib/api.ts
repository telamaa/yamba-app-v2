const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type ApiError = { error?: string; message?: string };

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
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
    const err = data as ApiError | undefined;
    throw new Error(err?.message || err?.error || `API Error (${res.status})`);
  }

  return data as T;
}
