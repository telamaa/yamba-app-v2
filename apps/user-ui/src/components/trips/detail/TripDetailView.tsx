"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Eye, Flag, LayoutDashboard, Pencil, Ticket } from "lucide-react";
import { isPopular } from "@/lib/trip-signals";
import { useRouter } from "@/i18n/navigation";
import useUser from "@/hooks/useUser";
import type { PublicTrip } from "@/lib/public-trip.types";
import ItineraryCard from "./ItineraryCard";
import CategoriesCard from "./CategoriesCard";
import OfferCard from "./OfferCard";
import FavoriteButton from "@/components/favorites/FavoriteButton";

import ReviewsCard from "./ReviewsCard";
import ConditionsCard from "./ConditionsCard";
import BookingSummaryCard from "./BookingSummaryCard";
import BookingMobileBar from "./BookingMobileBar";
import LocationsCard from "@/components/trips/detail/LocationsCard";
import { track } from "@/lib/analytics";
import ReportDialog from "@/components/shared/ReportDialog"; // D68


type Props = {
  trip: PublicTrip;
};

export default function TripDetailView({ trip }: Props) {
  const t = useTranslations("tripDetail");
  const router = useRouter();
  const { user } = useUser();
  // Le créateur ne se réserve pas lui-même : il édite (même écran que le dashboard)
  const isOwner = !!user && user.id === trip.tripper.id;

  // Poids du colis saisi en recherche (même clé) → continuité recherche → détail → réservation
  const [weightKg, setWeightKg] = useState<number | null>(null);
  useEffect(() => { void track("trip_viewed", { tripId: trip.id, origin: trip.origin?.city ?? null, destination: trip.destination?.city ?? null, isOwner }); }, [trip.id, trip.origin?.city, trip.destination?.city, isOwner]); // D66 3A
  useEffect(() => {
    try {
      const v = Number(window.localStorage.getItem("yamba.search.weightKg"));
      if (Number.isFinite(v) && v >= 0.5 && v <= 30) setWeightKg(v);
    } catch {
      /* stockage indisponible */
    }
  }, []);

  const showReviews =
    !!trip.tripper.carrier && trip.tripper.carrier.ratingsCount > 0;

  // D68 — signaler cette annonce : modale générique (porte de connexion si visiteur)
  const [reportOpen, setReportOpen] = useState(false);
  const handleReport = () => setReportOpen(true);
  const reportTarget = { type: "TRIP" as const, ref: trip.id, label: `${trip.origin?.city ?? "?"} → ${trip.destination?.city ?? "?"}` };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-4 sm:px-6 sm:pt-6 lg:pb-12">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ArrowLeft size={14} />
        {t("back")}
      </button>

      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            {trip.origin.city}{" "}
            <span className="text-[#FF9900]">→</span> {trip.destination.city}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t("trippedBy", {
              firstName: trip.tripper.firstName,
              lastInitial: trip.tripper.lastInitial,
            })}
          </p>
          {/* D5 / C-PR6 (D60) — signaux : vues (pastille), « Populaire » à partir de 20 vues, billet vérifié */}
          {((typeof trip.viewsCount === "number" && trip.viewsCount > 0) || trip.ticketVerified) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {typeof trip.viewsCount === "number" && trip.viewsCount > 0 && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${isPopular(trip.viewsCount) ? "bg-[#FFF6E8] text-[#B45309] dark:bg-[#FF9900]/15 dark:text-[#FFB84D]" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                  <Eye size={12} strokeWidth={2.5} />
                  {t("views", { count: trip.viewsCount })}
                  {isPopular(trip.viewsCount) && <span className="ml-1 rounded-full bg-[#FF9900] px-1.5 text-[10px] text-white">{t("badges.popular")}</span>}
                </span>
              )}
              {trip.ticketVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  <Ticket size={12} strokeWidth={2.5} />
                  {t("badges.verifiedTicket")}
                </span>
              )}
            </div>
          )}
        </div>
        {/* D46 — le créateur ne met pas son propre trajet en favori (le serveur le refuse aussi) */}
        {!isOwner && <FavoriteButton tripId={trip.id} isFavorite={trip.isFavorite} variant="detail" className="shrink-0" />}
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* COLONNE GAUCHE — bloc unifié avec ombre layered moderne (style Stripe/Linear) */}
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06),0_2px_8px_-2px_rgba(0,0,0,0.04)] dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.3),0_2px_8px_-2px_rgba(0,0,0,0.2)]">
          <ItineraryCard trip={trip} isOwner={isOwner} weightKg={weightKg} />
          <OfferCard trip={trip} weightKg={weightKg} />
          <CategoriesCard trip={trip} />
          {showReviews && <ReviewsCard tripper={trip.tripper} />}
          {/* Sur mobile/tablette, lieux et conditions restent dans le flux ;
              sur desktop ils montent dans la colonne de droite (page sans scroll). */}
          <div className="lg:hidden">
            <LocationsCard trip={trip} />
          </div>
          <div className="lg:hidden">
            <ConditionsCard />
          </div>
        </div>

        {/* COLONNE DROITE — sticky desktop */}
        <aside className="hidden lg:block">
          <div className="yamba-sidebar-scroll sticky top-[88px] max-h-[calc(100vh-100px)] overflow-y-auto pb-2">
            {isOwner ? <OwnerCard tripId={trip.id} /> : <BookingSummaryCard trip={trip} weightKg={weightKg} />}

            {/* Lieux + conditions : blocs courts, à droite sur desktop */}
            <div className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950">
              <LocationsCard trip={trip} />
              <ConditionsCard />
            </div>

            {/* Signaler cette annonce — desktop, sous la card sticky */}
            {!isOwner && <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={handleReport}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 underline-offset-4 transition-colors hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
              >
                <Flag size={12} />
                {t("reportListing")}
              </button>
            </div>}
          </div>
        </aside>
      </div>

      {reportOpen && <ReportDialog target={reportTarget} onCloseAction={() => setReportOpen(false)} />}

      {/* Signaler cette annonce — mobile uniquement, en bas de page */}
      {!isOwner && <div className="mt-8 flex justify-center lg:hidden">
        <button
          type="button"
          onClick={handleReport}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 underline underline-offset-4 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <Flag size={12} />
          {t("reportListing")}
        </button>
      </div>}

      {isOwner ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 lg:hidden">
          <div className="mx-auto max-w-md">
            <OwnerCard tripId={trip.id} compact />
          </div>
        </div>
      ) : (
        <BookingMobileBar trip={trip} />
      )}
    </div>
  );
}

