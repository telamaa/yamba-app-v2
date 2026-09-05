/**
 * privacy.api.ts — droits sur les données, côté membre (C-PR8b, D63)
 * ==================================================================
 * Sudo par code email (SES-03), export JSON (fichier), effacement (409 typé : bloqueurs), préférences.
 */
import apiClient from "@/lib/api-client";

export type ErasureBlocker = "ACTIVE_DEAL" | "PENDING_REQUEST" | "PAYOUT_PENDING" | "RETENTION_HELD" | "PUBLISHED_TRIP" | "ADMIN_ACCOUNT";
export type ErasureCheck = { blockers: ErasureBlocker[]; counts: Record<string, number> };

export async function requestSudoCode(): Promise<void> {
  await apiClient.post("/auth/me/sudo/request", {}, { requireAuth: true });
}

export async function fetchErasureBlockers(): Promise<ErasureCheck> {
  const res = await apiClient.get<ErasureCheck>("/auth/me/erasure/blockers", { requireAuth: true });
  return res.data;
}

/** Télécharge le fichier JSON (le navigateur ne peut pas suivre un Content-Disposition en XHR : on crée le lien nous-mêmes). */
export async function downloadMyData(code: string): Promise<{ filename: string }> {
  const res = await apiClient.post<Blob>("/auth/me/data-export", { code }, { requireAuth: true, responseType: "blob" });
  const disposition = String(res.headers?.["content-disposition"] ?? "");
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "yamba-mes-donnees.json";
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { filename };
}

export class ErasureBlockedError extends Error {
  constructor(public readonly check: ErasureCheck) {
    super("ERASURE_BLOCKED");
  }
}

export async function eraseMyAccount(code: string, confirmation: string): Promise<void> {
  try {
    await apiClient.post("/auth/me/erasure", { code, confirmation }, { requireAuth: true });
  } catch (e) {
    const data = (e as { response?: { status?: number; data?: { code?: string; blockers?: ErasureBlocker[]; counts?: Record<string, number> } } })?.response;
    if (data?.status === 409 && data.data?.code === "ERASURE_BLOCKED") throw new ErasureBlockedError({ blockers: data.data.blockers ?? [], counts: data.data.counts ?? {} });
    throw e;
  }
}

export async function updateMyPreferences(prefs: { messagingReminderEmails?: boolean }): Promise<{ messagingReminderEmails: boolean }> {
  const res = await apiClient.patch<{ preferences: { messagingReminderEmails: boolean } }>("/auth/me/preferences", prefs, { requireAuth: true });
  return res.data.preferences;
}
