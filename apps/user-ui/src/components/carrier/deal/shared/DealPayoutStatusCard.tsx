/**
 * DealPayoutStatusCard.tsx — l'état du versement, vu du Voyageur (B4-PR3, A75/A78)
 * ================================================================================
 * Copie honnête (décision 7) : un transfert Connect n'est pas un virement —
 * « parti vers ton compte, sur ton compte bancaire sous 2 à 7 jours ».
 * FAILED + ACCOUNT_NOT_READY → bouton vers l'onboarding Stripe (2A) ;
 * FAILED + RETRYING → « en cours de traitement, rien à faire » ;
 * FROZEN → signalement en cours ; PENDING → en cours de traitement ;
 * DELIVERED (pas encore de payoutStatus) → « après la vérification, le {date} ».
 */
"use client";

import { AlertTriangle, CheckCircle2, Clock3, Lock, Wallet } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { DealRequest } from "@/components/carrier/deal/deal.types";

type Props = {
  deal: DealRequest;
  compact?: boolean;
};

export default function DealPayoutStatusCard({ deal, compact = false }: Props) {
  const t = useTranslations("carrierDealAccepted.payoutStatus");
  const locale = useLocale();
  const format = useFormatter();
  const router = useRouter();
  // D50/A82 — sur une annulation tardive, le montant est la COMPENSATION, pas le net.
  const late = deal.status === "CANCELLED";
  const cents = late && deal.payoutAmountCents != null ? deal.payoutAmountCents : Math.round(deal.earnings.netForCarrier * 100);
  const amount = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", { style: "currency", currency: "EUR" }).format(cents / 100);
  const day = (iso?: string) => (iso ? format.dateTime(new Date(iso), { day: "numeric", month: "long" }) : "");

  type Tone = "teal" | "emerald" | "amber" | "slate";
  let tone: Tone = "teal";
  let Icon = Clock3;
  let title = "";
  let text = "";
  let cta: { label: string; href: string } | null = null;

  const status = deal.payoutStatus;
  if (!status && deal.status === "DELIVERED") {
    tone = "teal";
    Icon = Clock3;
    title = t("scheduled.title", { amount });
    text = t("scheduled.text", { date: day(deal.payoutDueAt) });
  } else if (status === "SENT") {
    tone = "emerald";
    Icon = CheckCircle2;
    title = late ? t("sentLate.title", { amount }) : t("sent.title", { amount });
    text = late ? t("sentLate.text", { date: day(deal.payoutSentAt) }) : t("sent.text", { date: day(deal.payoutSentAt) });
  } else if (status === "FAILED" && deal.payoutBlocker === "ACCOUNT_NOT_READY") {
    tone = "amber";
    Icon = AlertTriangle;
    title = t("accountNotReady.title", { amount });
    text = t("accountNotReady.text");
    cta = { label: t("accountNotReady.cta"), href: "/carrier/onboarding" };
  } else if (status === "FAILED") {
    tone = "teal";
    Icon = Clock3;
    title = t("retrying.title", { amount });
    text = t("retrying.text");
  } else if (status === "FROZEN") {
    tone = "slate";
    Icon = Lock;
    title = t("frozen.title", { amount });
    text = t("frozen.text");
  } else {
    // PENDING (ou état inconnu) : la transaction est close, l'envoi est en cours.
    tone = "teal";
    Icon = Wallet;
    title = t("pending.title", { amount });
    text = t("pending.text");
  }

  const TONES: Record<Tone, { box: string; icon: string; title: string; text: string }> = {
    teal: { box: "border-teal-200 bg-teal-50 dark:border-teal-900/40 dark:bg-teal-950/25", icon: "bg-[#0F766E] text-white", title: "text-teal-950 dark:text-teal-100", text: "text-teal-900/80 dark:text-teal-200/80" },
    emerald: { box: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/25", icon: "bg-emerald-700 text-white", title: "text-emerald-950 dark:text-emerald-100", text: "text-emerald-900/80 dark:text-emerald-200/80" },
    amber: { box: "border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30", icon: "bg-amber-500 text-white", title: "text-amber-950 dark:text-amber-100", text: "text-amber-900/85 dark:text-amber-200/85" },
    slate: { box: "border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900", icon: "bg-slate-600 text-white", title: "text-slate-900 dark:text-white", text: "text-slate-600 dark:text-slate-400" },
  };
  const c = TONES[tone];

  return (
    <section className={`rounded-2xl border ${c.box} ${compact ? "p-4" : "p-5"}`} aria-live="polite">
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${c.icon}`}>
          <Icon size={17} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className={`text-[14px] font-bold ${c.title}`}>{title}</h3>
          <p className={`mt-1 text-[12.5px] leading-snug ${c.text}`}>{text}</p>
          {cta && (
            <button
              type="button"
              onClick={() => router.push(cta!.href)}
              className="mt-3 inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#FF9900] px-4 text-[12.5px] font-bold text-slate-950 transition-colors hover:bg-[#F08700]"
            >
              {cta.label}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
