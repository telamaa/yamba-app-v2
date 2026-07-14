"use client";

import { useState } from "react";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import { ArrowDownLeft, ArrowUpRight, Lock } from "lucide-react";
import { StatCard } from "@/components/dashboard/DashboardUI";
import SectionHeader from "@/components/dashboard/SectionHeader";

/**
 * PREVIEW Finances — cible visuelle du chantier Stripe backend.
 * Paiements = vue Expéditeur (débits, séquestre, remboursements) ·
 * Portefeuille = vue Yamber (gains, J+4, versés).
 */

type Tab = "payments" | "wallet";

const BADGE = {
  escrow: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  done: "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  refund: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

function MoneyRow({
                    direction,
                    amount,
                    title,
                    sub,
                    badge,
                    badgeTone,
                  }: {
  direction: "in" | "out" | "locked";
  amount: string;
  title: string;
  sub: string;
  badge: string;
  badgeTone: keyof typeof BADGE;
}) {
  const Icon =
    direction === "in" ? ArrowDownLeft : direction === "locked" ? Lock : ArrowUpRight;
  const iconClass =
    "grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl " +
    (direction === "in"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300"
      : direction === "locked"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300"
        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400");
  const amountClass =
    "flex-none text-[13.5px] font-semibold " +
    (direction === "in"
      ? "text-emerald-700 dark:text-emerald-300"
      : "text-slate-900 dark:text-white");

  return (
    <div className="mb-1.5 flex items-center gap-3 rounded-lg bg-white px-4 py-3 transition-colors hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800/60">
      <div className={iconClass}>
        <Icon size={17} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium text-slate-900 dark:text-white">
          {title}
        </div>
        <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
          {sub}
        </div>
      </div>
      <span
        className={
          "hidden whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium sm:inline-flex " +
          BADGE[badgeTone]
        }
      >
        {badge}
      </span>
      <span className={amountClass}>{amount}</span>
    </div>
  );
}

export default function FinancesPreview() {
  const { lang } = useUiPreferences();
  const isFr = lang === "fr";
  const [tab, setTab] = useState<Tab>("payments");

  const chipBase = "rounded-full border px-3 py-1 text-xs font-medium transition-colors ";
  const chipInactive =
    "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60";
  const chipActive =
    "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900";

  return (
    <>
      <SectionHeader
        title="Finances"
        subtitle={isFr ? "Tes paiements, gains et versements" : "Your payments, earnings and payouts"}
      />
      <div className="mb-6 flex gap-2">
        {(["payments", "wallet"] as Tab[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={chipBase + (tab === k ? chipActive : chipInactive)}
          >
            {k === "payments" ? (isFr ? "Paiements" : "Payments") : (isFr ? "Portefeuille" : "Wallet")}
          </button>
        ))}
      </div>

      {tab === "payments" ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard label={isFr ? "En séquestre" : "In escrow"} value="103,75 €" />
            <StatCard label={isFr ? "Dépensé (total)" : "Spent (total)"} value="311,25 €" />
            <StatCard label={isFr ? "Remboursé" : "Refunded"} value="57,50 €" />
          </div>
          <MoneyRow direction="locked" amount="103,75 €" badgeTone="escrow"
                    badge={isFr ? "Séquestre · libéré à J+4" : "Escrow · released at D+4"}
                    title={isFr ? "Envoi Paris → Brazzaville" : "Shipment Paris → Brazzaville"}
                    sub={isFr ? "Thomas M. · Vêtements 2,5 kg · Visa ···4242 · YAMBA*COLIS" : "Thomas M. · Clothes 2.5 kg · Visa ···4242 · YAMBA*COLIS"} />
          <MoneyRow direction="out" amount="103,75 €" badgeTone="done"
                    badge={isFr ? "Payé" : "Paid"}
                    title={isFr ? "Envoi Paris → Pointe-Noire" : "Shipment Paris → Pointe-Noire"}
                    sub={isFr ? "Léa K. · Cosmétiques 1,8 kg · livré et confirmé le 3 juil." : "Léa K. · Cosmetics 1.8 kg · delivered and confirmed Jul 3"} />
          <MoneyRow direction="in" amount="+ 57,50 €" badgeTone="refund"
                    badge={isFr ? "Remboursé" : "Refunded"}
                    title={isFr ? "Demande expirée Paris → Kinshasa" : "Expired request Paris → Kinshasa"}
                    sub={isFr ? "Jules N. · sans réponse sous 24 h · remboursement intégral" : "Jules N. · no reply within 24 h · full refund"} />
        </>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard label={isFr ? "À venir (J+4)" : "Upcoming (D+4)"} value="89,30 €" />
            <StatCard label={isFr ? "Versé (total)" : "Paid out (total)"} value="267,90 €" change={isFr ? "+89,30 € ce mois" : "+€89.30 this month"} />
            <StatCard label={isFr ? "Deals payés" : "Paid deals"} value="3" />
          </div>
          <MoneyRow direction="locked" amount="89,30 €" badgeTone="escrow"
                    badge={isFr ? "À venir · 12 juil." : "Upcoming · Jul 12"}
                    title={isFr ? "Deal Aminata T. · Paris → Brazzaville" : "Deal Aminata T. · Paris → Brazzaville"}
                    sub={isFr ? "Livré le 8 juil. · versement auto à J+4 sauf signalement" : "Delivered Jul 8 · auto payout at D+4 unless disputed"} />
          <MoneyRow direction="in" amount="+ 89,30 €" badgeTone="done"
                    badge={isFr ? "Versé" : "Paid out"}
                    title={isFr ? "Deal Josué M. · Paris → Brazzaville" : "Deal Josué M. · Paris → Brazzaville"}
                    sub={isFr ? "Versé le 2 juil. · IBAN ···6789 via Stripe" : "Paid out Jul 2 · IBAN ···6789 via Stripe"} />
          <MoneyRow direction="in" amount="+ 178,60 €" badgeTone="done"
                    badge={isFr ? "Versé" : "Paid out"}
                    title={isFr ? "Trajet du 28 juin · 2 deals" : "Trip of Jun 28 · 2 deals"}
                    sub={isFr ? "Aminata T. + Josué M. · versé le 2 juil." : "Aminata T. + Josué M. · paid out Jul 2"} />
        </>
      )}
    </>
  );
}
