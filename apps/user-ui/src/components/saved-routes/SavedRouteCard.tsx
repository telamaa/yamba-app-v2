"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  MapPin,
  ArrowRight,
  Calendar,
  Bell,
  BellOff,
  Trash2,
  RefreshCw,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { SavedRoute } from "@/lib/saved-route.types";
import {
  formatDateRange,
  formatExpiresIn,
  expiresWithinDays,
  isExpired,
} from "@/lib/saved-route.helpers";
import {
  useDeleteSavedRoute,
  useExtendSavedRoute,
  useUpdateSavedRoute,
} from "@/hooks/useSavedRouteMutations";

type Props = {
  savedRoute: SavedRoute;
};

export default function SavedRouteCard({ savedRoute }: Props) {
  const t = useTranslations("savedRoutes.card");
  const locale = useLocale() as "fr" | "en";

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { mutate: deleteSavedRoute, isPending: isDeleting } =
    useDeleteSavedRoute();
  const { mutate: extendSavedRoute, isPending: isExtending } =
    useExtendSavedRoute();
  const { mutate: updateSavedRoute, isPending: isUpdating } =
    useUpdateSavedRoute();

  const expired = isExpired(savedRoute);
  const expiringSoon = !expired && expiresWithinDays(savedRoute, 7);

  // ─── Handlers ────────────────────────────────
  const handleDelete = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      // Auto-cancel après 3s
      setTimeout(() => setConfirmingDelete(false), 3000);
      return;
    }

    deleteSavedRoute(savedRoute.id, {
      onSuccess: () => toast.success(t("deleteSuccess")),
      onError: () => toast.error(t("deleteError")),
    });
  };

  const handleExtend = () => {
    extendSavedRoute(savedRoute.id, {
      onSuccess: () => toast.success(t("extendSuccess")),
      onError: () => toast.error(t("extendError")),
    });
  };

  const handleToggleEmail = () => {
    updateSavedRoute(
      {
        id: savedRoute.id,
        payload: { emailEnabled: !savedRoute.emailEnabled },
      },
      {
        onError: () => toast.error(t("updateError")),
      }
    );
  };

  // ─── Render ─────────────────────────────────
  return (
    <article
      className={`relative rounded-2xl border bg-white p-5 transition-colors dark:bg-slate-950 ${
        expired
          ? "border-slate-200 opacity-60 dark:border-slate-800"
          : "border-slate-200 dark:border-slate-800"
      }`}
    >
      {/* Badge expiration */}
      {(expired || expiringSoon) && (
        <div
          className={`absolute -top-2 left-4 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            expired
              ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              : "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300"
          }`}
        >
          <AlertCircle size={10} />
          {expired ? t("expired") : t("expiringSoon")}
        </div>
      )}

      {/* Header : route */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
          <MapPin size={15} className="shrink-0 text-[#FF9900]" />
          <span className="truncate">{savedRoute.originCity}</span>
          <ArrowRight size={13} className="shrink-0 text-slate-400" />
          <span className="truncate">{savedRoute.destinationCity}</span>
        </div>
      </div>

      {/* Période */}
      <div className="mb-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Calendar size={12} />
        <span>
          {formatDateRange(
            savedRoute.earliestDate,
            savedRoute.latestDate,
            locale
          )}
        </span>
      </div>

      {/* Statut expiration */}
      <p className="mb-4 text-[11px] text-slate-500 dark:text-slate-400">
        {formatExpiresIn(savedRoute.expiresAt, locale)}
      </p>

      {/* Toggles compacts */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={handleToggleEmail}
          disabled={isUpdating || expired}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
            savedRoute.emailEnabled
              ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500"
          }`}
        >
          {savedRoute.emailEnabled ? <Bell size={10} /> : <BellOff size={10} />}
          {savedRoute.emailEnabled ? t("emailOn") : t("emailOff")}
        </button>
        {savedRoute.includeNearby && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {t("nearbyOn")}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        {(expired || expiringSoon) && (
          <button
            type="button"
            onClick={handleExtend}
            disabled={isExtending}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#FF9900] px-3 py-1.5 text-xs font-bold text-slate-950 transition-colors hover:bg-[#F08700] disabled:opacity-50"
          >
            {isExtending ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <RefreshCw size={11} />
            )}
            {t("extend")}
          </button>
        )}

        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
            confirmingDelete
              ? "bg-red-600 text-white hover:bg-red-700"
              : "border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
          }`}
        >
          {isDeleting ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Trash2 size={11} />
          )}
          {confirmingDelete ? t("confirmDelete") : t("delete")}
        </button>
      </div>
    </article>
  );
}
