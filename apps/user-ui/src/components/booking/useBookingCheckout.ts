/**
 * useBookingCheckout.ts — la fin du wizard, partagée desktop/mobile (B2)
 * ======================================================================
 * Séquence (D37) : arrivée à l'étape 4 → autorisation (payment intent)
 * → l'Expéditeur confirme dans le Payment Element (Stripe) ou rien à
 * faire (fournisseur FAKE en dev) → POST /deals → redirection tracker.
 *
 * L'intent vit dans l'état du composant (pas dans le brouillon local) :
 * un rechargement en recrée un ; l'ancien expire seul, jamais capturé.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { PHOTO_MAX_SIZE_BYTES, PHOTO_MIME_TYPES, useImageKitUpload } from "@/hooks/useImageKitUpload";
import { BookingApiError, createDeal, createPaymentIntent } from "@/services/booking.api";
import type { Draft, PaymentIntentInfo, Step, TripContext } from "./booking.types";

/** Ce que l'étape 4 enregistre : « confirme le paiement, dis-moi si c'est bon ». */
export type ConfirmPaymentFn = () => Promise<{ ok: true } | { ok: false; message: string }>;

const KNOWN_CODES = new Set([
  "QUOTE_DIVERGENCE",
  "CAPACITY_EXCEEDED",
  "FAMILY_REFUSED",
  "TRIP_NOT_BOOKABLE",
  "OWN_TRIP",
  "PAYMENT_NOT_AUTHORIZED",
  "PAYMENT_MISMATCH",
  "PAYMENT_ALREADY_USED",
  "UNAUTHENTICATED",
  "QUOTE_UNAVAILABLE",
]);

export function useBookingCheckout(args: { draft: Draft; trip: TripContext; step: Step; clear: () => void }) {
  const { draft, trip, step, clear } = args;
  // A45 — photos déclarées : upload direct ImageKit (D42), dossier dédié
  const { uploadDetailed } = useImageKitUpload("/bookings/declared", {
    maxSizeBytes: PHOTO_MAX_SIZE_BYTES,
    allowedMimeTypes: PHOTO_MIME_TYPES,
  });
  const t = useTranslations("booking");
  const router = useRouter();

  const [intent, setIntent] = useState<PaymentIntentInfo | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const [intentError, setIntentError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const confirmRef = useRef<ConfirmPaymentFn | null>(null);
  // Le total autorisé : si l'Expéditeur revient modifier le colis, l'intent ne vaut plus.
  const authorizedTotalRef = useRef<number | null>(null);

  const errorMessage = useCallback(
    (e: unknown) => {
      const code = e instanceof BookingApiError && KNOWN_CODES.has(e.code) ? e.code : "GENERIC";
      return t(`step4.errors.${code}`);
    },
    [t]
  );

  const refreshIntent = useCallback(async () => {
    setIntentLoading(true);
    setIntentError(null);
    try {
      const created = await createPaymentIntent(draft, trip);
      authorizedTotalRef.current = created.amountCents;
      setIntent(created);
    } catch (e) {
      setIntent(null);
      setIntentError(errorMessage(e));
    } finally {
      setIntentLoading(false);
    }
  }, [draft, trip, errorMessage]);

  // Étape 4 : (re)créer l'autorisation si absente ou si le total a changé.
  useEffect(() => {
    if (step !== 4) return;
    if (intent && !intentLoading) return;
    if (!intent && !intentLoading && !intentError) void refreshIntent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const registerConfirm = useCallback((fn: ConfirmPaymentFn | null) => {
    confirmRef.current = fn;
  }, []);

  const submit = useCallback(async () => {
    if (isSubmitting || !intent) return;
    setIsSubmitting(true);
    try {
      // 1. Les photos déclarées partent D'ABORD (A45) : un échec ici
      //    arrête tout AVANT la carte — jamais d'empreinte orpheline (A34).
      const photoUrls: string[] = [];
      for (const photo of draft.photos) {
        if (!photo.file) continue;
        const result = await uploadDetailed(photo.file);
        if (!result.ok) {
          toast.error(
            result.error.code === "TOO_LARGE"
              ? t("step4.errors.UPLOAD_TOO_LARGE", { maxMb: Math.round(PHOTO_MAX_SIZE_BYTES / (1024 * 1024)) })
              : result.error.code === "INVALID_TYPE"
                ? t("step4.errors.UPLOAD_INVALID_TYPE")
                : t("step4.errors.UPLOAD_FAILED"),
            { duration: 6000 }
          );
          return;
        }
        photoUrls.push(result.file.url);
      }

      if (intent.provider === "STRIPE") {
        const confirm = confirmRef.current;
        if (!confirm) {
          toast.error(t("step4.errors.GENERIC"));
          return;
        }
        const r = await confirm();
        if (!r.ok) {
          toast.error(r.message || t("step4.confirmFailed"));
          return;
        }
      }
      const result = await createDeal(draft, trip, intent.paymentIntentId, photoUrls);
      toast.success(t("step4.requestSent"), { duration: 3500 });
      clear();
      router.push(`/bookings/${result.bookingId}`);
    } catch (e) {
      toast.error(errorMessage(e));
      if (e instanceof BookingApiError && (e.code === "QUOTE_DIVERGENCE" || e.code === "PAYMENT_MISMATCH")) {
        // Le prix a bougé : nouvelle autorisation sur le nouveau total, rien n'est débité.
        setIntent(null);
        void refreshIntent();
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, intent, draft, trip, clear, router, t, errorMessage, refreshIntent, uploadDetailed]);

  return { intent, intentLoading, intentError, refreshIntent, registerConfirm, submit, isSubmitting };
}
