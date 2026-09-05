"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useBookingDraft } from "@/hooks/useBookingDraft";
import { useBookingCheckout } from "./useBookingCheckout";
import { canContinueStep, computeTotal, validateStep } from "./booking.config";
import type { Step, TripContext, ValidationErrors } from "./booking.types";
import BookingBottomSheet from "./BookingBottomSheet";
import BookingHeader from "./BookingHeader";
import BookingStepperMobile from "./BookingStepperMobile";
import StepCharter from "./steps/StepCharter";
import StepParcel from "./steps/StepParcel";
import dynamic from "next/dynamic";
// Stripe (react-stripe-js + stripe-js) ne sert qu'à l'étape 4 : chargé à la
// demande → le bundle de l'étape 1 n'embarque pas Stripe.
const StepPayment = dynamic(() => import("./steps/StepPayment"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[240px] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-[#FF9900]" />
    </div>
  ),
});
import StepRecipient from "./steps/StepRecipient";
import { usePricingParams } from "@/hooks/usePricingParams";

const EMPTY_ERRORS: ValidationErrors = {};

type Props = {
  trip: TripContext;
  onCloseAction: () => void;
};

export default function BookingMobile({ trip, onCloseAction }: Props) {
  const t = useTranslations("booking");
  const locale = useLocale();
  const isFr = locale === "fr";

  const { draft, setDraft, step, setStep, clear } = useBookingDraft();
  const [showErrors, setShowErrors] = useState(false);
  const checkout = useBookingCheckout({ draft, trip, step, clear });
  const isSubmitting = checkout.isSubmitting;

  const errors = useMemo<ValidationErrors>(() => {
    if (!showErrors) return EMPTY_ERRORS;
    return validateStep(step, draft, trip, isFr);
  }, [showErrors, step, draft, trip, isFr]);

  useEffect(() => {
    setShowErrors(false);
  }, [step]);

  const pricingParams = usePricingParams(); // D62 7A — valeurs du serveur, défauts du moteur en attendant
  const price = useMemo(() => computeTotal(draft, trip, pricingParams), [draft, trip, pricingParams]);

  const nextStep = () => {
    if (!canContinueStep(step, draft, trip, isFr)) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStep((s) => (s < 4 ? ((s + 1) as Step) : s));
  };

  const prevStep = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : s));

  const handleSubmit = checkout.submit;

  const subtitle = `${trip.originCity} → ${trip.destinationCity}`;

  const ctaLabel =
    step === 4
      ? t("pay", { amount: formatPrice(price.total, locale) })
      : step === 3
        ? t("goToPayment")
        : t("continue");

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      <BookingHeader
        subtitle={subtitle}
        onBackAction={onCloseAction}
        onCloseAction={onCloseAction}
      />

      <BookingStepperMobile current={step} />

      <div className="flex-1 overflow-y-auto pb-40">{/* pb-40 : la barre basse (total + CTA) recouvre ~150 px — le dernier bloc doit rester atteignable */}
        {step === 1 && (
          <StepParcel
            trip={trip}
            draft={draft}
            setDraftAction={setDraft}
            errors={errors}
          />
        )}
        {step === 2 && (
          <StepRecipient
            draft={draft}
            setDraftAction={setDraft}
            errors={errors}
          />
        )}
        {step === 3 && (
          <StepCharter
            draft={draft}
            setDraftAction={setDraft}
            errors={errors}
          />
        )}
        {step === 4 && (
          <StepPayment
            price={price}
            intent={checkout.intent}
            intentLoading={checkout.intentLoading}
            intentError={checkout.intentError}
            onRetryAction={checkout.refreshIntent}
            registerConfirmAction={checkout.registerConfirm}
          />
        )}
      </div>

      <BookingBottomSheet
        trip={trip}
        draft={draft}
        price={price}
        currentStep={step}
        ctaPrimaryLabel={ctaLabel}
        ctaPrimaryDisabled={isSubmitting}
        ctaIsLock={step === 4}
        onCtaPrimaryAction={step < 4 ? nextStep : handleSubmit}
        showBackButton={step > 1}
        onBackAction={prevStep}
      />
    </div>
  );
}

function formatPrice(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}
