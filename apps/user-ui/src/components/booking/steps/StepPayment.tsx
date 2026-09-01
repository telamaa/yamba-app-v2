/**
 * StepPayment.tsx — étape 4 : UN seul Payment Element (B2, A30)
 * ==============================================================
 * Carte, Apple Pay et Google Pay vivent DANS le Payment Element de Stripe
 * (automatic_payment_methods côté serveur) : plus de radios maison — moins
 * de code, moins d'erreurs, et le wallet natif apparaît tout seul sur mobile.
 *
 * Le bouton « Payer » est dans le récap (sidebar / bottom sheet) : l'étape
 * enregistre auprès du hook une fonction `confirm` qui appelle
 * stripe.confirmPayment sans redirection (sauf 3-D Secure : return_url).
 */

"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { FlaskConical, RefreshCw, Route as RouteIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { MANGO, TipBlock, TrustBadge } from "../BookingFormUi";
import type { PaymentIntentInfo, PriceBreakdown } from "../booking.types";
import type { ConfirmPaymentFn } from "../useBookingCheckout";

type Props = {
  price: PriceBreakdown;
  intent: PaymentIntentInfo | null;
  intentLoading: boolean;
  intentError: string | null;
  onRetryAction: () => void;
  registerConfirmAction: (fn: ConfirmPaymentFn | null) => void;
};

const AFTER_PAYMENT_KEYS = ["step1", "step2", "step3", "step4", "step5"] as const;

let cachedStripePromise: Promise<Stripe | null> | null = null;
function getStripePromise(): Promise<Stripe | null> | null {
  if (cachedStripePromise) return cachedStripePromise;
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return null;
  cachedStripePromise = loadStripe(key);
  return cachedStripePromise;
}

export default function StepPayment({ price, intent, intentLoading, intentError, onRetryAction, registerConfirmAction }: Props) {
  const t = useTranslations("booking");
  const stripePromise = useMemo(() => getStripePromise(), []);
  const isDark = useIsDarkMode();
  const afterPayment = AFTER_PAYMENT_KEYS.map((key) => t(`step4.afterPayment.${key}`));
  const amountLabel = `${(price.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

  // Le Payment Element peut échouer à se charger APRÈS un intent valide
  // (clé publiable d'un autre compte que la clé secrète, réseau, adblock…).
  // Sans ce garde-fou, l'échec est silencieux : une boîte vide.
  const [elementError, setElementError] = useState(false);
  useEffect(() => setElementError(false), [intent?.paymentIntentId]);

  return (
    <div className="px-4 py-5 md:px-0 md:py-0">
      <h1 className="mb-1.5 text-[19px] font-medium tracking-tight md:text-[22px]">{t("step4.title")}</h1>
      <p className="mb-5 text-[13px] text-slate-500 dark:text-slate-400 md:mb-6 md:text-[14px]">{t("step4.subtitle")}</p>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        {intentError || elementError ? (
          <div className="space-y-3">
            <p className="text-[13px] text-slate-700 dark:text-slate-300">
              {intentError ?? t("step4.elementLoadError")}
            </p>
            <button
              type="button"
              onClick={onRetryAction}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 px-4 text-[13px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw size={15} /> {t("step4.retry")}
            </button>
          </div>
        ) : intentLoading || !intent ? (
          <div className="flex min-h-[120px] items-center justify-center gap-3 text-[13px] text-slate-500 dark:text-slate-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[#FF9900]" />
            {t("step4.loadingMessage")}
          </div>
        ) : intent.provider === "FAKE" ? (
          <div className="flex items-start gap-3 text-[13px] text-slate-700 dark:text-slate-300">
            <span className="mt-0.5 rounded-md bg-[#0F766E]/10 p-1.5 text-[#0F766E] dark:bg-[#0F766E]/30 dark:text-teal-300">
              <FlaskConical size={16} />
            </span>
            <p>{t("step4.testMode", { amount: amountLabel })}</p>
          </div>
        ) : stripePromise && intent.clientSecret ? (
          <Elements
            key={intent.paymentIntentId}
            stripe={stripePromise}
            options={{
              clientSecret: intent.clientSecret,
              appearance: {
                theme: isDark ? "night" : "stripe",
                variables: { colorPrimary: MANGO, borderRadius: "8px", fontSizeBase: "14px" },
              },
            }}
          >
            <PaymentForm
              registerConfirmAction={registerConfirmAction}
              onLoadErrorAction={() => setElementError(true)}
            />
          </Elements>
        ) : (
          <p className="text-[13px] text-slate-600 dark:text-slate-400">{t("step4.stripeMissing")}</p>
        )}
      </div>

      <div className="mt-6">
        <TipBlock icon={<RouteIcon size={16} />} title={t("step4.afterPayment.title")} items={afterPayment} ordered />
      </div>

      <TrustBadge message={t("step4.trustStripe")} />
    </div>
  );
}

/** Dans le contexte <Elements> : expose `confirm` au hook de checkout. */
function PaymentForm({
  registerConfirmAction,
  onLoadErrorAction,
}: {
  registerConfirmAction: (fn: ConfirmPaymentFn | null) => void;
  onLoadErrorAction: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const t = useTranslations("booking");

  useEffect(() => {
    if (!stripe || !elements) {
      registerConfirmAction(null);
      return;
    }
    registerConfirmAction(async () => {
      const { error } = await stripe.confirmPayment({
        elements,
        redirect: "if_required", // 3-D Secure seulement : sinon on reste sur la page
        confirmParams: { return_url: `${window.location.origin}${window.location.pathname}` },
      });
      if (error) return { ok: false, message: error.message ?? t("step4.confirmFailed") };
      return { ok: true };
    });
    return () => registerConfirmAction(null);
  }, [stripe, elements, registerConfirmAction, t]);

  return (
    <PaymentElement
      options={{ layout: { type: "tabs", defaultCollapsed: false } }}
      onLoadError={(event) => {
        // La vraie cause (ex. « No such payment_intent » = clé publiable d'un
        // AUTRE compte Stripe que la clé secrète du serveur) est pour le dev ;
        // l'utilisateur reçoit un message générique + Réessayer.
        console.error("[StepPayment] Payment Element load error:", event.error?.message ?? event.error);
        onLoadErrorAction();
      }}
    />
  );
}

function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}
