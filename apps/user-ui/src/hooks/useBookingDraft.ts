/**
 * useBookingDraft.ts
 * ==================
 * Shared persisted state for the booking wizard.
 * Both BookingWizard.tsx (desktop) and BookingMobile.tsx (mobile)
 * call this hook — the state lives in sessionStorage so it survives
 * a viewport switch.
 *
 * Note: `photos` is excluded from persistence because File objects
 * are not JSON-serializable.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { usePersistedFormState } from "@/hooks/usePersistedFormState";
import { DRAFT_VERSION, initialDraft } from "@/components/booking/booking.state";
import type { Draft, Step } from "@/components/booking/booking.types";

const DRAFT_KEY = "booking-wizard";
const STEP_KEY = "booking-wizard-step";

export function useBookingDraft() {
  const [draft, setDraft, clearDraftRaw] = usePersistedFormState<Draft>(
    DRAFT_KEY,
    initialDraft,
    {
      exclude: ["photos"] as (keyof Draft)[],
      version: DRAFT_VERSION,
    }
  );

  const [step, setStep, clearStep] = usePersistedStep(STEP_KEY, 1);

  const clear = useCallback(() => {
    clearDraftRaw();
    clearStep();
  }, [clearDraftRaw, clearStep]);

  return {
    draft,
    setDraft,
    step,
    setStep,
    clear,
  };
}

/**
 * Simple sessionStorage-backed state for the current step.
 * usePersistedFormState requires `T extends object`, but step is just a
 * number, so we roll our own minimal version here.
 */
function usePersistedStep(
  key: string,
  initial: Step
): [Step, (value: Step | ((prev: Step) => Step)) => void, () => void] {
  const [step, setStepRaw] = useState<Step>(initial);

  // Hydrate from sessionStorage on mount (client only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          typeof parsed === "number" &&
          parsed >= 1 &&
          parsed <= 4
        ) {
          setStepRaw(parsed as Step);
        }
      }
    } catch {
      // ignore parse errors, fall back to initial
    }
  }, [key]);

  const setStep = useCallback(
    (value: Step | ((prev: Step) => Step)) => {
      setStepRaw((prev) => {
        const next =
          typeof value === "function"
            ? (value as (prev: Step) => Step)(prev)
            : value;
        if (typeof window !== "undefined") {
          try {
            window.sessionStorage.setItem(key, JSON.stringify(next));
          } catch {
            // ignore quota errors
          }
        }
        return next;
      });
    },
    [key]
  );

  const clear = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(key);
      } catch {
        // ignore
      }
    }
    setStepRaw(initial);
  }, [key, initial]);

  return [step, setStep, clear];
}
