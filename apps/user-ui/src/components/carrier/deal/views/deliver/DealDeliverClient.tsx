/**
 * DealDeliverClient.tsx
 * =====================
 * Orchestrateur de l'écran de saisie du code. Le SERVEUR compte (A38) :
 * `attemptsUsed` et `lockedUntil` s'initialisent depuis la vue Carrier
 * (deliveryAttemptsLeft / deliveryLockedUntil) et se mettent à jour depuis
 * les `details` des 409 (DELIVERY_CODE_INVALID.attemptsLeft,
 * DELIVERY_LOCKED.lockedUntil). Le countdown local n'est qu'un affichage :
 * à l'expiration, le serveur a déjà remis le compteur à zéro.
 * Succès → DeliverSuccess (célébration) puis retour au Deal (DELIVERED).
 *
 * D116 bis — TROIS CORRECTIONS VENUES DE L'ÉCRAN NATIF :
 *   ① une lecture qui ÉCHOUE affichait un squelette PERPÉTUEL — et sans
 *      `.catch`, le rejet n'était même pas attrapé ;
 *   ② `isSubmitting || !photosReady` mettait le bouton en « Vérification… »
 *      POUR TOUJOURS quand une photo de remise échouait. Une disjonction
 *      dans une prop d'état fait perdre au bouton la raison de son
 *      attente, donc sa capacité à la DIRE (leçon D115 2A) ;
 *   ③ « Vérifie avec {prénom} » laissait un trou quand le prénom n'était
 *      pas servi (famille D100).
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { PHOTO_MAX_SIZE_BYTES, PHOTO_MIME_TYPES, useImageKitUpload } from "@/hooks/useImageKitUpload";
import { NOTIFICATIONS_QUERY_KEY } from "@/hooks/useNotifications";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useRouter } from "@/i18n/navigation";
import { dealQueryKey } from "../../DealClient";
import { MY_DEALS_QUERY_KEY } from "@/hooks/useMyDeals";
import {
  DealApiError,
  getDealRequest,
  MAX_DELIVERY_ATTEMPTS,
  validateDeliveryCode,
} from "../../deal.api";
import { manqueDesPhotos, urlsDeLaRemise } from "@/lib/carrier/remise";
import type { DealRequest } from "../../deal.types";
import DealSkeleton from "../../DealSkeleton";
import DealDeliverDesktop from "./DealDeliverDesktop";
import DealDeliverMobile from "./DealDeliverMobile";
import DeliverSuccess from "./DeliverSuccess";
import type { DeliveryPhotoDraft } from "@/components/carrier/deal/deal.types";

type Props = {
  dealId: string;
};

export default function DealDeliverClient({ dealId }: Props) {
  const t = useTranslations("carrierDealDeliver");
  const isMobile = useIsMobile();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [deal, setDeal] = useState<DealRequest | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [lockCountdown, setLockCountdown] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliveredAt, setDeliveredAt] = useState<string | null>(null);
  // A76 — photos OPTIONNELLES de la remise : upload direct signé (D42), dossier dédié.
  const [photos, setPhotos] = useState<DeliveryPhotoDraft[]>([]);
  const { uploadDetailed } = useImageKitUpload("/deals/delivery", {
    maxSizeBytes: PHOTO_MAX_SIZE_BYTES,
    allowedMimeTypes: PHOTO_MIME_TYPES,
  });
  const handleAddPhoto = useCallback(
    (photo: DeliveryPhotoDraft) => {
      setPhotos((prev) => [...prev, { ...photo, uploading: true, error: undefined }]);
      if (!photo.file) return;
      void uploadDetailed(photo.file).then((result) => {
        setPhotos((prev) =>
          prev.map((p) =>
            p.id !== photo.id
              ? p
              : result.ok
                ? { ...p, uploading: false, url: result.file.url }
                : { ...p, uploading: false, error: result.error.message }
          )
        );
      });
    },
    [uploadDetailed]
  );
  const handleRemovePhoto = useCallback((photoId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  }, []);
  // D116 bis ② — ce qui RETIENT l'envoi, nommé et jamais fondu dans une
  // disjonction : le bouton doit pouvoir dire POURQUOI il attend.
  const manquePhoto = manqueDesPhotos(photos);
  const photosReady = manquePhoto === null;
  const photoHint =
    manquePhoto === null
      ? null
      : manquePhoto.quoi === "televersement"
        ? t("photos.uploading")
        : t("photos.uploadError");

  useEffect(() => {
    let cancelled = false;
    getDealRequest(dealId)
      .catch(() => {
        // D116 bis ① — sans ce `catch`, le rejet n'était pas attrapé et
        // l'écran restait un squelette, sans un mot ni une sortie.
        if (!cancelled) setLoadError(true);
        return null;
      })
      .then((d) => {
        if (cancelled || d === null) return;
        setDeal(d);
        // A38 — état SERVEUR de la saisie : essais consommés, verrou en cours.
        setAttemptsUsed(
          MAX_DELIVERY_ATTEMPTS - (d.deliveryAttemptsLeft ?? MAX_DELIVERY_ATTEMPTS)
        );
        const lock = d.deliveryLockedUntil ?? null;
        setLockedUntil(lock && new Date(lock).getTime() > Date.now() ? lock : null);
      });
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  // Countdown du verrouillage (tick 1s)
  useEffect(() => {
    if (!lockedUntil) return;
    const update = () => {
      const remainingMs = new Date(lockedUntil).getTime() - Date.now();
      if (remainingMs <= 0) {
        setLockedUntil(null);
        setAttemptsUsed(0);
        setErrorMessage(null);
        setLockCountdown("");
        return;
      }
      const totalSec = Math.ceil(remainingMs / 1000);
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      setLockCountdown(min + ":" + sec.toString().padStart(2, "0"));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const handleBack = useCallback(() => {
    router.push("/carrier/deals/" + dealId);
  }, [router, dealId]);

  const handleSubmit = useCallback(
    async (code: string) => {
      if (!deal || isSubmitting || lockedUntil || !photosReady) return;
      setIsSubmitting(true);
      setErrorMessage(null);
      try {
        const result = await validateDeliveryCode(deal.id, code, urlsDeLaRemise(photos));
        setDeliveredAt(result.deliveredAt);
        // La vérité est en base : la page Deal relira DELIVERED.
        void queryClient.invalidateQueries({ queryKey: dealQueryKey(deal.id) });
        void queryClient.invalidateQueries({ queryKey: MY_DEALS_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }); // A91
      } catch (e) {
        if (e instanceof DealApiError) {
          if (e.code === "DELIVERY_CODE_INVALID") {
            const left = typeof e.details.attemptsLeft === "number" ? e.details.attemptsLeft : 0;
            setAttemptsUsed(MAX_DELIVERY_ATTEMPTS - left);
            // D116 bis ③ — deux versions de la phrase : un prénom absent ne
            // laisse pas « Vérifie avec  et réessaye » (famille D100).
            const prenom = deal.recipient?.firstName ?? "";
            setErrorMessage(
              prenom.length > 0
                ? t("otp.wrongCode", { recipientFirstName: prenom })
                : t("otp.wrongCodeNoName")
            );
            return;
          }
          if (e.code === "DELIVERY_LOCKED") {
            setAttemptsUsed(MAX_DELIVERY_ATTEMPTS);
            setLockedUntil(typeof e.details.lockedUntil === "string" ? e.details.lockedUntil : null);
            setErrorMessage(null);
            return;
          }
          if (e.code === "DELIVERY_CODE_UNAVAILABLE") {
            toast.error(t("error.codeUnavailable"), { duration: 6000 });
            return;
          }
          if (e.code === "TRANSITION_NOT_ALLOWED") {
            // Verrou actif côté serveur ou deal déjà passé ailleurs : on relit.
            toast.error(t("error.dealChanged"));
            const fresh = await getDealRequest(deal.id).catch(() => null);
            if (fresh) {
              setDeal(fresh);
              setAttemptsUsed(MAX_DELIVERY_ATTEMPTS - (fresh.deliveryAttemptsLeft ?? MAX_DELIVERY_ATTEMPTS));
              setLockedUntil(fresh.deliveryLockedUntil ?? null);
            }
            return;
          }
        }
        toast.error(t("error.toastGeneric"));
      } finally {
        setIsSubmitting(false);
      }
    },
    [deal, isSubmitting, lockedUntil, queryClient, t, photos, photosReady]
  );

  if (loadError)
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-[15px] font-semibold text-slate-900 dark:text-white">
          {t("error.loadTitle")}
        </p>
        <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
          {t("error.loadBody")}
        </p>
        <button
          type="button"
          onClick={handleBack}
          className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-[14px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          {t("error.loadBack")}
        </button>
      </div>
    );
  if (isMobile === null || !deal) return <DealSkeleton />;

  // Écran de succès 🎉
  // Écran de succès 🎉
  if (deliveredAt) {
    return (
      <DeliverSuccess
        deal={deal}
        deliveredAt={deliveredAt}
        onBackToDealAction={handleBack}
        onBackToDashboardAction={() => router.push("/")}
      />
    );
  }

  const shared = {
    deal,
    attemptsUsed,
    maxAttempts: MAX_DELIVERY_ATTEMPTS,
    errorMessage,
    isLocked: lockedUntil !== null,
    lockCountdown,
    isSubmitting,
    photos,
    photosReady,
    photoHint,
    onAddPhotoAction: handleAddPhoto,
    onRemovePhotoAction: handleRemovePhoto,
    onBackAction: handleBack,
    onSubmitAction: handleSubmit,
  };

  return isMobile ? (
    <DealDeliverMobile {...shared} />
  ) : (
    <DealDeliverDesktop {...shared} />
  );
}

export type DealDeliverViewProps = {
  deal: DealRequest;
  attemptsUsed: number;
  maxAttempts: number;
  errorMessage: string | null;
  isLocked: boolean;
  lockCountdown: string;
  isSubmitting: boolean;
  /** A76 — photos de remise (optionnelles) et leur état d'upload. */
  photos: DeliveryPhotoDraft[];
  /** Ce que les PHOTOS retiennent, déjà traduit — ou `null` si rien. */
  photoHint: string | null;
  photosReady: boolean;
  onAddPhotoAction: (photo: DeliveryPhotoDraft) => void;
  onRemovePhotoAction: (photoId: string) => void;
  onBackAction: () => void;
  onSubmitAction: (code: string) => void;
};
