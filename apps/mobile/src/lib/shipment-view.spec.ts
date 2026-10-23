/**
 * shipment-view.spec.ts — la fiche de suivi, celle d'A221.
 * ========================================================
 * Ce module est la seule logique du suivi d'un envoi : dix vues pour neuf
 * statuts, la frise, les décomptes, le texte de clôture, l'état de l'argent.
 * Il a été écrit pur EXPRÈS pour être exécuté ici — et il ne l'était pas.
 *
 * Ce que ces fiches protègent en priorité : les deux MENSONGES déjà payés sur
 * le site (ANO-WEB-73 : une médiation titrée « demande annulée » sur un colis
 * livré ; un colis refusé au rendez-vous présenté comme un désistement de
 * l'Expéditeur), et la frontière `null` / `0` sur l'argent.
 */
import {
  TIMELINE_STEPS,
  closureDate,
  closureKey,
  formatZonedTime,
  groupDeliveryCode,
  moneyState,
  remainingUntil,
  shipmentPhase,
  shipmentReference,
  timeline,
  type ShipmentPhase,
} from '@/lib/shipment-view';

import { NOW_MS, aShipment } from '@/test-support/fixtures';

describe('shipmentPhase — dix vues pour neuf statuts', () => {
  it('rend une phase pour chacun des neuf statuts du serveur', () => {
    const statuses = [
      'PENDING',
      'ACCEPTED',
      'PICKED_UP',
      'DELIVERED',
      'COMPLETED',
      'DECLINED',
      'EXPIRED',
      'CANCELLED',
      'DISPUTED',
    ] as const;
    for (const status of statuses) {
      expect(shipmentPhase(aShipment({ status }))).toBeTruthy();
    }
  });

  it('PENDING se raconte comme une ATTENTE, pas comme un statut', () => {
    expect(shipmentPhase(aShipment({ status: 'PENDING' }))).toBe('AWAITING_CARRIER');
  });

  it('PICKED_UP sans étape confirmée parle du CODE, pas du voyage', () => {
    expect(shipmentPhase(aShipment({ status: 'PICKED_UP', trackingEvents: [] }))).toBe('PICKED_UP');
  });

  it('PICKED_UP avec une étape confirmée devient IN_TRANSIT — la seule dérivation client', () => {
    const shipment = aShipment({
      status: 'PICKED_UP',
      trackingEvents: [{ step: 'FLIGHT_DEPARTED', confirmedAt: '2027-03-20T09:00:00.000Z' }],
    });
    expect(shipmentPhase(shipment)).toBe('IN_TRANSIT');
  });
});

describe('timeline — l’étape COURANTE est celle qu’on attend', () => {
  it('ACCEPTED : l’acceptation est acquise, le rendez-vous est en cours', () => {
    const steps = timeline('ACCEPTED');
    expect(steps.map((s) => s.key)).toEqual([...TIMELINE_STEPS]);
    expect(steps.filter((s) => s.done).map((s) => s.key)).toEqual(['accepted']);
    expect(steps.find((s) => s.current)?.key).toBe('pickup');
  });

  it('il y a AU PLUS une étape courante, et aucune quand tout est fini', () => {
    const phases: ShipmentPhase[] = ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'];
    for (const phase of phases) {
      expect(timeline(phase).filter((s) => s.current).length).toBeLessThanOrEqual(1);
    }
    expect(timeline('COMPLETED').every((s) => s.done)).toBe(true);
    expect(timeline('COMPLETED').some((s) => s.current)).toBe(false);
  });

  it('un envoi clos SANS livraison n’a pas de frise — une frise figée au départ laisserait croire à une attente', () => {
    for (const phase of ['AWAITING_CARRIER', 'DECLINED', 'EXPIRED', 'CANCELLED'] as ShipmentPhase[]) {
      expect(timeline(phase)).toEqual([]);
    }
  });

  it('un litige se lit à la VÉRIFICATION, pas au départ : le colis a bien été livré', () => {
    const steps = timeline('DISPUTED');
    expect(steps.filter((s) => s.done).map((s) => s.key)).toEqual([
      'accepted',
      'pickup',
      'transport',
      'delivery',
    ]);
    expect(steps.find((s) => s.current)?.key).toBe('verification');
  });
});

