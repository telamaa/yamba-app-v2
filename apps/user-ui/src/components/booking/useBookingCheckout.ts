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
import {
  clearPendingPayment,
  matchesPendingPayment,
  readPendingPayment,
  readRedirectReturn,
  savePendingPayment,
  stripRedirectParams,
} from "./pending-payment";
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
  /**
   * D82 7A — on revient d'une redirection (Klarna, PayPal) : l'empreinte est posée, la
   * réservation reste à créer. Tant que ce drapeau est levé, l'étape 4 ne crée SURTOUT pas
   * une nouvelle autorisation — ce serait une seconde empreinte sur le moyen de paiement
   * du membre.
   */
  const [isResuming, setIsResuming] = useState(false);
  const resumeStarted = useRef(false);
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

  /**
   * `POST /deals`, avec l'attente que les moyens à redirection imposent (D82 7A/8A) : le
   * serveur relit l'état réel de l'empreinte chez le fournisseur et répond
   * `PAYMENT_PROCESSING` tant qu'elle se pose. On attend et on redemande, au plus trois
   * fois — jamais une seconde empreinte, jamais une saisie à refaire.
   */
  const createDealWaitingForHold = useCallback(
    async (paymentIntentId: string, photoUrls: string[]) => {
      for (let tentative = 1; tentative <= PROCESSING_MAX_ATTEMPTS; tentative += 1) {
        try {
          return await createDeal(draft, trip, paymentIntentId, photoUrls);
        } catch (e) {
          const encoreEnCours = e instanceof BookingApiError && e.code === "PAYMENT_PROCESSING";
          if (!encoreEnCours || tentative === PROCESSING_MAX_ATTEMPTS) throw e;
          const secondes = Number(e.details?.retryAfterSeconds);
          await attendre(Number.isFinite(secondes) && secondes > 0 ? secondes * 1000 : PROCESSING_FALLBACK_DELAY_MS);
        }
      }
      return null;
    },
    [draft, trip]
  );

  /** Ce que font les deux chemins une fois la demande créée : tracer, dire, nettoyer, partir. */
  const finishWithBooking = useCallback(
    (bookingId: string) => {
      void track("booking_created", { tripId: trip.tripId, bookingId }); // D66 3A
      toast.success(t("step4.requestSent"), { duration: 3500 });
      clearPendingPayment(trip.tripId);
      clear();
      router.push(`/bookings/${bookingId}`);
    },
    [trip.tripId, t, clear, router]
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
  // D82 7A — SAUF si on revient d'une redirection : l'empreinte existe déjà, en créer une
  // autre doublerait l'argent retenu sur le moyen de paiement du membre.
  useEffect(() => {
    if (step !== 4) return;
    if (isResuming || resumeStarted.current) return;
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
        // D82 7A — DERNIER instant où cette page existe à coup sûr : un moyen à redirection
        // (Klarna, PayPal) part maintenant vers la banque. On consigne ce qu'il faudra
        // retrouver au retour — l'autorisation déjà posée et les photos déjà téléversées.
        savePendingPayment({
          tripId: trip.tripId,
          paymentIntentId: intent.paymentIntentId,
          photoUrls,
          totalCents: intent.amountCents,
        });
        const r = await confirm();
        if (!r.ok) {
          // La page est toujours là : il n'y a donc pas eu de redirection, et le dossier
          // d'attente n'a plus d'objet.
          clearPendingPayment(trip.tripId);
          toast.error(r.message || t("step4.confirmFailed"));
          return;
        }
      }
      const result = await createDealWaitingForHold(intent.paymentIntentId, photoUrls);
      if (!result) return;
      finishWithBooking(result.bookingId);
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
  }, [
    isSubmitting,
    intent,
    draft,
    trip,
    t,
    errorMessage,
    refreshIntent,
    uploadDetailed,
    queryClient,
    createDealWaitingForHold,
    finishWithBooking,
  ]);

  /**
   * D82 7A — LA REPRISE. Au retour de Klarna ou de PayPal, Stripe nous ramène sur cette
   * page avec `payment_intent` et `redirect_status` dans l'URL. L'empreinte est posée (ou
   * en train de l'être) : il ne reste qu'à créer la demande, avec l'autorisation et les
   * photos consignées AVANT le départ.
   *
   * Trois refus volontaires :
   *   • pas de dossier d'attente, ou un dossier qui parle d'une autre autorisation → on ne
   *     touche à rien (onglet recyclé, URL collée à la main) ;
   *   • `redirect_status=failed` → la banque a refusé : il faut repayer, pas créer une
   *     réservation. Le brouillon reste intact, l'erreur est dite ;
   *   • une seule tentative par montage (`resumeStarted`) : une reprise ne se rejoue pas
   *     parce que React a remonté l'effet.
   */
  useEffect(() => {
    if (typeof window === "undefined" || resumeStarted.current) return;
    const ret = readRedirectReturn(window.location.search);
    if (!ret) return;
    resumeStarted.current = true;
    const pending = readPendingPayment(trip.tripId);
    stripRedirectParams();
    if (!matchesPendingPayment(ret, pending) || !pending) {
      if (ret.status === "failed") {
        clearPendingPayment(trip.tripId);
        toast.error(t("step4.confirmFailed"));
      }
      // Aucune reprise à faire : l'étape 4 doit retrouver son droit de créer une
      // autorisation, sinon un retour inexploitable condamnerait la page.
      resumeStarted.current = false;
      return;
    }
    setIsResuming(true);
    void (async () => {
      try {
        const result = await createDealWaitingForHold(pending.paymentIntentId, pending.photoUrls);
        if (result) finishWithBooking(result.bookingId);
      } catch (e) {
        // Rien n'est perdu : le brouillon et l'étape sont en sessionStorage, et l'empreinte
        // non consommée sera libérée (D82 9A). On dit ce qui s'est passé, sans rien effacer.
        toast.error(errorMessage(e));
        clearPendingPayment(trip.tripId);
        // ET on rouvre la porte : sans cela, le garde de reprise resterait levé et l'étape 4
        // ne pourrait PLUS JAMAIS recréer d'autorisation — le membre serait coincé devant un
        // bouton inerte, ce qui est pire que l'échec qu'on vient de lui annoncer.
        resumeStarted.current = false;
      } finally {
        setIsResuming(false);
      }
    })();
    // Une seule fois par montage : la garde est `resumeStarted`, pas la liste de dépendances.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { intent, intentLoading, intentError, refreshIntent, registerConfirm, submit, isSubmitting, isResuming };
}
