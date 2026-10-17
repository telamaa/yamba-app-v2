/**
 * report.api.ts — signaler une annonce ou un membre (D68).
 * =========================================================
 * MÊME endpoint que le web : `POST /reports` (auth-service). Membre
 * uniquement — « un signalement est toujours signé : cela protège tout le
 * monde des abus ». Les motifs sont FERMÉS par type de cible (SIG-01) et le
 * serveur refuse tout motif hors liste ; la personne signalée n'apprend
 * jamais qui l'a signalée.
 *
 * Les refus parlent par `details.code` (RG-MOB-1) : `OWN_TARGET` (sa propre
 * annonce), 409 pour un doublon déjà ouvert, 404 pour une cible devenue
 * invisible.
 */
import { apiFetch } from './client';

export type ReportTargetType = 'TRIP' | 'USER';
export type ReportReason =
  | 'ILLEGAL_CONTENT'
  | 'SCAM'
  | 'INAPPROPRIATE'
  | 'IMPERSONATION'
  | 'OTHER';

/** Les motifs proposés par cible — miroir de `REPORT_REASONS_BY_TARGET`. */
export const REPORT_REASONS_BY_TARGET: Record<ReportTargetType, readonly ReportReason[]> = {
  TRIP: ['ILLEGAL_CONTENT', 'SCAM', 'INAPPROPRIATE', 'OTHER'],
  USER: ['SCAM', 'INAPPROPRIATE', 'IMPERSONATION', 'OTHER'],
};

export type CreateReportInput = {
  targetType: ReportTargetType;
  /** L'identifiant PUBLIC : l'id d'un trajet, le slug d'un membre. */
  targetRef: string;
  reason: ReportReason;
  details?: string;
};

export function createReport(
  input: CreateReportInput
): Promise<{ reportId: string; createdAt: string }> {
  return apiFetch<{ reportId: string; createdAt: string }>('/reports', {
    method: 'POST',
    body: input,
  });
}
