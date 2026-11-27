/**
 * phone-reveal.rules.ts — le numéro se révèle tard (chantier F, D61 4A)
 * =====================================================================
 * Le jour du rendez-vous, dans un aéroport, le canal qui marche est le téléphone. Plutôt que
 * de laisser les deux parties s'échanger leur numéro dans le fil (et rendre toute détection
 * absurde), la plateforme l'ouvre elle-même, tard, entre les deux parties, et le trace.
 * Ancre : le début du rendez-vous de PRISE EN CHARGE accepté (`kind: "PICKUP"`, voir
 * `revealPhone`) ; à défaut, le départ du trajet.
 *
 * D118 3B — cette ligne disait « rendez-vous de REMISE » et nommait l'autre bout du
 * transport : dans ce dépôt, la REMISE est le geste FINAL vers le destinataire (D43,
 * D116) et la PRISE EN CHARGE le premier. Le code a toujours filtré `PICKUP`, et il a
 * raison — au moment de la remise, c'est le DESTINATAIRE qu'on appelle, et son numéro
 * vient du deal, pas de la conversation. Une ligne de commentaire qui nomme le mauvais
 * objet est pire qu'une absence de commentaire : elle finit recopiée dans un client.
 */
import { PHONE_REVEAL_LEAD_HOURS } from "@packages/api-contracts";

export type RevealAnchor = { pickupStartAt: Date | null; departureAt: Date | null };
export type RevealWindow = { allowed: boolean; opensAt: Date | null; reason: string | null };

export function revealAnchorOf(a: RevealAnchor): Date | null {
  return a.pickupStartAt ?? a.departureAt ?? null;
}

/** `leadHours` : paramètre `messaging.phoneRevealLeadHours` (D62). */
export function phoneRevealWindow(a: RevealAnchor, now: Date, leadHours: number = PHONE_REVEAL_LEAD_HOURS): RevealWindow {
  const anchor = revealAnchorOf(a);
  if (!anchor) return { allowed: false, opensAt: null, reason: "NO_ANCHOR" };
  const opensAt = new Date(anchor.getTime() - leadHours * 3_600_000);
  return now.getTime() >= opensAt.getTime()
    ? { allowed: true, opensAt, reason: null }
    : { allowed: false, opensAt, reason: "TOO_EARLY" };
}
