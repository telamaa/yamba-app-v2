"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import { useCreateTrip, useUpdateTrip } from "@/hooks/useTrip";
import { useEditTrip } from "@/hooks/useEditTrip";
import { setFlashToast } from "@/lib/flash-toast";
import type { Draft, ParcelCategory, Step } from "./create-trip.types";
import { initialDraft } from "./create-trip.state";
import { getCreateTripCopy } from "./create-trip.copy";
import useUser from "@/hooks/useUser";
import {
  canContinueStep,
  createDefaultCategoryCondition,
  validateStep1,
  validateStep2,
  saveDraftToStorage,
  loadDraftFromStorage,
  clearDraftStorage,
  type ValidationErrors,
} from "./create-trip.config";
import TripStepper from "./TripStepper";
import TripLiveSummary from "./TripLiveSummary";
import StepTrip from "./steps/StepTrip";
import StepConditions from "./steps/StepConditions";
import StepReview from "./steps/StepReview";
import { ErrorSummary } from "./TripFormUi";

const MANGO = "#FF9900";
const TEAL = "#0F766E";
const EMPTY_ERRORS: ValidationErrors = {};

export default function CreateTripWizard() {
  const { lang } = useUiPreferences();
  const router = useRouter();
  const isFr = lang === "fr";
  const copy = useMemo(() => getCreateTripCopy(isFr), [isFr]);

  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [shakeFields, setShakeFields] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // ── API ──
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const isPublishing = createTrip.isPending || updateTrip.isPending;
  const { user } = useUser();

  // ── Edit mode ──
  const { editTripId, isEditMode, editDraft, isLoadingEdit } = useEditTrip();

  useEffect(() => {
    if (editDraft) {
      setDraft(editDraft);
      setShowResumeBanner(false);
    }
  }, [editDraft]);

  // ── Validation ──
  const errors = useMemo<ValidationErrors>(() => {
    if (!showErrors) return EMPTY_ERRORS;
    if (step === 1) return validateStep1(draft, isFr);
    if (step === 2) return validateStep2(draft, isFr);
    return EMPTY_ERRORS;
  }, [showErrors, step, draft, isFr]);

  useEffect(() => {
    setShowErrors(false);
  }, [step]);

  // ── Draft persistence (localStorage) — only in create mode ──
  useEffect(() => {
    if (isEditMode) return;
    const saved = loadDraftFromStorage();
    if (saved && typeof saved === "object" && "transportMode" in (saved as Draft)) {
      setShowResumeBanner(true);
    }
  }, [isEditMode]);

  const resumeDraft = () => {
    const saved = loadDraftFromStorage() as Draft | null;
    if (saved) {
      if (saved.departureDate) saved.departureDate = new Date(saved.departureDate);
      if (saved.arrivalDate) saved.arrivalDate = new Date(saved.arrivalDate);
      setDraft(saved);
    }
    setShowResumeBanner(false);
  };

  const startFresh = () => {
    clearDraftStorage();
    setShowResumeBanner(false);
  };

  useEffect(() => {
    if (isEditMode) return;
    autoSaveRef.current = setInterval(() => saveDraftToStorage(draft), 10000);
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [draft, isEditMode]);

  // ── Category toggle ──
  const toggleCategory = useCallback((value: ParcelCategory) => {
    setDraft((prev) => {
      const has = prev.acceptedCategories.includes(value);
      if (has) {
        const nextCats = prev.acceptedCategories.filter((c) => c !== value);
        const nextConds = { ...prev.categoryConditions };
        delete nextConds[value];
        return { ...prev, acceptedCategories: nextCats, categoryConditions: nextConds };
      }
      return {
        ...prev,
        acceptedCategories: [...prev.acceptedCategories, value],
        categoryConditions: {
          ...prev.categoryConditions,
          [value]: prev.categoryConditions[value] ?? createDefaultCategoryCondition(value),
        },
      };
    });
  }, []);

  // ── Navigation ──
  const goTo = (target: Step) => {
    setDirection(target > step ? "forward" : "backward");
    setStep(target);
  };

  const nextStep = () => {
    if (!canContinueStep(step, draft, isFr)) {
      setShowErrors(true);
      setShakeFields(true);
      setTimeout(() => setShakeFields(false), 600);
      setTimeout(() => {
        const firstError = contentRef.current?.querySelector("[style*='color: rgb(255, 153, 0)']");
        firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      return;
    }
    setShowErrors(false);
    setDirection("forward");
    setStep((prev) => (prev < 3 ? ((prev + 1) as Step) : prev));
  };

  const prevStep = () => {
    setDirection("backward");
    setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));
  };

  // ── Save draft (localStorage) ──
  const handleSaveDraft = () => {
    saveDraftToStorage(draft);
    toast.success(isFr ? "Brouillon sauvegardé" : "Draft saved", { closeButton: true });
  };

  // ── Publish / Update trip (API) ──
  const handlePublish = async () => {
    // ── Gate: save as draft if onboarding OR Stripe not done ──
    const carrierPage = (user as any)?.carrierPage;
    const hasOnboarding =
      carrierPage?.onboardingStep === "STRIPE" ||
      carrierPage?.onboardingStep === "COMPLETE";
    const stripeReady =
      carrierPage?.stripeOnboardingComplete && carrierPage?.stripeChargesEnabled;

    // Cas 1 : pas d'onboarding → brouillon + toast onboarding
    // Cas 2 : onboarding OK mais Stripe manquant → brouillon + toast Stripe
    if (!hasOnboarding || !stripeReady) {
      const mutationFn =
        isEditMode && editTripId
          ? () => updateTrip.mutate(
            { tripId: editTripId, draft, publish: false },
            { onSuccess, onError }
          )
          : () => createTrip.mutate(
            { draft, publish: false },
            { onSuccess, onError }
          );

      const onSuccess = () => {
        clearDraftStorage();
        setFlashToast({
          type: "onboarding_required",
          message: !hasOnboarding
            ? (isFr
              ? "Votre trajet a été sauvegardé en brouillon. Configurez votre profil transporteur pour le publier."
              : "Your trip has been saved as a draft. Set up your carrier profile to publish it.")
            : (isFr
              ? "Votre trajet a été sauvegardé en brouillon. Configurez Stripe pour pouvoir le publier et recevoir des paiements."
              : "Your trip has been saved as a draft. Configure Stripe to publish it and receive payments."),
          persistent: true,
        });
        router.push("/dashboard/trips");
      };

      const onError = (err: any) => {
        const message =
          err?.response?.data?.message ||
          (isFr ? "Erreur lors de la sauvegarde" : "Failed to save draft");
        toast.error(message, { duration: Infinity, closeButton: true });
      };

      mutationFn();
      return;
    }
    // ── Fin du gate ──

    if (isEditMode && editTripId) {
      updateTrip.mutate(
        { tripId: editTripId, draft, publish: true },
        {
          onSuccess: () => {
            clearDraftStorage();
            setFlashToast({
              type: "success",
              message: isFr ? "Trajet mis à jour avec succès !" : "Trip updated successfully!",
            });
            router.push("/dashboard/trips");
          },
          onError: (err: any) => {
            const message =
              err?.response?.data?.message ||
              (isFr ? "Erreur lors de la mise à jour" : "Failed to update trip");
            toast.error(message, { duration: 8000, closeButton: true });
          },
        }
      );
    } else {
      createTrip.mutate(
        { draft, publish: true },
        {
          onSuccess: () => {
            clearDraftStorage();
            setFlashToast({
              type: "success",
              message: isFr ? "Trajet publié avec succès !" : "Trip published successfully!",
            });
            triggerConfetti();
            setTimeout(() => router.push("/dashboard/trips"), 1500);
          },
          onError: (err: any) => {
            const message =
              err?.response?.data?.message ||
              (isFr ? "Erreur lors de la publication" : "Failed to publish trip");
            toast.error(message, { duration: 8000, closeButton: true });
          },
        }
      );
    }
  };

  // ── Loading state for edit mode ──
  if (isLoadingEdit) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-[#FF9900]" />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mx-auto max-w-2xl">
        {/* Resume draft banner — only in create mode */}
        {!isEditMode && showResumeBanner && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div>
              <div className="text-[14px] font-medium text-slate-900 dark:text-white">
                {copy.resumeDraft}
              </div>
              <div className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                {copy.resumeDraftSub}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={startFresh}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] text-slate-600 dark:border-slate-700 dark:text-slate-400"
              >
                {copy.startFresh}
              </button>
              <button
                type="button"
                onClick={resumeDraft}
                className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-slate-900"
                style={{ backgroundColor: MANGO }}
              >
                {copy.continue}
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-2">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {isEditMode ? (isFr ? "Modifier le trajet" : "Edit trip") : copy.title}
          </h1>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            {isEditMode
              ? (isFr ? "Modifiez les informations de votre trajet" : "Update your trip information")
              : copy.subtitle}
          </p>
        </div>

        {/* Stepper */}
        <TripStepper step={step} labels={copy.steps} onGoTo={goTo} />

        {/* Error summary */}
        {showErrors && <ErrorSummary errors={errors} isFr={isFr} />}

        {/* Live summary */}
        <TripLiveSummary draft={draft} />

        {/* Step content */}
        <div
          ref={contentRef}
          className={shakeFields ? "animate-[shake_0.4s_ease]" : ""}
          key={step}
          style={{
            animation: `${direction === "forward" ? "slideInRight" : "slideInLeft"} 0.25s ease`,
          }}
        >
          {step === 1 && (
            <StepTrip copy={copy} isFr={isFr} draft={draft} setDraft={setDraft} errors={errors} />
          )}
          {step === 2 && (
            <StepConditions
              copy={copy}
              isFr={isFr}
              draft={draft}
              setDraft={setDraft}
              toggleCategory={toggleCategory}
              errors={errors}
            />
          )}
          {step === 3 && <StepReview copy={copy} isFr={isFr} draft={draft} onGoTo={goTo} />}
        </div>

        {/* Bottom bar */}
        <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="flex gap-2.5">
            {step > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="rounded-lg border border-slate-200 px-5 py-2.5 text-[13px] text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                {copy.back}
              </button>
            )}
            {!isEditMode && (
              <button
                type="button"
                onClick={handleSaveDraft}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-[13px] text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                {copy.saveDraft}
              </button>
            )}
          </div>
          {step < 3 ? (
            <button
              type="button"
              onClick={nextStep}
              className="rounded-lg px-6 py-2.5 text-[13px] font-medium text-slate-900 transition-colors"
              style={{ backgroundColor: MANGO }}
            >
              {copy.continue}
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePublish}
              disabled={isPublishing}
              className="rounded-lg px-6 py-2.5 text-[13px] font-medium text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: TEAL }}
            >
              {isPublishing
                ? (isFr ? (isEditMode ? "Mise à jour..." : "Publication...") : (isEditMode ? "Updating..." : "Publishing..."))
                : (isEditMode ? (isFr ? "Mettre à jour" : "Update") : copy.publish)}
            </button>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(2px); }
        }
      `}</style>
    </main>
  );
}

function triggerConfetti() {
  const colors = ["#FF9900", "#0F766E", "#FFB84D", "#5DCAA5", "#FF9900"];
  if (!document.getElementById("confetti-style")) {
    const style = document.createElement("style");
    style.id = "confetti-style";
    style.textContent = `@keyframes confetti-fall { 0% { transform: translateY(-10px) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }`;
    document.head.appendChild(style);
  }
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement("div");
    Object.assign(piece.style, {
      position: "fixed",
      top: "0",
      left: `${Math.random() * 100}vw`,
      width: "8px",
      height: "8px",
      borderRadius: "2px",
      backgroundColor: colors[Math.floor(Math.random() * colors.length)],
      animation: `confetti-fall ${1 + Math.random()}s ease-out forwards`,
      animationDelay: `${Math.random() * 0.5}s`,
      zIndex: "9999",
      pointerEvents: "none",
    });
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 2500);
  }
}