/* ── Carte propriétaire : remplace la carte de réservation pour le créateur ── */
function OwnerCard({ tripId, compact }: { tripId: string; compact?: boolean }) {
  const t = useTranslations("tripDetail");
  const router = useRouter();
  const edit = () => router.push(`/trips/create?edit=${tripId}`);
  const dashboard = () => router.push("/dashboard/trips");

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 text-[13px] font-semibold text-slate-900 dark:text-white">
          {t("owner.title")}
        </div>
        <button
          type="button"
          onClick={edit}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[#FF9900] px-4 text-sm font-bold text-slate-950 transition-all active:scale-[0.99]"
        >
          <Pencil size={14} />
          {t("owner.edit")}
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#FF9900]/30 bg-white p-5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] dark:border-[#FF9900]/25 dark:bg-slate-950">
      <div className="text-[13px] font-semibold text-slate-900 dark:text-white">{t("owner.title")}</div>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{t("owner.subtitle")}</p>
      <button
        type="button"
        onClick={edit}
        className="mt-4 inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#FF9900] px-4 text-sm font-bold text-slate-950 transition-all hover:bg-[#F08700] active:scale-[0.99]"
      >
        <Pencil size={15} />
        {t("owner.edit")}
      </button>
      <button
        type="button"
        onClick={dashboard}
        className="mt-2 inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
      >
        <LayoutDashboard size={15} />
        {t("owner.dashboard")}
      </button>
    </div>
  );
}
