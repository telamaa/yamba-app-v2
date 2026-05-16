"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft, Flag } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import type { PublicTrip } from "@/lib/public-trip.types";
import ItineraryCard from "./ItineraryCard";
import CategoriesCard from "./CategoriesCard";

import ReviewsCard from "./ReviewsCard";
import ConditionsCard from "./ConditionsCard";
import BookingSummaryCard from "./BookingSummaryCard";
import BookingMobileBar from "./BookingMobileBar";
import LocationsCard from "@/components/trips/detail/LocationsCard";


type Props = {
  trip: PublicTrip;
};

export default function TripDetailView({ trip }: Props) {
  const t = useTranslations("tripDetail");
  const router = useRouter();

  const showReviews =
    !!trip.tripper.carrier && trip.tripper.carrier.ratingsCount > 0;

  const handleReport = () => {
    // TODO: ouvrir une modal de signalement (PR future)
  };

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

      <header className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          {trip.origin.city}{" "}
          <span className="text-[#FF9900]">→</span> {trip.destination.city}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t("trippedBy", {
            firstName: trip.tripper.firstName,
            lastInitial: trip.tripper.lastInitial,
          })}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* COLONNE GAUCHE — bloc unifié avec ombre layered moderne (style Stripe/Linear) */}
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06),0_2px_8px_-2px_rgba(0,0,0,0.04)] dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.3),0_2px_8px_-2px_rgba(0,0,0,0.2)]">
          <ItineraryCard trip={trip} />
          <CategoriesCard trip={trip} />
          <LocationsCard trip={trip} />
          {showReviews && <ReviewsCard tripper={trip.tripper} />}
          <ConditionsCard />
        </div>

        {/* COLONNE DROITE — sticky desktop */}
        <aside className="hidden lg:block">
          <div className="sticky top-[88px]">
            <BookingSummaryCard trip={trip} />

            {/* Signaler cette annonce — desktop, sous la card sticky */}
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={handleReport}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 underline-offset-4 transition-colors hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
              >
                <Flag size={12} />
                {t("reportListing")}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Signaler cette annonce — mobile uniquement, en bas de page */}
      <div className="mt-8 flex justify-center lg:hidden">
        <button
          type="button"
          onClick={handleReport}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 underline underline-offset-4 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <Flag size={12} />
          {t("reportListing")}
        </button>
      </div>

      <BookingMobileBar trip={trip} />
    </div>
  );
}
