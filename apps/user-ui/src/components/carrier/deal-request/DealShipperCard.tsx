/**
 * DealShipperCard.tsx
 * ===================
 * "DE LA PART DE Aminata T. — Vérifié — 4.8 · 12 envois — Membre depuis nov. 2024"
 */

"use client";

import { BadgeCheck, ChevronRight, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { DealShipper } from "./deal-request.types";

type Props = {
  shipper: DealShipper;
  showMemberSince?: boolean; // true en desktop, false en mobile pour rester compact
  onViewProfileAction?: () => void;
};

export default function DealShipperCard({
                                          shipper,
                                          showMemberSince = false,
                                          onViewProfileAction,
                                        }: Props) {
  const t = useTranslations("carrierDealRequest");
  const locale = useLocale();

  const initials = `${shipper.firstName[0] ?? ""}${shipper.lastInitial}`.toUpperCase();
  const memberSinceLabel = formatMemberSince(shipper.memberSince, locale);

  return (
    <section>
      <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {t("shipperCard.title")}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-[14px] font-medium text-white"
            style={{ background: "linear-gradient(135deg, #534AB7, #7F77DD)" }}
          >
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-medium text-slate-900 dark:text-white md:text-[15px]">
                {shipper.firstName} {shipper.lastInitial}.
              </span>
              {shipper.isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                  <BadgeCheck size={11} />
                  {t("shipperCard.verifiedBadge")}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 md:text-[12px]">
              <span className="flex items-center gap-1">
                <Star size={11} fill="#BA7517" stroke="#BA7517" />
                {shipper.rating.toFixed(1)}
              </span>
              <span>·</span>
              <span>
                {t("shipperCard.shipmentCount", { count: shipper.shipmentCount })}
              </span>
              {showMemberSince && memberSinceLabel && (
                <>
                  <span className="hidden md:inline">·</span>
                  <span className="hidden md:inline">{memberSinceLabel}</span>
                </>
              )}
            </div>
          </div>

          {onViewProfileAction && (
            <button
              type="button"
              onClick={onViewProfileAction}
              className="flex items-center gap-0.5 text-[12px] font-medium text-[#185FA5] hover:underline dark:text-blue-400"
            >
              <span>{t("shipperCard.viewProfile")}</span>
              <ChevronRight size={13} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function formatMemberSince(iso: string, locale: string): string | null {
  try {
    const date = new Date(iso);
    const month = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
      month: "short",
    }).format(date);
    const year = date.getFullYear();
    return locale === "fr"
      ? `Membre depuis ${month} ${year}`
      : `Member since ${month} ${year}`;
  } catch {
    return null;
  }
}
