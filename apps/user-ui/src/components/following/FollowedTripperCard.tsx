"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Star,
  MapPin,
  ArrowRight,
  Calendar,
  Bell,
  BellOff,
  UserMinus,
  Loader2,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import type { FollowingItem } from "@/lib/following.types";
import {
  useUnfollowUser,
  useUpdateFollowPreferences,
} from "@/hooks/useFollowMutations";

type Props = {
  item: FollowingItem;
};

export default function FollowedTripperCard({ item }: Props) {
  const t = useTranslations("following.card");
  const locale = useLocale() as "fr" | "en";

  const [confirmingUnfollow, setConfirmingUnfollow] = useState(false);

  const { mutate: unfollow, isPending: isUnfollowing } = useUnfollowUser();
  const { mutate: updatePrefs, isPending: isUpdating } =
    useUpdateFollowPreferences();

  const { user, notifyNextTrip } = item;
  const trip = user.nextUpcomingTrip;

  // ─── Handlers ─────────────────────────────────
  const handleUnfollow = () => {
    if (!user.publicSlug) {
      toast.error(t("unfollowError"));
      return;
    }
    if (!confirmingUnfollow) {
      setConfirmingUnfollow(true);
      setTimeout(() => setConfirmingUnfollow(false), 3000);
      return;
    }

    unfollow(user.publicSlug, {
      onSuccess: () => toast.success(t("unfollowSuccess")),
      onError: () => toast.error(t("unfollowError")),
    });
  };

  const handleToggleNotify = () => {
    if (!user.publicSlug) return;
    updatePrefs(
      { slug: user.publicSlug, notifyNextTrip: !notifyNextTrip },
      {
        onError: () => toast.error(t("updateError")),
      }
    );
  };

  // ─── Helpers de rendu ─────────────────────────
  const fullName = `${user.firstName} ${user.lastInitial}.`;
  const profileHref = user.publicSlug ? `/u/${user.publicSlug}` : null;

  const formatTripDate = (iso: string) => {
    return new Date(iso).toLocaleDateString(
      locale === "fr" ? "fr-FR" : "en-US",
      { day: "numeric", month: "long", year: "numeric" }
    );
  };

  // ─── Render ────────────────────────────────────
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      {/* ─── Header : avatar + nom + badge ───────── */}
      <div className="mb-4 flex items-start gap-3">
        {/* Avatar */}
        {profileHref ? (
          <Link
            href={profileHref}
            className="shrink-0 transition-opacity hover:opacity-80"
          >
            <AvatarBlock user={user} fullName={fullName} />
          </Link>
        ) : (
          <AvatarBlock user={user} fullName={fullName} />
        )}

        {/* Nom + badges */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {profileHref ? (
              <Link
                href={profileHref}
                className="truncate text-base font-bold text-slate-900 hover:underline dark:text-white"
              >
                {fullName}
              </Link>
            ) : (
              <span className="truncate text-base font-bold text-slate-900 dark:text-white">
                {fullName}
              </span>
            )}
            {user.isCarrier && (
              <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#B45309] dark:bg-orange-500/15 dark:text-[#FFB84D]">
                {t("tripperBadge")}
              </span>
            )}
          </div>

          {/* Stats Tripper */}
          {user.isCarrier && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
              {user.carrierRatingAvg !== null &&
                user.carrierRatingCount > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Star
                      size={11}
                      className="fill-amber-400 stroke-amber-400"
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {user.carrierRatingAvg.toFixed(1)}
                    </span>
                    <span>({user.carrierRatingCount})</span>
                  </span>
                )}
              <span className="inline-flex items-center gap-1">
                <Package size={11} />
                {t("tripsPublished", { count: user.totalTripsPublished })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Prochain trajet ────────────────────── */}
      {trip ? (
        <Link
          href={`/trips/${trip.id}`}
          className="mb-4 block rounded-xl border border-orange-200 bg-orange-50/60 p-3 transition-colors hover:bg-orange-50 dark:border-orange-500/20 dark:bg-orange-500/5 dark:hover:bg-orange-500/10"
        >
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#B45309] dark:text-[#FFB84D]">
            {t("nextTripLabel")}
          </p>
          <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
            <MapPin size={13} className="shrink-0 text-[#FF9900]" />
            <span className="truncate">{trip.originCity}</span>
            <ArrowRight size={11} className="shrink-0 text-slate-400" />
            <span className="truncate">{trip.destinationCity}</span>
          </div>
          <p className="inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400">
            <Calendar size={10} />
            {formatTripDate(trip.departureAt)}
          </p>
        </Link>
      ) : (
        <p className="mb-4 rounded-xl border border-dashed border-slate-200 px-3 py-2.5 text-[11px] italic text-slate-500 dark:border-slate-800 dark:text-slate-500">
          {t("noUpcomingTrip")}
        </p>
      )}

      {/* ─── Toggle + Unfollow ──────────────────── */}
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <button
          type="button"
          onClick={handleToggleNotify}
          disabled={isUpdating || !user.publicSlug}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
            notifyNextTrip
              ? "bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
              : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-slate-700"
          }`}
        >
          {isUpdating ? (
            <Loader2 size={11} className="animate-spin" />
          ) : notifyNextTrip ? (
            <Bell size={11} />
          ) : (
            <BellOff size={11} />
          )}
          {notifyNextTrip ? t("notifyOn") : t("notifyOff")}
        </button>

        <button
          type="button"
          onClick={handleUnfollow}
          disabled={isUnfollowing}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
            confirmingUnfollow
              ? "bg-red-600 text-white hover:bg-red-700"
              : "border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
          }`}
        >
          {isUnfollowing ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <UserMinus size={11} />
          )}
          {confirmingUnfollow ? t("confirmUnfollow") : t("unfollow")}
        </button>
      </div>
    </article>
  );
}

/* ============================================================ */
/*                    SOUS-COMPOSANTS                          */
/* ============================================================ */

function AvatarBlock({
                       user,
                       fullName,
                     }: {
  user: FollowingItem["user"];
  fullName: string;
}) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={fullName}
        className="h-12 w-12 rounded-full object-cover"
      />
    );
  }
  // Fallback : initiale colorée
  const initial = user.firstName.charAt(0).toUpperCase();
  return (
    <div className="grid h-12 w-12 place-items-center rounded-full bg-orange-100 text-base font-bold text-[#B45309] dark:bg-orange-500/20 dark:text-[#FFB84D]">
      {initial}
    </div>
  );
}