describe('remainingUntil — un décompte, ou rien', () => {
  it('décompose le reste en jours / heures / minutes', () => {
    const target = new Date(NOW_MS + 26 * 3600_000 + 5 * 60_000).toISOString();
    expect(remainingUntil(target, NOW_MS)).toEqual({ days: 1, hours: 2, minutes: 5 });
  });

  it('une échéance PASSÉE ne rend pas « 0 j 0 h 0 min » : elle ne rend rien', () => {
    expect(remainingUntil(new Date(NOW_MS - 1000).toISOString(), NOW_MS)).toBeNull();
    expect(remainingUntil(new Date(NOW_MS).toISOString(), NOW_MS)).toBeNull();
  });

  it('une échéance absente ou illisible ne rend rien non plus', () => {
    expect(remainingUntil(null, NOW_MS)).toBeNull();
    expect(remainingUntil(undefined, NOW_MS)).toBeNull();
    expect(remainingUntil('pas une date', NOW_MS)).toBeNull();
  });
});

describe('closureKey — ne jamais imputer un geste que l’Expéditeur n’a pas fait', () => {
  it('une annulation ordinaire est une annulation', () => {
    const shipment = aShipment({ status: 'CANCELLED' });
    expect(closureKey(shipment, 'CANCELLED')).toBe('cancelled');
  });

  it('ANO-WEB-73 — un remboursement total tranché par la médiation n’est PAS « demande annulée »', () => {
    const shipment = aShipment({
      status: 'CANCELLED',
      dispute: {
        ticketNumber: 'YAM-2041',
        category: 'DAMAGED',
        description: 'Colis ouvert',
        photoUrls: [],
        createdAt: '2027-03-22T10:00:00.000Z',
        resolution: {
          outcome: 'FULL_REFUND',
          refundCents: 2600,
          carrierPayoutCents: 0,
          reason: 'Preuves concluantes',
          resolvedAt: '2027-03-25T10:00:00.000Z',
        },
      },
    });
    expect(closureKey(shipment, 'CANCELLED')).toBe('cancelledByMediation');
  });

  it('une décision de RÉTENTION compte aussi comme une médiation', () => {
    const shipment = aShipment({
      status: 'CANCELLED',
      retentionDecision: {
        outcome: 'RESTITUTE_SHIPPER',
        reason: 'Colis rendu',
        decidedAt: '2027-03-25T10:00:00.000Z',
      },
    });
    expect(closureKey(shipment, 'CANCELLED')).toBe('cancelledByMediation');
  });

  it('un colis REFUSÉ au rendez-vous a son propre texte', () => {
    const shipment = aShipment({ status: 'CANCELLED', pickupRefusalReason: 'Colis non conforme' });
    expect(closureKey(shipment, 'CANCELLED')).toBe('pickupRefused');
  });

  it('la médiation PRIME le refus au rendez-vous (la décision est postérieure)', () => {
    const shipment = aShipment({
      status: 'CANCELLED',
      pickupRefusalReason: 'Colis non conforme',
      retentionDecision: {
        outcome: 'COMPENSATE_CARRIER',
        reason: 'Déplacement indemnisé',
        decidedAt: '2027-03-25T10:00:00.000Z',
      },
    });
    expect(closureKey(shipment, 'CANCELLED')).toBe('cancelledByMediation');
  });

  it('les autres fins portent leur nom', () => {
    expect(closureKey(aShipment({ status: 'PENDING' }), 'AWAITING_CARRIER')).toBe('awaiting');
    expect(closureKey(aShipment({ status: 'DECLINED' }), 'DECLINED')).toBe('declined');
    expect(closureKey(aShipment({ status: 'EXPIRED' }), 'EXPIRED')).toBe('expired');
    expect(closureKey(aShipment({ status: 'COMPLETED' }), 'COMPLETED')).toBe('completed');
    expect(closureKey(aShipment({ status: 'DISPUTED' }), 'DISPUTED')).toBe('disputed');
  });
});

