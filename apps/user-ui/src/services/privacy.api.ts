/**
 * privacy.api.ts — droits sur les données, côté membre (C-PR8b, D63)
 * ==================================================================
 * Export JSON (fichier), effacement (409 typé : bloqueurs), préférences — sous la fenêtre sudo (D65 : SudoGate).
 */
import apiClient from "@/lib/api-client";

export type ErasureBlocker = "ACTIVE_DEAL" | "PENDING_REQUEST" | "PAYOUT_PENDING" | "RETENTION_HELD" | "PUBLISHED_TRIP" | "ADMIN_ACCOUNT";
export type ErasureCheck = { blockers: ErasureBlocker[]; counts: Record<string, number> };

export async function fetchErasureBlockers(): Promise<ErasureCheck> {
  const res = await apiClient.get<ErasureCheck>("/auth/me/erasure/blockers", { requireAuth: true });
  return res.data;
}

/** Télécharge le fichier JSON (le navigateur ne peut pas suivre un Content-Disposition en XHR : on crée le lien nous-mêmes). */
export async function downloadMyData(): Promise<{ filename: string }> {
  const res = await apiClient.post<Blob>("/auth/me/data-export", {}, { requireAuth: true, responseType: "blob" });
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

export async function eraseMyAccount(confirmation: string): Promise<void> {
  try {
    await apiClient.post("/auth/me/erasure", { confirmation }, { requireAuth: true });
  } catch (e) {
    const data = (e as { response?: { status?: number; data?: { code?: string; blockers?: ErasureBlocker[]; counts?: Record<string, number> } } })?.response;
    if (data?.status === 409 && data.data?.code === "ERASURE_BLOCKED") throw new ErasureBlockedError({ blockers: data.data.blockers ?? [], counts: data.data.counts ?? {} });
    throw e;
  }
}

export async function updateMyPreferences(prefs: { messagingReminderEmails?: boolean; analyticsOptIn?: boolean }): Promise<{ messagingReminderEmails: boolean; analyticsOptIn?: boolean | null }> {
  const res = await apiClient.patch<{ preferences: { messagingReminderEmails: boolean; analyticsOptIn?: boolean | null } }>("/auth/me/preferences", prefs, { requireAuth: true });
  return res.data.preferences;
}
