/**
 * rating.api.ts
 * =============
 * Mock API du module de notation. Backend futur : persistance de l'avis,
 * règle du double-aveugle (révélation quand les 2 ont noté ou après 14j),
 * mise à jour de la moyenne du profil public.
 */

import type { RatingContext, SubmitRatingPayload } from "./rating.types";

const MOCK_DELAY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Charge le contexte de notation.
 * Mock : rôle noté déduit de l'id — un dealId contenant "shipper" charge
 * le contexte "le Voyageur note Aminata", sinon "l'Expéditrice note Thomas".
 *  - /fr/bookings/completed123/rate       → noter Thomas (CARRIER)
 *  - /fr/carrier/deals/shipper123/rate    → noter Aminata (SHIPPER)
 */
export async function getRatingContext(dealId: string): Promise<RatingContext> {
  await sleep(MOCK_DELAY_MS);

  if (dealId.includes("shipper")) {
    return {
      dealId,
      ratedRole: "SHIPPER",
      person: {
        id: "user_aminata",
        firstName: "Aminata",
        lastInitial: "T",
        rating: 4.8,
        dealCount: 12,
        isVerified: true,
      },
      originCity: "Paris",
      destinationCity: "Brazzaville",
      completedAt: new Date().toISOString(),
      raterName: "Thomas M.",
      amountEur: 89.30,
    };
  }

  return {
    dealId,
    ratedRole: "CARRIER",
    person: {
      id: "user_thomas",
      firstName: "Thomas",
      lastInitial: "M",
      rating: 4.9,
      dealCount: 23,
      isVerified: true,
    },
    originCity: "Paris",
    destinationCity: "Brazzaville",
    completedAt: new Date().toISOString(),
    raterName: "Aminata T.",
    amountEur: 103.75,
  };
}

export async function submitRating(
  dealId: string,
  payload: SubmitRatingPayload
): Promise<{ dealId: string; submittedAt: string }> {
  await sleep(MOCK_DELAY_MS);
  if (payload.overallStars < 1 || payload.overallStars > 5) {
    throw new Error("INVALID_STARS");
  }
  // eslint-disable-next-line no-console
  console.info("[rating] submitRating mock:", { dealId, payload });
  return { dealId, submittedAt: new Date().toISOString() };
}
