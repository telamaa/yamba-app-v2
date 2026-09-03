/**
 * DealSettledView.tsx — DELIVERED · COMPLETED · DISPUTED vus du Voyageur (B4-PR3, A75–A78)
 * =========================================================================================
 * Un seul composant, trois états, deux mises en page (variant desktop / mobile) :
 *  - DELIVERED : « colis remis, vérification en cours jusqu'au {date}, ton net part ensuite »
 *  - COMPLETED : l'état du versement AU CENTRE (DealPayoutStatusCard) + récap
 *  - DISPUTED  : ticket, motif (catégorie seule — A68), « paiement en attente, ce n'est
 *                pas une décision », les étapes, « Donner ma version » (mailto, A78)
 * Le front reflète : tout vient de GET /deals/:id (payoutStatus, payoutBlocker,
 * disputeCategory, deliveryPhotos), rien n'est calculé ici.
 */
"use client";

import { CheckCircle2, LifeBuoy, PackageCheck, ShieldAlert } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { DealRequest } from "@/components/carrier/deal/deal.types";
import DealAcceptedHeader from "../accepted/DealAcceptedHeader";
import DealAcceptedRecap from "../accepted/DealAcceptedRecap";
import DealShipperCard from "../../shared/DealShipperCard";
import DealPayoutStatusCard from "../../shared/DealPayoutStatusCard";
import DealStepper, { type StepperStep } from "../../shared/DealStepper";
import PhotoThumbs from "@/components/shared/photos/PhotoThumbs";
import RatingStatusCard from "@/components/rating/RatingStatusCard";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@yamba.app";

type Props = {
  deal: DealRequest;
  variant: "desktop" | "mobile";
  onCloseAction: () => void;
};

