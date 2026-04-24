"use client";

import { useRouter } from "next/navigation";
import { Globe, CreditCard, AlertCircle, CheckCircle2 } from "lucide-react";
import useUser from "@/hooks/useUser";
import { DashboardCopy } from "@/app/dashboard/dashboard.copy";
import SectionHeader from "@/components/dashboard/SectionHeader";
import { CardSection, EmptyState, SettingRow } from "@/components/dashboard/DashboardUI";

const MANGO = "#FF9900";

export default function BecomeYamber({ copy }: { copy: DashboardCopy }) {
  const { user } = useUser();
  const router = useRouter();

  const hasCarrier = user?.roles?.includes("CARRIER");
  const carrierPage = user?.carrierPage;

  // Stripe status — use actual flags, not just stripeAccountId
  const stripeConfigured =
    carrierPage?.stripeOnboardingComplete && carrierPage?.stripeChargesEnabled;
  const stripeAccountExists = !!carrierPage?.stripeAccountId;

  // Address display
  const addressDisplay = carrierPage?.primaryAddress
    ? carrierPage.primaryAddress.formattedAddress ||
    [carrierPage.primaryAddress.city, carrierPage.primaryAddress.country]
      .filter(Boolean)
      .join(", ") ||
    "—"
    : "—";

  // Stripe status label
  const getStripeLabel = (isFr: boolean) => {
    if (stripeConfigured) return isFr ? "Compte actif" : "Account active";
    if (stripeAccountExists) return isFr ? "Configuration incomplète" : "Setup incomplete";
    return isFr ? "Non configuré" : "Not configured";
  };

  // Stripe action label
  const getStripeAction = (isFr: boolean) => {
    if (stripeConfigured) return isFr ? "Gérer" : "Manage";
    return isFr ? "Configurer" : "Configure";
  };

  // Banner message based on actual status
  const isFr = true; // Will be derived from copy context
  const getBannerConfig = () => {
    if (!hasCarrier || !carrierPage) return null;

    if (stripeConfigured) {
      return {
        icon: CheckCircle2,
        text: isFr
          ? "Onboarding terminé · Stripe Connect actif"
          : "Onboarding complete · Stripe Connect active",
        bg: "bg-emerald-50 dark:bg-emerald-500/10",
        border: "border-emerald-200 dark:border-emerald-800",
        textColor: "text-emerald-700 dark:text-emerald-400",
        iconColor: "text-emerald-500",
      };
    }

    return {
      icon: AlertCircle,
      text: isFr
        ? "Profil actif · Stripe non configuré — vous ne pouvez pas encore recevoir de paiements"
        : "Profile active · Stripe not configured — you cannot receive payments yet",
      bg: "bg-amber-50 dark:bg-amber-500/10",
      border: "border-amber-200 dark:border-amber-800",
      textColor: "text-amber-700 dark:text-amber-400",
      iconColor: "text-amber-500",
    };
  };

  const banner = getBannerConfig();

  return (
    <>
      <SectionHeader title={copy.yamber.title} subtitle={copy.yamber.sub} />

      {hasCarrier && carrierPage ? (
        <>
          {/* Status banner */}
          {banner && (
            <div
              className={`mb-6 flex items-center gap-3 rounded-xl border p-4 ${banner.bg} ${banner.border}`}
            >
              <banner.icon size={20} className={banner.iconColor} />
              <span className={`text-[13px] font-medium ${banner.textColor}`}>
                {banner.text}
              </span>
            </div>
          )}

          <CardSection>
            <SettingRow
              label={isFr ? "Nom du profil" : "Profile name"}
              description={carrierPage.name ?? "—"}
              actionLabel={copy.edit}
              onAction={() => router.push("/carrier/onboarding?step=profile")}
            />
            <SettingRow
              label="Bio"
              description={carrierPage.bio ?? "—"}
              actionLabel={copy.edit}
              onAction={() => router.push("/carrier/onboarding?step=profile")}
            />
            <SettingRow
              label={isFr ? "Adresse principale" : "Main address"}
              description={addressDisplay}
              actionLabel={copy.edit}
              onAction={() => router.push("/carrier/onboarding?step=profile")}
            />
            <SettingRow
              label="Stripe Connect"
              description={getStripeLabel(isFr)}
              actionLabel={getStripeAction(isFr)}
              onAction={() => {
                if (stripeConfigured) {
                  // TODO: open Stripe dashboard or manage page
                  router.push("/dashboard/wallet");
                } else {
                  // Redirect to Stripe onboarding step
                  router.push("/carrier/onboarding?step=stripe");
                }
              }}
              // variant={!stripeConfigured ? "warning" : "default"}
            />
          </CardSection>

          {/* CTA to configure Stripe if not done */}
          {!stripeConfigured && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-500/10">
              <div className="flex items-start gap-3">
                <CreditCard size={20} className="mt-0.5 flex-shrink-0 text-amber-500" />
                <div className="flex-1">
                  <p className="text-[14px] font-medium text-amber-800 dark:text-amber-300">
                    {isFr
                      ? "Configurez Stripe pour recevoir vos paiements"
                      : "Configure Stripe to receive payments"}
                  </p>
                  <p className="mt-1 text-[13px] text-amber-600 dark:text-amber-400">
                    {isFr
                      ? "Connectez votre compte bancaire via Stripe pour recevoir les paiements des expéditeurs."
                      : "Connect your bank account via Stripe to receive payments from shippers."}
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push("/carrier/onboarding?step=stripe")}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:opacity-90"
                    style={{ backgroundColor: MANGO }}
                  >
                    <CreditCard size={14} />
                    {isFr ? "Configurer Stripe" : "Configure Stripe"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={Globe}
          title={copy.yamber.title}
          description={copy.yamber.sub}
          actionLabel={copy.yamber.title}
          onAction={() => router.push("/carrier/onboarding")}
        />
      )}
    </>
  );
}
