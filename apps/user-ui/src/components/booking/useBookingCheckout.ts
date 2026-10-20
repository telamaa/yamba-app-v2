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
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { PHOTO_MAX_SIZE_BYTES, PHOTO_MIME_TYPES, useImageKitUpload } from "@/hooks/useImageKitUpload";
import { BookingApiError, createDeal, createPaymentIntent } from "@/services/booking.api";
import { track } from "@/lib/analytics";
import type { Draft, PaymentIntentInfo, Step, TripContext } from "./booking.types";

/**
 * D82 7A — Klarna et PayPal REDIRIGENT : au retour, l'empreinte peut n'être pas encore
 * capturable, et le serveur répond `PAYMENT_PROCESSING` avec le délai à attendre. Ce n'est
 * pas un échec : on attend et on redemande, au plus trois fois. Au-delà, on le dit — mais
 * sans jamais ressaisir quoi que ce soit, et sans jamais poser une seconde empreinte.
 */
const PROCESSING_MAX_ATTEMPTS = 3;
const PROCESSING_FALLBACK_DELAY_MS = 3000;

const attendre = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Ce que l'étape 4 enregistre : « confirme le paiement, dis-moi si c'est bon ». */
export type ConfirmPaymentFn = () => Promise<{ ok: true } | { ok: false; message: string }>;

const KNOWN_CODES = new Set([
  "QUOTE_DIVERGENCE",
  "CAPACITY_EXCEEDED",
  "FAMILY_REFUSED",
  "TRIP_NOT_BOOKABLE",
  "OWN_TRIP",
  "PAYMENT_NOT_AUTHORIZED",
  "PAYMENT_PROCESSING", // D82 7A
  "PAYMENT_MISMATCH",
  "PAYMENT_ALREADY_USED",
  "NEW_ACCOUNT_CAP", // D71
  "UNAUTHENTICATED",
  "QUOTE_UNAVAILABLE",
]);

export function useBookingCheckout(args: { draft: Draft; trip: TripContext; step: Step; clear: () => void }) {
  const queryClient = useQueryClient();
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
      void track("booking_payment_started", { tripId: trip.tripId, amountCents: created.amountCents }); // D66 3A
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
      // Le serveur relit l'état réel de l'empreinte chez le fournisseur (D82 8A) : tant
      // qu'elle se pose, il dit « attends » au lieu de « c'est raté ».
      let result: Awaited<ReturnType<typeof createDeal>> | null = null;
      for (let tentative = 1; tentative <= PROCESSING_MAX_ATTEMPTS; tentative += 1) {
        try {
          result = await createDeal(draft, trip, intent.paymentIntentId, photoUrls);
          break;
        } catch (e) {
          const encoreEnCours = e instanceof BookingApiError && e.code === "PAYMENT_PROCESSING";
          if (!encoreEnCours || tentative === PROCESSING_MAX_ATTEMPTS) throw e;
          const secondes = Number((e as BookingApiError).details?.retryAfterSeconds);
          await attendre(Number.isFinite(secondes) && secondes > 0 ? secondes * 1000 : PROCESSING_FALLBACK_DELAY_MS);
        }
      }
      if (!result) return;
      void track("booking_created", { tripId: trip.tripId, bookingId: result.bookingId }); // D66 3A
      toast.success(t("step4.requestSent"), { duration: 3500 });
      clear();
      router.push(`/bookings/${result.bookingId}`);
    } catch (e) {
      toast.error(errorMessage(e));
      if (e instanceof BookingApiError && (e.code === "QUOTE_DIVERGENCE" || e.code === "PAYMENT_MISMATCH")) {
        // Le prix a bougé : nouvelle autorisation sur le nouveau total, rien n'est débité.
        // ANO-WEB-36 (recette 5.12) — et le TRAJET est relu : sans cela le récapitulatif et le bouton
        // « Payer » gardaient l'ancien total alors que le message annonçait le nouveau.
        void queryClient.invalidateQueries({ queryKey: ["public-trip", trip.tripId] });
        setIntent(null);
        void refreshIntent();
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, intent, draft, trip, clear, router, t, errorMessage, refreshIntent, uploadDetailed, queryClient]);

  return { intent, intentLoading, intentError, refreshIntent, registerConfirm, submit, isSubmitting };
}
