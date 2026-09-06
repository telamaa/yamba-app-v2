/**
 * TrackingSidebarCards.tsx
 * ========================
 * Les 3 cards sidebar de l'écran tracking :
 *  - TrackingPaymentCard  : net + J+4 + note (la carotte)
 *  - TrackingParcelCard   : recap colis + photos pickup
 *  - TrackingShipperCard  : Aminata + Message
 */

"use client";

import { MessageSquare } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { DealRequest } from "@/components/carrier/deal/deal.types";
import PhotoThumbs from "@/components/shared/photos/PhotoThumbs";
import { useOpenDealThread } from "@/hooks/useMessaging";

// ── TON PAIEMENT ──────────────────────────────────────────

export function TrackingPaymentCard({ deal }: { deal: DealRequest }) {
  const t = useTranslations("carrierDealTracking");
  const locale = useLocale();
  const recipientFirstName = deal.recipient?.firstName ?? "";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {t("payment.label")}
      </h3>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-slate-700 dark:text-slate-300">
          {t("payment.netLabel")}
        </span>
        <span className="text-[20px] font-black tabular-nums text-emerald-700 dark:text-emerald-400">
          {formatEur(deal.earnings.netForCarrier, locale)}
        </span>
      </div>
      <div className="my-3 border-t border-slate-100 dark:border-slate-800" />
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-slate-600 dark:text-slate-400">
          {t("payment.paidAtLabel")}
        </span>
        <span className="font-semibold text-slate-900 dark:text-white">
          {t("payment.paidAtValue")}
        </span>
      </div>
      <p className="mt-3 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        {t("payment.note", { recipientFirstName })}
      </p>
    </section>
  );
}

// ── LE COLIS ──────────────────────────────────────────────

export function TrackingParcelCard({ deal }: { deal: DealRequest }) {
  const t = useTranslations("carrierDealTracking");
  const tBooking = useTranslations("booking");
  const locale = useLocale();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {t("parcelCard.label")}
      </h3>
      <div className="text-[14px] font-semibold text-slate-900 dark:text-white">
        {t("parcelCard.summary", {
          category: tBooking(`categories.${deal.parcel.category}`),
          weight: formatNumber(deal.parcel.weightKg, locale),
        })}
      </div>
      <p className="mt-1 text-[12px] leading-snug text-slate-600 dark:text-slate-400">
        {deal.parcel.description}
      </p>
      {deal.pickup && deal.pickup.photos.length > 0 && (
        <PhotoThumbs photos={deal.pickup.photos} tone="amber" size="md" className="mt-3" />
      )}
    </section>
  );
}

// ── EXPÉDITRICE ───────────────────────────────────────────

export function TrackingShipperCard({ deal }: { deal: DealRequest }) {
  const t = useTranslations("carrierDealTracking");
  const { shipper } = deal;
  const initials = `${shipper.firstName[0] ?? ""}${shipper.lastInitial}`.toUpperCase();

  const thread = useOpenDealThread();
  const handleMessage = () => thread.open(deal.id);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {t("shipperCard.label")}
      </h3>
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #534AB7, #7F77DD)" }}
          aria-hidden="true"
        >
          {initials}
        </div>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-slate-900 dark:text-white">
            {shipper.firstName} {shipper.lastInitial}.
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {/* rating absent de l'API réelle — masqué alors */}
            {shipper.rating != null && <>⭐ {shipper.rating.toFixed(1)} · </>}
            {t("shipperCard.subtitle")}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={handleMessage}
        disabled={thread.isPending}
        className="mt-3 inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white text-[12.5px] font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
      >
        <MessageSquare size={13} aria-hidden="true" />
        {t("shipperCard.message")}
      </button>
    </section>
  );
}

// ── helpers ───────────────────────────────────────────────

function formatEur(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(value);
}
