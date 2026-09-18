"use client";

/**
 * Finances — Paiements (Expéditeur) + Portefeuille (Voyageur), données RÉELLES (A83/A84)
 * =======================================================================================
 * Tout vient de GET /me/wallet (totaux calculés serveur — décision 2A) ;
 * le front affiche, ne recalcule rien. Trois cartes + une liste par onglet
 * (décision 4A), bandeau « finalise ton compte Stripe » quand un versement
 * est bloqué, bouton vers le tableau de bord Stripe Express (3A).
 * Passé sous next-intl (espace `finances`, 5A) — fin du `isFr` inline.
 */

import { useState } from "react";
import { CreditCard, ExternalLink, Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import apiClient from "@/lib/api-client";
import useUser from "@/hooks/useUser";
import { useWallet } from "@/hooks/useWallet";
import { DashboardCopy } from "@/app/[locale]/dashboard/dashboard.copy";
import SectionHeader from "@/components/dashboard/SectionHeader";
import { EmptyState, RowSkeleton, StatCard, StatCardSkeleton } from "@/components/dashboard/DashboardUI";
import PayoutBlockedBanner from "@/components/dashboard/trips/PayoutBlockedBanner";
import SudoGate from "@/components/dashboard/sections/SudoGate";
import { isSudoRequired } from "@/services/account.api";
import { PaymentRow, PayoutRow, formatCents } from "@/components/dashboard/finances/WalletRows";

type FinancesTab = "payments" | "wallet";

export default function FinancesSection({ copy }: { copy: DashboardCopy }) {
  const t = useTranslations("finances");
  const locale = useLocale();
  const router = useRouter();
  const { user } = useUser();
  const isCarrier = Boolean(user?.roles?.includes("CARRIER"));
  // ANO-WEB-103 (chapitre 7) : `useState(isCarrier ? … : …)` n'était évalué qu'au MONTAGE, avant que le membre soit
  // chargé — un Voyageur qui ouvrait Finances directement restait sur « Paiements » (vide), sans ses gains ni le lien
  // Stripe. L'onglet est désormais DÉRIVÉ tant que le membre n'a rien choisi.
  const [choix, setTab] = useState<FinancesTab | null>(null);
  const tab: FinancesTab = choix ?? (isCarrier ? "wallet" : "payments");
  const { data, isPending, isError, refetch } = useWallet();

  const chipBase = "rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ";
  const chipActive = "bg-slate-900 text-white dark:bg-white dark:text-slate-900";
  const chipInactive = "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700";

  return (
    <div>
      <SectionHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="mb-5 flex gap-2">
        {(["wallet", "payments"] as FinancesTab[]).map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={chipBase + (tab === k ? chipActive : chipInactive)}>
            {t(`tabs.${k}`)}
          </button>
        ))}
      </div>

      {isPending ? (
        /* Skeleton fidèle : les trois cartes de totaux puis les rangées — plus de texte « Chargement… » */
        <div className="space-y-5" aria-busy="true">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <RowSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : isError || !data ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {t("error")}{" "}
          <button type="button" onClick={() => void refetch()} className="font-semibold underline">
            {t("retry")}
          </button>
        </div>
      ) : tab === "wallet" ? (
        <WalletTab data={data.carrier} isCarrier={isCarrier} locale={locale} sudoCopy={copy.sudo} onBecomeCarrierAction={() => router.push("/carrier/onboarding")} />
      ) : (
        <PaymentsTab data={data.shipper} locale={locale} onSearchAction={() => router.push("/search")} />
      )}
    </div>
  );
}

/* ── Portefeuille Voyageur ───────────────────────────────────── */

