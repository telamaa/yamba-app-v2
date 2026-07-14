"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Wallet } from "lucide-react";
import useUser from "@/hooks/useUser";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import { DashboardCopy } from "@/app/[locale]/dashboard/dashboard.copy";
import SectionHeader from "@/components/dashboard/SectionHeader";
import { EmptyState } from "@/components/dashboard/DashboardUI";

const MANGO = "#FF9900";

/**
 * Finances — fusion Paiements + Portefeuille en une page à onglets.
 * Remplace les sections payments/wallet (segments aliasés dans
 * dashboard.config). États vides honnêtes : le contenu réel arrive
 * avec le chantier Stripe backend (transactions, escrow, versements J+4).
 * Dette assumée : isFr inline (comme le module trips réel), migration
 * next-intl au branchement Stripe.
 */

type FinancesTab = "payments" | "wallet";

export default function FinancesSection({ copy }: { copy: DashboardCopy }) {
  void copy; // signature conservée pour le renderer
  const { lang } = useUiPreferences();
  const isFr = lang === "fr";
  const router = useRouter();
  const [tab, setTab] = useState<FinancesTab>("payments");

  const { user } = useUser();
  const carrierPage = (user as any)?.carrierPage;
  const isCarrier = Boolean((user as any)?.roles?.includes("CARRIER"));
  const stripeConfigured = Boolean(
    carrierPage?.stripeOnboardingComplete && carrierPage?.stripeChargesEnabled
  );

  const tabs: { key: FinancesTab; label: string }[] = [
    { key: "payments", label: isFr ? "Paiements" : "Payments" },
    { key: "wallet", label: isFr ? "Portefeuille" : "Wallet" },
  ];

  const chipBase =
    "rounded-full border px-3 py-1 text-xs font-medium transition-colors ";
  const chipInactive =
    "border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 " +
    "dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white";
  const chipActive =
    "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900";

  return (
    <>
      <SectionHeader
        title={isFr ? "Finances" : "Finances"}
        subtitle={
          isFr
            ? "Tes paiements, gains et versements"
            : "Your payments, earnings and payouts"
        }
      />

      {/* Onglets */}
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={chipBase + (tab === t.key ? chipActive : chipInactive)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "payments" ? (
        /* TODO chantier Stripe backend : historique des transactions
           Expéditeur (débits, remboursements, statut escrow). */
        <EmptyState
          icon={CreditCard}
          title={isFr ? "Aucun paiement pour l'instant" : "No payments yet"}
          description={
            isFr
              ? "Tes paiements apparaîtront ici après ta première réservation de transport."
              : "Your payments will appear here after your first transport booking."
          }
          actionLabel={isFr ? "Chercher un trajet" : "Search trips"}
          onAction={() => router.push("/search")}
        />
      ) : (
        <>
          {/* TODO chantier Stripe backend : gains par deal, versements
             J+4, solde en séquestre, lien Stripe Express Dashboard. */}
          <EmptyState
            icon={Wallet}
            title={isFr ? "Aucun gain pour l'instant" : "No earnings yet"}
            description={
              isFr
                ? "Tes gains apparaîtront ici après ton premier colis livré. Les versements sont effectués à J+4 après livraison validée."
                : "Your earnings will appear here after your first delivered parcel. Payouts are sent at D+4 after validated delivery."
            }
            actionLabel={
              isCarrier
                ? undefined
                : isFr
                  ? "Devenir Yamber"
                  : "Become a Yamber"
            }
            onAction={
              isCarrier ? undefined : () => router.push("/carrier/onboarding")
            }
          />

          {/* Hint Stripe si carrier sans compte configuré */}
          {isCarrier && !stripeConfigured && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-500/10">
              <p className="text-[13px] font-medium text-amber-800 dark:text-amber-300">
                {isFr
                  ? "Stripe n'est pas encore configuré"
                  : "Stripe is not configured yet"}
              </p>
              <p className="mt-0.5 text-[12px] text-amber-600 dark:text-amber-400">
                {isFr
                  ? "Connecte ton compte bancaire pour recevoir tes versements."
                  : "Connect your bank account to receive your payouts."}
              </p>
              <button
                type="button"
                onClick={() => router.push("/carrier/onboarding?step=stripe")}
                className="mt-2.5 rounded-lg px-3.5 py-1.5 text-[12px] font-semibold text-slate-900 transition-[filter] hover:brightness-95"
                style={{ backgroundColor: MANGO }}
              >
                {isFr ? "Configurer Stripe" : "Configure Stripe"}
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