export default function DealSettledView({ deal, variant, onCloseAction }: Props) {
  const t = useTranslations("carrierDealAccepted");
  const format = useFormatter();
  const compact = variant === "mobile";
  const status = deal.status as "DELIVERED" | "COMPLETED" | "DISPUTED";
  const key = status === "DELIVERED" ? "delivered" : status === "COMPLETED" ? "completed" : "disputed";
  const shipperFirstName = deal.shipper.firstName;
  const recipientFirstName = deal.recipient?.firstName ?? deal.deliveryLocation.name.split(" ")[0] ?? "";
  const dateTime = (iso?: string) =>
    iso ? format.dateTime(new Date(iso), { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "";

  const steps: StepperStep[] = [
    { id: "accepted", label: t("timeline.steps.accepted") },
    { id: "pickup", label: t("timeline.steps.pickup") },
    { id: "transport", label: t("timeline.steps.transport") },
    { id: "delivery", label: t("timeline.steps.delivery") },
    { id: "payout", label: t("timeline.steps.payout") },
  ];
  const currentStep = status === "COMPLETED" && deal.payoutStatus === "SENT" ? 6 : 5;

  const banner = (
    <div
      className={`flex items-center gap-3 ${
        status === "DISPUTED"
          ? "border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900"
          : status === "COMPLETED"
            ? "border-teal-200 bg-teal-50 dark:border-teal-900/40 dark:bg-teal-950/30"
            : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30"
      } ${compact ? "border-y px-4 py-3" : "my-5 rounded-2xl border px-5 py-4"}`}
    >
      <div
        className={`flex flex-shrink-0 items-center justify-center rounded-full text-white ${compact ? "h-7 w-7" : "h-9 w-9"} ${
          status === "DISPUTED" ? "bg-slate-700 dark:bg-slate-600" : status === "COMPLETED" ? "bg-[#0F766E]" : "bg-emerald-700 dark:bg-emerald-600"
        }`}
      >
        {status === "DISPUTED" ? <ShieldAlert size={compact ? 15 : 18} aria-hidden /> : status === "COMPLETED" ? <CheckCircle2 size={compact ? 15 : 18} aria-hidden /> : <PackageCheck size={compact ? 15 : 18} aria-hidden />}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`font-semibold text-slate-900 dark:text-white ${compact ? "text-[13px]" : "text-[14px] sm:text-[15px]"}`}>
          {t(`settled.${key}.bannerTitle`, { recipientFirstName, ticket: deal.disputeTicket ?? "" })}
        </div>
        <div className={`text-slate-600 dark:text-slate-400 ${compact ? "text-[11px]" : "mt-0.5 text-[12px] sm:text-[13px]"}`}>
          {status === "DELIVERED"
            ? t("settled.delivered.bannerSub", { date: dateTime(deal.deliveredAt) })
            : status === "COMPLETED"
              ? deal.completedBy === "SHIPPER"
                ? t("settled.completed.bannerSubShipper", { shipperFirstName, date: dateTime(deal.completedAt) })
                : t("settled.completed.bannerSubSystem", { date: dateTime(deal.completedAt) })
              : t("settled.disputed.bannerSub", { date: dateTime(deal.disputedAt) })}
        </div>
      </div>
    </div>
  );

  const main = (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      <header>
        <h2 className={`font-semibold tracking-tight text-slate-900 dark:text-white ${compact ? "text-[19px] font-black" : "text-[17px] sm:text-lg"}`}>
          {t(`settled.${key}.h1`)}
        </h2>
        <p className={`text-slate-500 dark:text-slate-400 ${compact ? "mt-0.5 text-[13px]" : "mt-1 text-sm"}`}>
          {t(`settled.${key}.h1Subtitle`, { shipperFirstName })}
        </p>
      </header>

      {status === "DISPUTED" ? <DisputedCard deal={deal} compact={compact} /> : <DealPayoutStatusCard deal={deal} compact={compact} />}

      {status === "DELIVERED" && (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-[12.5px] leading-snug text-slate-600 dark:bg-slate-900 dark:text-slate-400">
          {t("settled.delivered.verificationNote", { shipperFirstName, date: format.dateTime(new Date(deal.payoutDueAt ?? deal.deliveredAt ?? Date.now()), { day: "numeric", month: "long" }) })}
        </p>
      )}

      <DealStepper steps={steps} currentStep={currentStep} title={compact ? t("timeline.titleShort") : t("timeline.title")} compact={compact} />

      {deal.deliveryPhotos.length > 0 && (
        <section className={`rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 ${compact ? "p-4" : "p-5"}`}>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t("settled.deliveryPhotos")}</h3>
          <PhotoThumbs photos={deal.deliveryPhotos} tone="amber" size="md" className="mt-2" />
        </section>
      )}

      {status === "DISPUTED" && <DisputeSupportCard deal={deal} compact={compact} />}

      <DealAcceptedRecap deal={deal} />

      {status === "COMPLETED" && (
        <RatingStatusCard dealId={deal.id} rating={deal.rating} counterpartFirstName={shipperFirstName} rateHref={`/carrier/deals/${deal.id}/rate`} compact={compact} />
      )}

      <button
        type="button"
        onClick={onCloseAction}
        className={`inline-flex items-center justify-center rounded-full bg-[#FF9900] font-bold text-slate-950 hover:bg-[#F08700] ${
          compact ? "min-h-[46px] w-full rounded-xl px-4 text-[14px]" : "min-h-[44px] px-6 py-2.5 text-[13px]"
        }`}
      >
        {t("settled.backToTrips")}
      </button>
    </div>
  );

  if (compact) {
    return (
      <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
        <DealAcceptedHeader deal={deal} onBackAction={onCloseAction} variant="mobile" />
        {banner}
        <div className="flex-1 px-4 pb-10 pt-4">
          {main}
          <div className="mt-3">
            <DealShipperCard shipper={deal.shipper} showMemberSince={false} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
        <DealAcceptedHeader deal={deal} onBackAction={onCloseAction} variant="desktop" />
        {banner}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[minmax(0,1fr)_320px]">
          {main}
          <aside className="hidden md:block">
            <div className="sticky top-[88px] space-y-4">
              <DealShipperCard shipper={deal.shipper} showMemberSince />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ── Litige : ticket, catégorie seule, calme (A68/A78) ─────────── */

function DisputedCard({ deal, compact }: { deal: DealRequest; compact: boolean }) {
  const t = useTranslations("carrierDealAccepted.settled.disputed");
  const label = deal.disputeCategory ? t(`categories.${deal.disputeCategory}`) : null;
  const steps = [1, 2, 3].map((n) => t(`steps.${n}`));
  return (
    <section className={`rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900 ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t("ticketLabel")}</span>
        <span className="text-[15px] font-black tabular-nums text-slate-900 dark:text-white">{deal.disputeTicket ?? "—"}</span>
      </div>
      {label && (
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t("categoryLabel")}</span>
          <span className="text-[13px] font-medium text-slate-900 dark:text-white">{label}</span>
        </div>
      )}
      <p className="mt-3 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">{t("notADecision")}</p>
      <ol className="mt-3 space-y-1.5">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-2 text-[12.5px] leading-snug text-slate-600 dark:text-slate-400">
            <span className="mt-0.5 flex h-4.5 w-4.5 min-w-[18px] items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-white dark:bg-slate-600">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DisputeSupportCard({ deal, compact }: { deal: DealRequest; compact: boolean }) {
  const t = useTranslations("carrierDealAccepted.settled.disputed");
  const ticket = deal.disputeTicket ?? "";
  const subject = encodeURIComponent(`Yamba — dossier ${ticket} — ma version`);
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white text-center dark:border-slate-800 dark:bg-slate-950 ${compact ? "p-4" : "p-5"}`}>
      <LifeBuoy size={18} className="mx-auto text-slate-500 dark:text-slate-400" aria-hidden="true" />
      <h3 className="mt-2 text-[13.5px] font-bold text-slate-900 dark:text-white">{t("support.title")}</h3>
      <p className="mx-auto mt-1 max-w-xs text-[12px] leading-snug text-slate-600 dark:text-slate-400">{t("support.text", { ticket })}</p>
      <a
        href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`}
        className="mt-3 inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#FF9900] px-4 text-[12.5px] font-bold text-slate-950 hover:bg-[#F08700]"
      >
        {t("support.cta")}
      </a>
    </section>
  );
}
