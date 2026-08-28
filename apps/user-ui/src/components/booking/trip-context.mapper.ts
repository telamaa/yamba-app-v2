/**
 * trip-context.mapper.ts — PublicTrip (API) → TripContext (wizard).
 * Remplace le mock : le wizard réserve sur le VRAI trajet (D17 : le devis
 * front et le snapshot serveur partent des mêmes cents).
 */
import type { PublicTrip } from "@/lib/public-trip.types";
import type { FamilyStance, LocationPoint, ParcelCategory, ParcelFamily, TripContext } from "./booking.types";
import { PARCEL_FAMILIES } from "./booking.types";

export type MapperT = (key: string, values?: Record<string, string | number>) => string;

function toLocationPoints(points: PublicTrip["pickupLocations"], t: MapperT): LocationPoint[] {
  return (points ?? []).map((p, i) => ({
    id: `${p.kind}-${i}`,
    kind: p.kind === "AIRPORT" ? "AIRPORT" : p.kind === "TRAIN_STATION" ? "TRAIN_STATION" : "ADDRESS",
    label: p.kind === "AIRPORT" ? t("atAirport") : p.kind === "TRAIN_STATION" ? t("atTrainStation") : t("inTheCity"),
    subLabel: p.details ?? undefined,
    addressShort:
      p.flexibility === "RADIUS" && p.radiusKm
        ? t("radiusKm", { km: p.radiusKm })
        : p.flexibility === "CITY_WIDE"
          ? t("cityWide")
          : t("exact"),
  }));
}

export function mapPublicTripToContext(trip: PublicTrip, t: MapperT): TripContext {
  const familyStances = Object.fromEntries(
    PARCEL_FAMILIES.map((f) => [f, { mode: "ACCEPT", surchargePct: 0 }])
  ) as Record<ParcelFamily, FamilyStance>;
  for (const c of trip.familyConditions ?? []) {
    if ((PARCEL_FAMILIES as readonly string[]).includes(c.familyKey)) {
      familyStances[c.familyKey as ParcelFamily] = { mode: c.mode, surchargePct: c.surchargePct ?? 0 };
    }
  }
  const dep = trip.dates.departureAt ? new Date(trip.dates.departureAt) : null;
  const arr = trip.dates.arrivalAt ? new Date(trip.dates.arrivalAt) : null;
  const carrier = trip.tripper.carrier;

  return {
    tripId: trip.id,
    carrier: {
      id: trip.tripper.id,
      firstName: trip.tripper.firstName,
      lastInitial: trip.tripper.lastInitial,
      avatarUrl: trip.tripper.avatarUrl ?? undefined,
      rating: carrier?.ratingsAvg ?? 0,
      dealCount: carrier?.totalParcelsCarried ?? 0,
    },
    originCity: trip.origin.city ?? "",
    destinationCity: trip.destination.city ?? "",
    originCountry: trip.origin.country ?? "",
    destinationCountry: trip.destination.country ?? "",
    departureDate: trip.dates.departureAt ?? "",
    travelMode: (trip.transportMode ?? "PLANE") as TripContext["travelMode"],
    isDirect: trip.flightType === "DIRECT" || trip.trainTripType === "DIRECT" || trip.carTripFlexibility === "DIRECT",
    durationHours: dep && arr ? Math.max(1, Math.round((arr.getTime() - dep.getTime()) / 3_600_000)) : undefined,
    pickupOptions: toLocationPoints(trip.pickupLocations, t),
    deliveryOptions: toLocationPoints(trip.deliveryLocations, t),
    acceptedCategories: (trip.acceptedCategories ?? []) as ParcelCategory[],
    categoryPrices: Object.fromEntries(
      (trip.categoryConditions ?? []).map((c) => [c.category, c.priceAmountCents / 100])
    ) as Partial<Record<ParcelCategory, number>>,
    serviceFeePercent: 0.12,
    pricePerKgCents: trip.pricePerKgCents ?? null,
    remainingKg: typeof trip.remainingKg === "number" ? trip.remainingKg : null,
    familyStances,
    checkedBag23PriceCents: trip.checkedBag23PriceCents ?? null,
    cabinBag12PriceCents: trip.cabinBag12PriceCents ?? null,
  };
}
