import { buildCorridors, buildSeries, isoWeekKey, isoWeekStart, periodBounds, periodsBetween, ratePct } from "./pilotage.rules";

const d = (s: string) => new Date(s);
describe("pilotage.rules (C-PR6a, D59)", () => {
  it("isoWeekStart / isoWeekKey : lundi UTC, semaine ISO (jeudi de référence, passage d'année)", () => {
    expect(isoWeekStart(d("2026-09-04T10:00:00Z")).toISOString()).toBe("2026-08-31T00:00:00.000Z"); // vendredi → lundi
    expect(isoWeekStart(d("2026-08-31T00:00:00Z")).toISOString()).toBe("2026-08-31T00:00:00.000Z");
    expect(isoWeekKey(isoWeekStart(d("2026-09-04T10:00:00Z")))).toBe("2026-W36");
    expect(isoWeekKey(isoWeekStart(d("2027-01-01T10:00:00Z")))).toBe("2026-W53");
    expect(isoWeekKey(isoWeekStart(d("2026-01-01T10:00:00Z")))).toBe("2026-W01");
  });
  it("periodsBetween : périodes vides comprises, bornes respectées", () => {
    expect(periodsBetween(d("2026-07-15T00:00:00Z"), d("2026-10-01T00:00:00Z"), "month").map((x) => x.toISOString().slice(0, 7))).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(periodsBetween(d("2026-08-31T00:00:00Z"), d("2026-09-14T00:00:00Z"), "week")).toHaveLength(2);
  });
  it("buildSeries : chaque fait dans SA période, volume par devise, semaines vides à zéro", () => {
    const pts = buildSeries(
      {
        userCreatedAts: [d("2026-09-01T10:00:00Z"), d("2026-09-09T10:00:00Z"), d("2026-06-01T00:00:00Z")],
        tripPublishedAts: [d("2026-09-02T10:00:00Z")],
        bookings: [
          { requestedAt: d("2026-09-02T10:00:00Z"), acceptedAt: d("2026-09-03T10:00:00Z"), deliveredAt: d("2026-09-10T10:00:00Z"), completedAt: d("2026-09-12T10:00:00Z"), capturedAt: d("2026-09-03T10:00:00Z"), status: "COMPLETED", pricing: { totalShipperCents: 2957, currencyCode: "EUR" } },
          { requestedAt: d("2026-09-02T11:00:00Z"), closedAt: d("2026-09-04T10:00:00Z"), disputedAt: null, capturedAt: d("2026-09-02T12:00:00Z"), status: "CANCELLED", pricing: { totalShipperCents: 1000, currencyCode: "USD" } },
        ],
      },
      d("2026-08-31T00:00:00Z"), d("2026-09-21T00:00:00Z"), "week"
    );
    expect(pts.map((p) => p.period)).toEqual(["2026-W36", "2026-W37", "2026-W38"]);
    expect(pts[0]).toMatchObject({ signups: 1, tripsPublished: 1, requests: 2, accepted: 1, cancelled: 1, delivered: 0, completed: 0, volume: [{ currencyCode: "EUR", capturedCents: 2957 }, { currencyCode: "USD", capturedCents: 1000 }] });
    expect(pts[1]).toMatchObject({ signups: 1, delivered: 1, completed: 1, volume: [] });
    expect(pts[2]).toMatchObject({ signups: 0, requests: 0 });
  });
  it("C-PR6d (D74) : ratePct — un taux entier, et null quand le dénominateur est vide (jamais 0 % pour « on ne sait pas »)", () => {
    expect(ratePct(1, 3)).toBe(33);
    expect(ratePct(2, 3)).toBe(67);
    expect(ratePct(0, 4)).toBe(0);
    expect(ratePct(0, 0)).toBeNull();
    expect(ratePct(5, 0)).toBeNull();
  });
  it("C-PR6d (D74) : taux d'acceptation sur la cohorte de la DEMANDE — en attente et annulée par l'Expéditeur n'entrent dans aucun compteur", () => {
    const pts = buildSeries(
      {
        userCreatedAts: [], tripPublishedAts: [],
        bookings: [
          // Demandée puis acceptée : compte comme acceptée dans la semaine de la DEMANDE, pas de la réponse.
          { requestedAt: d("2026-09-01T10:00:00Z"), acceptedAt: d("2026-09-08T10:00:00Z"), status: "ACCEPTED", pricing: { totalShipperCents: 2957, currencyCode: "EUR" } },
          { requestedAt: d("2026-09-02T10:00:00Z"), acceptedAt: null, status: "DECLINED", closedAt: d("2026-09-02T12:00:00Z"), pricing: { totalShipperCents: 2957, currencyCode: "EUR" } },
          { requestedAt: d("2026-09-03T10:00:00Z"), acceptedAt: null, status: "EXPIRED", closedAt: d("2026-09-04T10:00:00Z"), pricing: { totalShipperCents: 2957, currencyCode: "EUR" } },
          // Encore en attente : le Voyageur n'a rien décidé.
          { requestedAt: d("2026-09-04T10:00:00Z"), acceptedAt: null, status: "PENDING", pricing: { totalShipperCents: 2957, currencyCode: "EUR" } },
          // Annulée par l'Expéditeur avant réponse : pas une décision du Voyageur non plus.
          { requestedAt: d("2026-09-05T10:00:00Z"), acceptedAt: null, status: "CANCELLED", closedAt: d("2026-09-05T11:00:00Z"), pricing: { totalShipperCents: 2957, currencyCode: "EUR" } },
        ],
      },
      d("2026-08-31T00:00:00Z"), d("2026-09-14T00:00:00Z"), "week"
    );
    expect(pts[0]).toMatchObject({ requests: 5, requestsAccepted: 1, requestsDeclined: 1, requestsExpired: 1, acceptanceRatePct: 33 });
    // L'acceptation elle-même reste comptée à SA date : la courbe « Acceptations » ne change pas.
    expect(pts[1]).toMatchObject({ accepted: 1, requests: 0, acceptanceRatePct: null });
  });
  it("C-PR6d (D74) : taux de litige sur la cohorte de la LIVRAISON ; sans livraison, le taux est null et non zéro", () => {
    const pts = buildSeries(
      {
        userCreatedAts: [], tripPublishedAts: [],
        bookings: [
          { requestedAt: d("2026-09-01T09:00:00Z"), deliveredAt: d("2026-09-01T10:00:00Z"), disputedAt: d("2026-09-09T10:00:00Z"), status: "DISPUTED", pricing: { totalShipperCents: 2957, currencyCode: "EUR" } },
          { requestedAt: d("2026-09-02T09:00:00Z"), deliveredAt: d("2026-09-02T10:00:00Z"), disputedAt: null, status: "COMPLETED", pricing: { totalShipperCents: 2957, currencyCode: "EUR" } },
          { requestedAt: d("2026-09-03T09:00:00Z"), deliveredAt: d("2026-09-03T10:00:00Z"), disputedAt: null, status: "COMPLETED", pricing: { totalShipperCents: 2957, currencyCode: "EUR" } },
          { requestedAt: d("2026-09-04T09:00:00Z"), deliveredAt: d("2026-09-04T10:00:00Z"), disputedAt: null, status: "COMPLETED", pricing: { totalShipperCents: 2957, currencyCode: "EUR" } },
        ],
      },
      d("2026-08-31T00:00:00Z"), d("2026-09-14T00:00:00Z"), "week"
    );
    expect(pts[0]).toMatchObject({ delivered: 4, deliveredDisputed: 1, disputeRatePct: 25 });
    // Le litige est ouvert la semaine suivante : il compte dans « Litiges » à sa date, mais pas au numérateur d'un taux sans livraison.
    expect(pts[1]).toMatchObject({ disputes: 1, delivered: 0, deliveredDisputed: 0, disputeRatePct: null });
  });
  it("buildCorridors : agrégats par ville>ville, taux et prix au kilo, corridors demandés sans offre, tri par demande", () => {
    const trip = { originCity: "Paris", originCountryCode: "FR", destinationCity: "Brazzaville", destinationCountryCode: "CG" };
    const stats = new Map([["paris>brazzaville", { views: 12, searches: 30, noResult: 0 }], ["paris>kinshasa", { views: 0, searches: 9, noResult: 9 }]]);
    const out = buildCorridors({
      trips: [trip, trip, { ...trip, destinationCity: "Pointe-Noire" }],
      bookings: [
        { trip, acceptedAt: d("2026-09-01T00:00:00Z"), disputedAt: null, pricing: { weightKg: 2, transportCents: 2400, pricePerKgCents: 1200, currencyCode: "EUR" } },
        { trip, acceptedAt: null, disputedAt: null, pricing: { weightKg: 4, transportCents: 4000, pricePerKgCents: null, currencyCode: "EUR" } },
        { trip: { ...trip, destinationCity: "Pointe-Noire" }, acceptedAt: d("2026-09-01T00:00:00Z"), disputedAt: d("2026-09-05T00:00:00Z"), pricing: { weightKg: 1, transportCents: 1500, pricePerKgCents: null, currencyCode: "EUR" } },
      ],
      searchedCorridors: ["paris>kinshasa", "paris>brazzaville"],
      stats,
    });
    expect(out.map((c) => c.key)).toEqual(["paris>brazzaville", "paris>pointe-noire", "paris>kinshasa"]);
    expect(out[0]).toMatchObject({ tripsPublished: 2, requests: 2, accepted: 1, acceptanceRatePct: 50, avgPricePerKgCents: 1100, currencyCode: "EUR", disputes: 0, views: 12, searches: 30, searchesNoResult: 0 });
    expect(out[1]).toMatchObject({ tripsPublished: 1, requests: 1, acceptanceRatePct: 100, avgPricePerKgCents: 1500, disputes: 1 });
    expect(out[2]).toMatchObject({ originCity: "paris", destinationCity: "kinshasa", tripsPublished: 0, requests: 0, acceptanceRatePct: null, avgPricePerKgCents: null, searches: 9, searchesNoResult: 9 });
  });
  it("C-PR6c : periodBounds inverse periodKey (semaine ISO, mois) ; clé invalide → null", () => {
    expect(periodBounds("2026-W36", "week")).toEqual({ start: d("2026-08-31T00:00:00Z"), end: d("2026-09-07T00:00:00Z") });
    expect(periodBounds("2026-W53", "week")?.start.toISOString()).toBe("2026-12-28T00:00:00.000Z");
    expect(periodBounds("2026-09", "month")).toEqual({ start: d("2026-09-01T00:00:00Z"), end: d("2026-10-01T00:00:00Z") });
    expect(periodBounds("2026-W60", "week")).toBeNull();
    expect(periodBounds("2026-13", "month")).toBeNull();
    expect(periodBounds("x", "week")).toBeNull();
  });
  it("C-PR6c (D60 4A) : finances par période et devise — encaissé, remboursé, versé, revenu, retenues, chaque fait à sa date", () => {
    const pts = buildSeries(
      { userCreatedAts: [], tripPublishedAts: [], bookings: [
        { requestedAt: d("2026-09-01T10:00:00Z"), capturedAt: d("2026-09-01T12:00:00Z"), completedAt: d("2026-09-09T10:00:00Z"), payoutStatus: "SENT", payoutAmountCents: 2000, payoutSentAt: d("2026-09-09T10:01:00Z"), status: "COMPLETED", pricing: { totalShipperCents: 2957, currencyCode: "EUR", commissionCents: 957, premiumCents: 0 } },
        { requestedAt: d("2026-09-02T10:00:00Z"), capturedAt: d("2026-09-02T12:00:00Z"), closedAt: d("2026-09-03T10:00:00Z"), refundedAt: d("2026-09-03T10:00:00Z"), refundAmountCents: 1479, retentionCents: 1478, status: "CANCELLED", pricing: { totalShipperCents: 2957, currencyCode: "EUR", commissionCents: 957, premiumCents: 0 } },
      ] },
      d("2026-08-31T00:00:00Z"), d("2026-09-14T00:00:00Z"), "week"
    );
    expect(pts[0].finance).toEqual([{ currencyCode: "EUR", capturedCents: 5914, refundedCents: 1479, paidOutCents: 0, revenueCents: 0, retentionCents: 1478 }]);
    expect(pts[1].finance).toEqual([{ currencyCode: "EUR", capturedCents: 0, refundedCents: 0, paidOutCents: 2000, revenueCents: 957, retentionCents: 0 }]);
  });
});