function WalletTab({ data, isCarrier, locale, sudoCopy, onBecomeCarrierAction }: {
  sudoCopy: DashboardCopy["sudo"];
  data: { upcomingCents: number; pendingCents: number; blockedCents: number; sentCents: number; sentThisMonthCents: number; currencyCode: string; items: Parameters<typeof PayoutRow>[0]["item"][] };
  isCarrier: boolean;
  locale: string;
  onBecomeCarrierAction: () => void;
}) {
  const t = useTranslations("finances.wallet");
  const [opening, setOpening] = useState(false);
  const cur = data.currencyCode;

  const [stripeGate, setStripeGate] = useState(false); // D65 1A — l'IBAN vit chez Stripe : geste sensible
  const openStripe = async () => {
    if (opening) return;
    setOpening(true);
    try {
      const res = await apiClient.post<{ success: boolean; url: string }>("/carrier/stripe/dashboard-link", {}, { requireAuth: true });
      setStripeGate(false);
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      if (isSudoRequired(e)) setStripeGate(true);
      else if ((e as { response?: { data?: { details?: { code?: string } } } })?.response?.data?.details?.code === "STRIPE_ACCOUNT_MISSING") toast.info(t("stripeMissing"));
      else toast.error(t("stripeError"));
    } finally {
      setOpening(false);
    }
  };

  if (data.items.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title={t("empty.title")}
        description={isCarrier ? t("empty.text") : t("empty.notCarrier")}
        actionLabel={isCarrier ? undefined : t("empty.cta")}
        onAction={isCarrier ? undefined : onBecomeCarrierAction}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PayoutBlockedBanner />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stripeGate && <div className="md:col-span-3"><SudoGate copy={sudoCopy} onVerifiedAction={openStripe} onCancelAction={() => setStripeGate(false)} /></div>}
        <StatCard label={t("stats.upcoming")} value={formatCents(data.upcomingCents, cur, locale)} change={t("stats.upcomingHint")} />
        <StatCard
          label={t("stats.sent")}
          value={formatCents(data.sentCents, cur, locale)}
          change={data.sentThisMonthCents > 0 ? t("stats.sentThisMonth", { amount: formatCents(data.sentThisMonthCents, cur, locale) }) : undefined}
        />
        <StatCard label={t("stats.pending")} value={formatCents(data.pendingCents, cur, locale)} change={t("stats.pendingHint")} />
      </div>

      {isCarrier && (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px] text-slate-600 dark:text-slate-400">{t("stripeHint")}</p>
          <button
            type="button"
            // ANO-WEB-104 (chapitre 7) : le bouton testait `carrierPage.stripeAccountId`, que /auth/me ne sert JAMAIS (liste
            // blanche) — tous les Voyageurs voyaient « Finalise d'abord ton compte Stripe », le serveur n'était jamais appelé.
            // Le serveur décide (porte par code, puis STRIPE_ACCOUNT_MISSING) ; le front traduit.
            onClick={openStripe}
            disabled={opening}
            className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            <ExternalLink size={13} aria-hidden="true" />
            {t("stripeCta")}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {data.items.map((item) => (
          <PayoutRow key={item.bookingId} item={item} />
        ))}
      </div>
    </div>
  );
}

/* ── Paiements Expéditeur ────────────────────────────────────── */

function PaymentsTab({ data, locale, onSearchAction }: {
  data: { heldCents: number; spentCents: number; refundedCents: number; currencyCode: string; items: Parameters<typeof PaymentRow>[0]["item"][] };
  locale: string;
  onSearchAction: () => void;
}) {
  const t = useTranslations("finances.payments");
  const cur = data.currencyCode;
  if (data.items.length === 0) {
    return <EmptyState icon={CreditCard} title={t("empty.title")} description={t("empty.text")} actionLabel={t("empty.cta")} onAction={onSearchAction} />;
  }
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t("stats.held")} value={formatCents(data.heldCents, cur, locale)} change={t("stats.heldHint")} />
        <StatCard label={t("stats.spent")} value={formatCents(data.spentCents, cur, locale)} />
        <StatCard label={t("stats.refunded")} value={formatCents(data.refundedCents, cur, locale)} />
      </div>
      <div className="space-y-2">
        {data.items.map((item) => (
          <PaymentRow key={item.bookingId} item={item} />
        ))}
      </div>
    </div>
  );
}
