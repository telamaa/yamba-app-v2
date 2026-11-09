/**
 * shipment-view.ts — ce que l'écran de suivi DÉDUIT, et rien d'autre.
 * ====================================================================
 * Fonctions PURES, sans React ni react-native : la fiche se contente de les
 * lire. La frontière est volontaire — c'est ici que vit la seule logique du
 * suivi, donc le seul endroit qu'un test devra exécuter le jour où le mobile
 * aura ses tests (aucun à ce jour : la logique est prête, pas le harnais).
 *
 * Ce que ce module calcule :
 *   • la PHASE d'affichage — neuf statuts serveur, dix vues : `PICKED_UP`
 *     se dédouble selon que le Voyageur a confirmé des étapes de voyage
 *     (le code vient d'arriver → on parle du code ; le colis voyage → on
 *     parle du voyage). `IN_TRANSIT` n'existe PAS côté serveur : c'est une
 *     dérivation d'affichage, assumée ici et nulle part ailleurs ;
 *   • la frise des cinq étapes et celle qui est en cours ;
 *   • les décomptes (fin de la fenêtre d'acceptation, versement à J+4) ;
 *   • le texte de clôture — un remboursement total tranché par la médiation
 *     clôt le deal en `CANCELLED` : titrer « demande annulée » sur un colis
 *     livré serait un mensonge (c'est l'ANO-WEB-73 du site).
 *
 * Ce que ce module ne fait JAMAIS : décider ce qui est permis. Les gestes
 * viennent de `allowedActions`, servi par la machine d'état (RG-MOB-1).
 */
import type { SupportedLocale } from '@packages/api-contracts/locale';

import type { ShipperShipmentDto } from '@/lib/api/shipment.api';

/* ── La phase d'affichage ────────────────────────────────────────────────── */

export type ShipmentPhase =
  | 'AWAITING_CARRIER'
  | 'ACCEPTED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'DISPUTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'CANCELLED';

export function shipmentPhase(shipment: ShipperShipmentDto): ShipmentPhase {
  switch (shipment.status) {
    case 'PENDING':
      return 'AWAITING_CARRIER';
    case 'PICKED_UP':
      // La seule dérivation client de tout l'écran — et elle ne change que
      // le DISCOURS, jamais un droit : les deux vues lisent le même deal.
      return shipment.trackingEvents.length > 0 ? 'IN_TRANSIT' : 'PICKED_UP';
    case 'ACCEPTED':
      return 'ACCEPTED';
    case 'DELIVERED':
      return 'DELIVERED';
    case 'COMPLETED':
      return 'COMPLETED';
    case 'DISPUTED':
      return 'DISPUTED';
    case 'DECLINED':
      return 'DECLINED';
    case 'EXPIRED':
      return 'EXPIRED';
    case 'CANCELLED':
      return 'CANCELLED';
  }
}

/* ── La frise des cinq étapes ────────────────────────────────────────────── */

export const TIMELINE_STEPS = [
  'accepted',
  'pickup',
  'transport',
  'delivery',
  'verification',
] as const;

export type TimelineStepKey = (typeof TIMELINE_STEPS)[number];

export type TimelineStepState = {
  key: TimelineStepKey;
  /** Franchie : le serveur a posé le jalon correspondant. */
  done: boolean;
  /** Là où l'on en est — exactement une étape, ou aucune si tout est fini. */
  current: boolean;
};

/**
 * L'étape COURANTE est celle qu'on attend, pas la dernière franchie : sur
 * `ACCEPTED`, l'acceptation est acquise et c'est le rendez-vous qui est en
 * cours. Un envoi clos sans livraison (refusé, expiré, annulé) n'a pas de
 * frise : la fonction rend une liste vide plutôt qu'une frise figée au départ,
 * qui laisserait croire à une attente.
 */
export function timeline(phase: ShipmentPhase): TimelineStepState[] {
  const reached: Record<ShipmentPhase, number> = {
    AWAITING_CARRIER: -1,
    ACCEPTED: 0,
    PICKED_UP: 1,
    IN_TRANSIT: 2,
    DELIVERED: 3,
    COMPLETED: 4,
    DISPUTED: 3,
    DECLINED: -1,
    EXPIRED: -1,
    CANCELLED: -1,
  };
  if (reached[phase] < 0) return [];

  const lastDone = reached[phase];
  return TIMELINE_STEPS.map((key, index) => ({
    key,
    done: index <= lastDone,
    current: index === lastDone + 1,
  }));
}

/* ── Décomptes ───────────────────────────────────────────────────────────── */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export type Remaining = { days: number; hours: number; minutes: number };

/**
 * Ce qu'il reste avant une échéance SERVIE par le serveur. `null` quand
 * l'échéance est passée ou illisible — l'appelant montre alors autre chose
 * qu'un décompte à zéro, qui ne veut rien dire.
 */
