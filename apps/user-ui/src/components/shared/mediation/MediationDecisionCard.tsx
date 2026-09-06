/**
 * MediationDecisionCard.tsx — « Décision rendue » (C-PR2, D55 5A)
 * ================================================================
 * Partagée par les deux rôles : l'issue, LE montant qui concerne le lecteur,
 * le motif écrit par l'admin, la date, et le recours (email au support).
 * Sert aussi l'arbitrage d'une retenue (compensation / restitution).
 */
"use client";

import { Gavel } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

export type DecisionResolution = {
  outcome: "REJECTED" | "PARTIAL_REFUND" | "FULL_REFUND";
  refundCents: number;
  carrierPayoutCents: number;
  reason: string;
  resolvedAt: string;
};
export type DecisionRetention = {
  outcome: "COMPENSATE_CARRIER" | "RESTITUTE_SHIPPER";
  reason: string;
  decidedAt: string;
};

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@yamba.app";

type Props = {
  role: "SHIPPER" | "CARRIER";
  ticket?: string | null;
  resolution?: DecisionResolution | null;
  retentionDecision?: DecisionRetention | null;
  /** Montant de la retenue (arbitrage), pour afficher la somme concernée. */
  retentionCents?: number | null;
  /** Compensation au Voyageur (prorata) quand la retenue lui revient. */
  compensationCents?: number | null;
  currencyCode?: string;
  compact?: boolean;
};

export default function MediationDecisionCard({ role, ticket, resolution, retentionDecision, retentionCents, compensationCents, currencyCode = "EUR", compact = false }: Props) {
  const t = useTranslations("mediation.decision");
  const format = useFormatter();
  if (!resolution && !retentionDecision) return null;

  const money = (cents: number) => format.number(cents / 100, { style: "currency", currency: currencyCode });
  const when = format.dateTime(new Date(resolution?.resolvedAt ?? retentionDecision!.decidedAt), { day: "numeric", month: "long", year: "numeric" });

  let outcomeKey: string;
  let amountLine: string | null = null;
  if (resolution) {
    outcomeKey = `${role}.${resolution.outcome}`;
    if (role === "SHIPPER" && resolution.refundCents > 0) amountLine = t("refundLine", { amount: money(resolution.refundCents) });
    if (role === "CARRIER") {
      amountLine = resolution.carrierPayoutCents > 0 ? t("payoutLine", { amount: money(resolution.carrierPayoutCents) }) : t("noPayoutLine");
    }
  } else {
    outcomeKey = `${role}.${retentionDecision!.outcome}`;
    if (retentionDecision!.outcome === "RESTITUTE_SHIPPER" && role === "SHIPPER" && retentionCents) amountLine = t("refundLine", { amount: money(retentionCents) });
    if (retentionDecision!.outcome === "COMPENSATE_CARRIER" && role === "CARRIER" && compensationCents) amountLine = t("payoutLine", { amount: money(compensationCents) });
    if (retentionDecision!.outcome === "RESTITUTE_SHIPPER" && role === "CARRIER") amountLine = t("noPayoutLine");
  }
  const reason = resolution?.reason ?? retentionDecision!.reason;
  const subject = encodeURIComponent(t("recourseSubject", { ticket: ticket ?? "" }));

  return (
    <section className={`rounded-2xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-center gap-2">
        <Gavel size={16} className="text-slate-700 dark:text-slate-300" aria-hidden="true" />
        <h3 className="text-[13.5px] font-bold text-slate-900 dark:text-white">{t("title")}</h3>
        <span className="ml-auto text-[11px] text-slate-500 dark:text-slate-400">{when}{ticket ? ` · ${ticket}` : ""}</span>
      </div>
      <p className="mt-2 text-[13.5px] font-semibold text-slate-900 dark:text-white">{t(outcomeKey as never)}</p>
      {amountLine && <p className="mt-1 text-[13px] text-slate-700 dark:text-slate-300">{amountLine}</p>}
      <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-900">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t("reasonLabel")}</p>
        <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-700 dark:text-slate-300">{reason}</p>
      </div>
      <p className="mt-3 text-[11.5px] leading-snug text-slate-500 dark:text-slate-400">
        {t("final")}{" "}
        <a href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`} className="font-semibold text-slate-700 underline-offset-2 hover:underline dark:text-slate-300">
          {t("recourse")}
        </a>
      </p>
    </section>
  );
}
