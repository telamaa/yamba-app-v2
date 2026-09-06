/**
 * account.api.ts — sessions, sudo, identifiants du membre (D65)
 * =============================================================
 * Le sudo est une fenêtre de 15 min liée à la session : `requestSudoCode` envoie le code,
 * `verifySudo` l'ouvre ; un geste sensible sans fenêtre répond 403 `SUDO_REQUIRED`.
 */
import apiClient from "@/lib/api-client";

export type SudoStatus = { active: boolean; expiresAt: string | null };
export type MemberSession = { jti: string; createdAt: string; lastActivityAt: string; rememberMe: boolean; device: string; ip: string | null; current: boolean };

export function isSudoRequired(e: unknown): boolean {
  const r = (e as { response?: { status?: number; data?: { details?: { code?: string } } } })?.response;
  return r?.status === 403 && r.data?.details?.code === "SUDO_REQUIRED";
}
export function apiMessage(e: unknown): string | null {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? null;
}

export const requestSudoCode = async () => { await apiClient.post("/auth/me/sudo/request", {}, { requireAuth: true }); };
export const verifySudo = async (code: string): Promise<SudoStatus> => (await apiClient.post<SudoStatus>("/auth/me/sudo/verify", { code }, { requireAuth: true })).data;
export const fetchSudoStatus = async (): Promise<SudoStatus> => (await apiClient.get<SudoStatus>("/auth/me/sudo", { requireAuth: true })).data;

export const fetchMySessions = async (): Promise<MemberSession[]> => (await apiClient.get<{ items: MemberSession[] }>("/auth/me/sessions", { requireAuth: true })).data.items;
export const revokeSession = async (jti: string): Promise<{ current: boolean }> => (await apiClient.delete<{ ok: true; current: boolean }>(`/auth/me/sessions/${jti}`, { requireAuth: true })).data;
export const revokeOtherSessions = async (): Promise<number> => (await apiClient.delete<{ ok: true; revoked: number }>("/auth/me/sessions", { requireAuth: true })).data.revoked;

export const changePassword = async (newPassword: string): Promise<{ revokedSessions: number; hadPassword: boolean }> => (await apiClient.post<{ ok: true; revokedSessions: number; hadPassword: boolean }>("/auth/me/password", { newPassword }, { requireAuth: true })).data;
export const requestEmailChange = async (newEmail: string): Promise<{ pendingEmail: string; expiresInMinutes: number }> => (await apiClient.post<{ ok: true; pendingEmail: string; expiresInMinutes: number }>("/auth/me/email/request", { newEmail }, { requireAuth: true })).data;
export const confirmEmailChange = async (code: string): Promise<{ email: string }> => (await apiClient.post<{ ok: true; email: string }>("/auth/me/email/confirm", { code }, { requireAuth: true })).data;