describe('closureDate — la date qui DATE la clôture', () => {
  it('une attente est datée par son ÉCHÉANCE, pas par sa création', () => {
    const shipment = aShipment({ expiresAt: '2027-03-16T09:00:00.000Z' });
    expect(closureDate(shipment, 'AWAITING_CARRIER')).toBe('2027-03-16T09:00:00.000Z');
  });

  it('un envoi terminé retombe sur la livraison quand la complétion n’est pas servie', () => {
    const shipment = aShipment({
      status: 'COMPLETED',
      deliveredAt: '2027-03-21T10:00:00.000Z',
      completedAt: null,
    });
    expect(closureDate(shipment, 'COMPLETED')).toBe('2027-03-21T10:00:00.000Z');
  });

  it('les autres fins sont datées par closedAt, et jamais par du vide', () => {
    expect(closureDate(aShipment({ closedAt: '2027-03-17T10:00:00.000Z' }), 'CANCELLED')).toBe(
      '2027-03-17T10:00:00.000Z'
    );
    expect(closureDate(aShipment({ closedAt: null }), 'CANCELLED')).toBeNull();
  });
});

describe('moneyState — 0 est une information, null est une absence', () => {
  it('avant la capture, l’argent est AUTORISÉ et non débité (D39)', () => {
    const state = moneyState(aShipment({ capturedAt: null }));
    expect(state.authorizedOnly).toBe(true);
    expect(state.capturedAt).toBeNull();
  });

  it('un remboursement de 0 ne se confond pas avec « la question ne se pose pas »', () => {
    expect(moneyState(aShipment({ refundAmountCents: 0 })).refundedCents).toBe(0);
    expect(moneyState(aShipment({})).refundedCents).toBeNull();
  });

  it('les fonds sont gelés par le statut DISPUTED autant que par le payoutStatus', () => {
    expect(moneyState(aShipment({ status: 'DISPUTED' })).frozen).toBe(true);
    expect(moneyState(aShipment({ payoutStatus: 'FROZEN' })).frozen).toBe(true);
    expect(moneyState(aShipment({ status: 'COMPLETED', payoutStatus: 'SENT' })).frozen).toBe(false);
  });
});

describe('formatZonedTime — l’heure du BILLET (D24)', () => {
  it('lit l’heure dans le fuseau du LIEU, pas dans celui du téléphone', () => {
    // 08:30 UTC = 09:30 à Paris, 09:30 aussi à Brazzaville (UTC+1 l’hiver).
    expect(formatZonedTime('2027-03-20T08:30:00.000Z', 'Europe/Paris')).toBe('09:30');
    expect(formatZonedTime('2027-03-20T08:30:00.000Z', 'Asia/Tokyo')).toBe('17:30');
  });

  it('un fuseau inconnu du moteur retombe sur l’appareil, jamais sur une heure inventée', () => {
    expect(formatZonedTime('2027-03-20T08:30:00.000Z', 'Mars/Olympus_Mons')).toMatch(/^\d{2}:\d{2}$/);
  });

  it('une date absente ou illisible ne rend rien', () => {
    expect(formatZonedTime(null, 'Europe/Paris')).toBe('');
    expect(formatZonedTime('pas une date', 'Europe/Paris')).toBe('');
  });
});

describe('les deux mises en forme qu’on lit à voix haute', () => {
  it('la référence est courte, en majuscules — de quoi citer l’envoi au support', () => {
    expect(shipmentReference('68c0ffee68c0ffee68c0abcd')).toBe('C0ABCD');
  });

  it('le code se dicte en deux groupes de trois', () => {
    expect(groupDeliveryCode('742891')).toBe('742 891');
  });

  it('ce qui n’a pas six chiffres n’est pas regroupé — on n’invente pas un format', () => {
    expect(groupDeliveryCode('7428')).toBe('7428');
    expect(groupDeliveryCode('')).toBe('');
  });
});
