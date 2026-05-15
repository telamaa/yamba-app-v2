"use client";

import { useLocale } from "next-intl";
import { Plane, Train, Building2, PackagePlus, PackageCheck } from "lucide-react";
import type { PublicTrip, TripLocationPoint } from "@/lib/public-trip.types";

const TEAL = "#0F766E";
const MANGO = "#FF9900";

const KIND_LABELS: Record<string, { fr: string; en: string }> = {
  AIRPORT: { fr: "À l'aéroport", en: "At the airport" },
  TRAIN_STATION: { fr: "À la gare", en: "At the train station" },
  CITY_AREA: { fr: "Dans la ville", en: "In the city" },
};

const KIND_ICONS: Record<string, React.ElementType> = {
  AIRPORT: Plane,
  TRAIN_STATION: Train,
  CITY_AREA: Building2,
};

function getFlexLabel(
  flex: string,
  radius: number | null | undefined,
  isFr: boolean
): string {
  if (flex === "EXACT") return isFr ? "Lieu exact" : "Exact spot";
  if (flex === "CITY_WIDE") return isFr ? "Ville entière" : "Whole city";
  if (flex === "RADIUS" && radius) {
    return isFr ? `Rayon ${radius} km` : `Within ${radius} km`;
  }
  return "";
}

function LocationItem({
                        location,
                        isFr,
                      }: {
  location: TripLocationPoint;
  isFr: boolean;
}) {
  const Icon = KIND_ICONS[location.kind] ?? Building2;
  const kindLabel = KIND_LABELS[location.kind]?.[isFr ? "fr" : "en"] ?? location.kind;
  const flexLabel = getFlexLabel(location.flexibility, location.radiusKm, isFr);

  return (
    <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
      <div className="flex items-start gap-2.5">
        <Icon
          size={14}
          className="mt-0.5 flex-shrink-0"
          style={{ color: MANGO }}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-slate-900 dark:text-white">
            {kindLabel}
          </div>
          {location.details && (
            <div className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
              {location.details}
            </div>
          )}
          {flexLabel && (
            <div
              className="mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: "rgba(15,118,110,0.1)", color: TEAL }}
            >
              {flexLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LocationsCard({ trip }: { trip: PublicTrip }) {
  const locale = useLocale();
  const isFr = locale === "fr";

  const pickupLocations = trip.pickupLocations ?? [];
  const deliveryLocations = trip.deliveryLocations ?? [];

  // Don't render the section at all for legacy trips without locations
  if (pickupLocations.length === 0 && deliveryLocations.length === 0) {
    return null;
  }

  return (
    <section className="px-5 py-5">
      <div className="mb-4">
        <h2 className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
          {isFr ? "Lieux de remise & livraison" : "Pickup & delivery"}
        </h2>
        <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
          {isFr
            ? "Où retrouver le Tripper pour la remise et la livraison"
            : "Where to meet the Tripper for handoff and delivery"}
        </p>
      </div>

      <div className="space-y-5">
        {pickupLocations.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <PackagePlus size={12} style={{ color: MANGO }} />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {isFr ? "Remise" : "Pickup"}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {pickupLocations.map((loc, i) => (
                <LocationItem key={`p-${i}`} location={loc} isFr={isFr} />
              ))}
            </div>
          </div>
        )}

        {deliveryLocations.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <PackageCheck size={12} style={{ color: MANGO }} />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {isFr ? "Livraison" : "Delivery"}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {deliveryLocations.map((loc, i) => (
                <LocationItem key={`d-${i}`} location={loc} isFr={isFr} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
