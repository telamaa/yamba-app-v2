/**
 * StepPayment.tsx
 * ===============
 * Step 4: payment with Stripe Elements (deferred intent mode).
 */

"use client";

import { Elements, PaymentElement } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { CreditCard, Route as RouteIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { MANGO, PaymentMethodOption, TipBlock, TrustBadge } from "../BookingFormUi";
import type { Draft, PaymentMethod, PriceBreakdown } from "../booking.types";

type Props = {
  draft: Draft;
  setDraftAction: (updater: (prev: Draft) => Draft) => void;
  price: PriceBreakdown;
};

const AFTER_PAYMENT_KEYS = ["step1", "step2", "step3", "step4", "step5"] as const;

let cachedStripePromise: Promise<Stripe | null> | null = null;

function getStripePromise(): Promise<Stripe | null> | null {
  if (cachedStripePromise) return cachedStripePromise;
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    console.warn(
      "[booking] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing — Stripe Elements will not render."
    );
    return null;
  }
  cachedStripePromise = loadStripe(key);
  return cachedStripePromise;
}

export default function StepPayment({ draft, setDraftAction, price }: Props) {
  const t = useTranslations("booking");
  const stripePromise = useMemo(() => getStripePromise(), []);
  const isDark = useIsDarkMode();

  const setMethod = (method: PaymentMethod) =>
    setDraftAction((prev) => ({ ...prev, paymentMethod: method }));

  const afterPayment = AFTER_PAYMENT_KEYS.map((key) =>
    t(`step4.afterPayment.${key}`)
  );

  return (
    <div className="px-4 py-5 md:px-0 md:py-0">
      <h1 className="mb-1.5 text-[19px] font-medium tracking-tight md:text-[22px]">
        {t("step4.title")}
      </h1>
      <p className="mb-5 text-[13px] text-slate-500 dark:text-slate-400 md:text-[14px] md:mb-6">
        {t("step4.subtitle")}
      </p>

      <div className="mb-2.5 text-[14px] font-medium">
        {t("step4.methodTitle")}
      </div>

      {/* Card option */}
      <PaymentMethodOption
        selected={draft.paymentMethod === "CARD"}
        onSelectAction={() => setMethod("CARD")}
        iconVariant="card"
        icon={<CreditCard size={18} />}
        title={t("step4.card.title")}
        description={t("step4.card.description")}
      />

      {draft.paymentMethod === "CARD" && (
        <div className="mb-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-900">
          {stripePromise ? (
            <Elements
              stripe={stripePromise}
              options={{
                mode: "payment",
                amount: Math.max(50, Math.round(price.total * 100)),
                currency: "eur",
                paymentMethodCreation: "manual",
                appearance: {
                  theme: isDark ? "night" : "stripe",
                  variables: {
                    colorPrimary: MANGO,
                    borderRadius: "8px",
                    fontSizeBase: "13px",
                  },
                },
              }}
            >
              <PaymentElement
                options={{
                  layout: { type: "tabs", defaultCollapsed: false },
                }}
              />
            </Elements>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-[12px] text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {t("step4.loadingMessage")}
            </div>
          )}
        </div>
      )}

      <PaymentMethodOption
        selected={draft.paymentMethod === "APPLE_PAY"}
        onSelectAction={() => setMethod("APPLE_PAY")}
        iconVariant="apple"
        icon={<AppleIcon />}
        title={t("step4.applePay.title")}
        description={t("step4.applePay.description")}
      />

      <PaymentMethodOption
        selected={draft.paymentMethod === "GOOGLE_PAY"}
        onSelectAction={() => setMethod("GOOGLE_PAY")}
        iconVariant="google"
        icon={<GoogleIcon />}
        title={t("step4.googlePay.title")}
        description={t("step4.googlePay.description")}
      />

      <div className="mt-6">
        <TipBlock
          icon={<RouteIcon size={16} />}
          title={t("step4.afterPayment.title")}
          items={afterPayment}
          ordered
        />
      </div>

      <TrustBadge message={t("step4.trustStripe")} />
    </div>
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

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.04c-.03-2.97 2.43-4.39 2.54-4.46-1.39-2.03-3.55-2.31-4.32-2.34-1.84-.19-3.59 1.08-4.52 1.08-.95 0-2.38-1.06-3.91-1.03-2.01.03-3.87 1.17-4.91 2.97C-.18 12.03 1.4 17.4 3.43 20.35c.99 1.45 2.18 3.08 3.71 3.02 1.5-.06 2.06-.96 3.87-.96 1.79 0 2.32.96 3.91.93 1.62-.03 2.64-1.48 3.62-2.94 1.15-1.68 1.62-3.32 1.65-3.4-.04-.02-3.16-1.21-3.19-4.79 0 0 .03-.08.03-.13zM14.46 3.34c.82-1 1.37-2.38 1.22-3.76-1.18.05-2.61.78-3.46 1.77-.76.88-1.43 2.29-1.25 3.64 1.32.1 2.66-.66 3.49-1.65z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M21.35 11.1H12v3.83h5.4c-.5 2.4-2.6 3.7-5.4 3.7-3.3 0-6-2.7-6-6s2.7-6 6-6c1.5 0 2.8.5 3.85 1.4l2.85-2.85C16.65 2.65 14.5 1.7 12 1.7 6.45 1.7 2 6.15 2 11.7s4.45 10 10 10c5.75 0 9.55-4.05 9.55-9.75 0-.65-.05-1.25-.2-1.85z"
        fill="#4285F4"
      />
    </svg>
  );
}
