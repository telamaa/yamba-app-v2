"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useBookingDraft } from "@/hooks/useBookingDraft";
import { createDeal } from "@/services/booking.api";
import { canContinueStep, computeTotal, validateStep } from "./booking.config";
import type { Step, TripContext, ValidationErrors } from "./booking.types";
import BookingBottomSheet from "./BookingBottomSheet";
import BookingHeader from "./BookingHeader";
import BookingStepperMobile from "./BookingStepperMobile";
import StepCharter from "./steps/StepCharter";
import StepParcel from "./steps/StepParcel";
import StepPayment from "./steps/StepPayment";
import StepRecipient from "./steps/StepRecipient";

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const errors = useMemo<ValidationErrors>(() => {
    if (!showErrors) return EMPTY_ERRORS;
    return validateStep(step, draft, trip, isFr);
  }, [showErrors, step, draft, trip, isFr]);

  useEffect(() => {
    setShowErrors(false);
  }, [step]);

  const price = useMemo(() => computeTotal(draft, trip), [draft, trip]);

  const nextStep = () => {
    if (!canContinueStep(step, draft, trip, isFr)) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStep((s) => (s < 4 ? ((s + 1) as Step) : s));
  };

  const prevStep = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : s));

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await createDeal(draft, trip);
      toast.success(
        isFr
          ? `Demande envoyée (mock — id : ${result.dealId})`
          : `Request sent (mock — id: ${result.dealId})`,
        { duration: 4500 }
      );
      clear();
      onCloseAction();
    } catch {
      toast.error(isFr ? "Erreur lors de l'envoi" : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

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

      <div className="flex-1 overflow-y-auto pb-4">
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
            draft={draft}
            setDraftAction={setDraft}
            price={price}
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
