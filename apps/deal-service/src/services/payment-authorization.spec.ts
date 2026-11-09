/**
 * payment-authorization.spec.ts — « attends » n'est pas « c'est raté » (D82 7A/8A)
 * ================================================================================
 * Le défaut que ce test ferme n'existait pas tant qu'on ne payait qu'à la carte.
 *
 * Ordre des gestes : empreinte d'abord, réservation ensuite (A45, D31). À la carte, les deux
 * sont séparés par quelques millisecondes et l'intention est déjà `requires_capture` quand
 * `POST /deals` la relit. Klarna et PayPal, eux, **redirigent** : le membre revient dans
 * l'app ou sur la page, et l'empreinte peut n'être encore qu'en `processing`.
 *
 * Sous l'ancien code, ce cas tombait dans le même refus que « cette autorisation n'existe
 * pas » — `PAYMENT_NOT_AUTHORIZED`. Le front annonçait donc un échec de paiement à quelqu'un
 * qui venait de payer, et lui faisait tout reprendre. D'où un code distinct, RÉESSAYABLE,
 * qui porte le délai à attendre.
 *
 * Sections : A. le seul statut qui laisse créer · B. le refus réessayable · C. les refus
 * terminaux · D. l'invariant (aucun statut ne contourne la règle).
 */
import type { PaymentAuthorizationStatus } from "@packages/payments";
import { BookingRequestError, PAYMENT_PROCESSING_RETRY_SECONDS, assertAuthorizationUsable } from "./booking-request";

/** Le refus, décortiqué comme le client le recevra (409 + details). */
function refus(status: PaymentAuthorizationStatus) {
  try {
    assertAuthorizationUsable(status);
    return null;
  } catch (err) {
    const e = err as BookingRequestError & { statusCode?: number; details?: Record<string, unknown> };
    return { code: e.code, statusCode: e.statusCode, details: e.details };
  }
}

describe("autorisation utilisable — A. le seul statut qui laisse créer la réservation", () => {
  it("AUTHORIZED passe : l'empreinte est réellement posée", () => {
    expect(() => assertAuthorizationUsable("AUTHORIZED")).not.toThrow();
  });
});

describe("autorisation utilisable — B. le refus RÉESSAYABLE", () => {
  it("PROCESSING donne PAYMENT_PROCESSING, pas PAYMENT_NOT_AUTHORIZED", () => {
    expect(refus("PROCESSING")?.code).toBe("PAYMENT_PROCESSING");
  });

  it("il porte le délai à attendre, pour que le front attende au lieu d'annoncer un échec", () => {
    expect(refus("PROCESSING")?.details).toMatchObject({
      type: "booking",
      code: "PAYMENT_PROCESSING",
      paymentStatus: "PROCESSING",
      retryAfterSeconds: PAYMENT_PROCESSING_RETRY_SECONDS,
    });
  });

  it("c'est un 409 métier dont le code ATTEINT le client (A146 : `details.code` est exposé)", () => {
    const r = refus("PROCESSING");
    expect(r?.statusCode).toBe(409);
    expect(typeof (r?.details as { code?: unknown })?.code).toBe("string");
  });

  it("le délai est court — un réessai ne coûte qu'une lecture chez le fournisseur", () => {
    expect(PAYMENT_PROCESSING_RETRY_SECONDS).toBeGreaterThan(0);
    expect(PAYMENT_PROCESSING_RETRY_SECONDS).toBeLessThanOrEqual(10);
  });
});

describe("autorisation utilisable — C. les refus terminaux", () => {
  it.each<PaymentAuthorizationStatus>(["REQUIRES_PAYMENT_METHOD", "CANCELED", "CAPTURED", "UNKNOWN"])(
    "%s donne PAYMENT_NOT_AUTHORIZED : il faut repasser par le paiement",
    (status) => {
      expect(refus(status)?.code).toBe("PAYMENT_NOT_AUTHORIZED");
    }
  );

  it("un refus terminal ne promet AUCUN réessai (pas de délai dans les détails)", () => {
    expect(refus("CANCELED")?.details).not.toHaveProperty("retryAfterSeconds");
  });

  it("CAPTURED est refusé lui aussi : une empreinte déjà débitée ne peut pas naître en réservation", () => {
    // Le débit n'a lieu qu'à l'acceptation du Voyageur (D31/D39) : capturé AVANT la
    // réservation, c'est une anomalie, pas un raccourci.
    expect(refus("CAPTURED")?.code).toBe("PAYMENT_NOT_AUTHORIZED");
  });
});

describe("autorisation utilisable — D. l'invariant", () => {
  it("TOUT statut autre qu'AUTHORIZED est refusé — pas de réservation sans empreinte posée", () => {
    const tous: PaymentAuthorizationStatus[] = [
      "REQUIRES_PAYMENT_METHOD",
      "PROCESSING",
      "CAPTURED",
      "CANCELED",
      "UNKNOWN",
    ];
    for (const status of tous) expect(refus(status)).not.toBeNull();
    expect(refus("AUTHORIZED")).toBeNull();
  });
});