export function remainingUntil(targetIso: string | null | undefined, nowMs: number): Remaining | null {
  if (!targetIso) return null;
  const target = new Date(targetIso).getTime();
  if (Number.isNaN(target)) return null;
  const diff = target - nowMs;
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / DAY_MS),
    hours: Math.floor((diff % DAY_MS) / HOUR_MS),
    minutes: Math.floor((diff % HOUR_MS) / MINUTE_MS),
  };
}

/* ── Clôture : le bon texte pour la bonne fin ────────────────────────────── */

export type ClosureKey =
  | 'awaiting'
  | 'declined'
  | 'pickupRefused'
  | 'expired'
  | 'cancelled'
  | 'cancelledByMediation'
  | 'completed'
  | 'disputed';

/**
 * Deux pièges, payés sur le site :
 *   • un remboursement total décidé par la médiation clôt le deal en
 *     `CANCELLED` — « Demande annulée · cette demande est close » titrait
 *     alors une décision rendue sur un colis bel et bien livré (ANO-WEB-73) ;
 *   • un colis REFUSÉ au rendez-vous est aussi une annulation côté machine,
 *     mais ce n'est pas l'Expéditeur qui s'est désisté : le dire autrement
 *     évite de lui imputer un geste qu'il n'a pas fait.
 */
export function closureKey(shipment: ShipperShipmentDto, phase: ShipmentPhase): ClosureKey {
  switch (phase) {
    case 'AWAITING_CARRIER':
      return 'awaiting';
    case 'DECLINED':
      return 'declined';
    case 'EXPIRED':
      return 'expired';
    case 'COMPLETED':
      return 'completed';
    case 'DISPUTED':
      return 'disputed';
    case 'CANCELLED': {
      if (shipment.dispute?.resolution || shipment.retentionDecision) return 'cancelledByMediation';
      if (shipment.pickupRefusalReason) return 'pickupRefused';
      return 'cancelled';
    }
    default:
      return 'completed';
  }
}

/** La date qui DATE la clôture : celle de l'échéance pour une attente. */
export function closureDate(shipment: ShipperShipmentDto, phase: ShipmentPhase): string | null {
  if (phase === 'AWAITING_CARRIER') return shipment.expiresAt;
  if (phase === 'COMPLETED') return shipment.completedAt ?? shipment.deliveredAt ?? null;
  if (phase === 'DISPUTED') return shipment.disputedAt ?? null;
  return shipment.closedAt ?? null;
}

/* ── Argent : ce qui a été débité, ce qui a été rendu ─────────────────────── */

export type MoneyState = {
  /** Autorisé mais PAS ENCORE débité : la carte n'est touchée qu'à l'acceptation (D39). */
  authorizedOnly: boolean;
  capturedAt: string | null;
  refundedCents: number | null;
  retainedCents: number | null;
  /** Les fonds sont gelés le temps d'un examen. */
  frozen: boolean;
};

export function moneyState(shipment: ShipperShipmentDto): MoneyState {
  return {
    authorizedOnly: !shipment.capturedAt,
    capturedAt: shipment.capturedAt ?? null,
    // 0 est une information (« rien n'a été rendu »), pas une absence : on ne
    // le confond pas avec `null` (« la question ne se pose pas »).
    refundedCents: shipment.refundAmountCents ?? null,
    retainedCents: shipment.retentionCents ?? null,
    frozen: shipment.payoutStatus === 'FROZEN' || shipment.status === 'DISPUTED',
  };
}

/* ── Heures locales du LIEU (D24) ────────────────────────────────────────── */

/**
 * « 14:05 » dans le fuseau du lieu — pas dans celui du téléphone. Un
 * Expéditeur à Paris qui lit l'heure d'un décollage de Brazzaville doit lire
 * l'heure du BILLET.
 *
 * `Intl.DateTimeFormat` avec `timeZone` est natif sur les deux OS (Hermes
 * délègue à l'ICU de la plateforme), mais les données de fuseau peuvent
 * manquer : à défaut, on retombe sur l'heure de l'appareil plutôt que de ne
 * rien afficher, et jamais sur une heure inventée.
 */
export function formatZonedTime(
  iso: string | null | undefined,
  timezone: string | null | undefined,
  locale: SupportedLocale = 'fr'
): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const tag = locale === 'fr' ? 'fr-FR' : 'en-US';
  if (timezone) {
    try {
      return new Intl.DateTimeFormat(tag, {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone,
        hour12: locale !== 'fr',
      }).format(date);
    } catch {
      // Fuseau inconnu du moteur : on continue avec l'heure de l'appareil.
    }
  }
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/* ── Petites mises en forme partagées ───────────────────────────────────── */

/** Les six derniers caractères, en majuscules : de quoi citer l'envoi au
 *  support. L'identifiant entier ne se lit pas à voix haute. */
export function shipmentReference(id: string): string {
  return id.slice(-6).toUpperCase();
}

/** Le code à six chiffres, groupé « 742 891 » : c'est ainsi qu'il se dicte. */
export function groupDeliveryCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}
