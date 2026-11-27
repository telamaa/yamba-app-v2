/**
 * DealPickupClient.tsx
 * ====================
 * Orchestrateur de l'écran pickup. Charge le Deal, tient le state du
 * formulaire (checklist, photos, notes) et rend Desktop ou Mobile.
 *
 * canConfirm = 5 checks cochés + au moins 1 photo (le serveur revalide).
 * Confirmer → upload des photos vers ImageKit UNE PAR UNE (D42/A43 :
 *   premier échec = arrêt, rien n'est envoyé) → POST /deals/:id/pickup →
 *   invalidation du cache deal → retour sur /carrier/deals/[dealId]
 *   (la page bascule d'elle-même sur la vue PICKED_UP).
 * Refuser  → POST /deals/:id/pickup/refuse (raison seule — A40) → toast
 *   + retour à l'accueil.
 * 409 TRANSITION_NOT_ALLOWED (deal déjà passé ailleurs) → toast + relecture.
 *
 * D115 bis — TROIS CORRECTIONS VENUES DE L'ÉCRAN NATIF :
 *   ① « ce qui manque pour confirmer » vient de `lib/carrier/prise-en-charge`
 *      et descend aux DEUX arbres. Le ternaire était recopié dans
 *      `DealPickupDesktop` et `DealPickupMobile`, et il ignorait la remarque
 *      trop longue — donc un bouton actif pour un envoi voué à l'échec ;
 *   ② la checklist part dans l'ordre du CONTRAT, plus dans celui des clics ;
 *   ③ une lecture qui ÉCHOUE n'affiche plus un squelette PERPÉTUEL : l'écran
 *      disait « je charge » pour toujours, sans sortie (famille D100 — un
 *      écran ne prétend pas faire ce qu'il ne fait pas).
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/hooks/useIsMobile";
import { PHOTO_MAX_SIZE_BYTES, PHOTO_MIME_TYPES, useImageKitUpload } from "@/hooks/useImageKitUpload";
import { useRouter } from "@/i18n/navigation";
import { dealQueryKey } from "../../DealClient";
import { MY_DEALS_QUERY_KEY } from "@/hooks/useMyDeals";
import { DealApiError, confirmPickup, getDealRequest, refusePickup } from "../../deal.api";
import type {
  DealRequest,
  PickupChecklistItemId,
  PickupPhotoDraft,
  PickupRefuseReason,
} from "../../deal.types";
import DealSkeleton from "../../DealSkeleton";
import {
  checklistAEnvoyer,
  manquesPriseEnCharge,
  notesAEnvoyer,
  peutConfirmerLaPriseEnCharge,
} from "@/lib/carrier/prise-en-charge";
import DealPickupDesktop from "./DealPickupDesktop";
import DealPickupMobile from "./DealPickupMobile";

type Props = {
  dealId: string;
};

export default function DealPickupClient({ dealId }: Props) {
  const t = useTranslations("carrierDealPickup");
  const isMobile = useIsMobile();
  const router = useRouter();
  const queryClient = useQueryClient();
  // D42 : upload direct signé vers ImageKit, dossier dédié aux preuves de pickup.
  const { uploadDetailed } = useImageKitUpload("/deals/pickup", {
    maxSizeBytes: PHOTO_MAX_SIZE_BYTES,
    allowedMimeTypes: PHOTO_MIME_TYPES,
  });

  const [deal, setDeal] = useState<DealRequest | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Form state
  const [checked, setChecked] = useState<Set<PickupChecklistItemId>>(new Set());
  const [photos, setPhotos] = useState<PickupPhotoDraft[]>([]);
  const [notes, setNotes] = useState("");
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [isSubmittingConfirm, setIsSubmittingConfirm] = useState(false);
  const [isSubmittingRefuse, setIsSubmittingRefuse] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDealRequest(dealId)
      .then((d) => {
        if (!cancelled) setDeal(d);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  const handleBack = useCallback(() => {
    router.push(`/carrier/deals/${dealId}`);
  }, [router, dealId]);

  const toggleCheck = useCallback((id: PickupChecklistItemId) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addPhoto = useCallback((photo: PickupPhotoDraft) => {
    // ANO-WEB-52 (recette 5.16, même famille qu'ANO-WEB-39) : la borne de taille et le format se jouent à la
    // SÉLECTION — les photos ne partent qu'à la confirmation, une photo trop lourde entrait donc dans la grille
    // et n'était refusée que trois cases plus loin. Rien n'est envoyé : on prévient tout de suite.
    if (photo.file && photo.file.size > PHOTO_MAX_SIZE_BYTES) {
      toast.error(t("errors.uploadTooLarge", { maxMb: Math.round(PHOTO_MAX_SIZE_BYTES / (1024 * 1024)) }), { duration: 6000 });
      return;
    }
    if (photo.file && !PHOTO_MIME_TYPES.includes(photo.file.type.toLowerCase())) {
      toast.error(t("errors.uploadInvalidType"), { duration: 6000 });
      return;
    }
    setPhotos((prev) => [...prev, photo]);
  }, [t]);

  const removePhoto = useCallback((photoId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  }, []);

  // UNE SEULE règle, partagée par les deux arbres (D115 bis ①).
  const etatDuFormulaire = { coches: checked, photos: photos.length, notes };
  const canConfirm = peutConfirmerLaPriseEnCharge(etatDuFormulaire);
  const manques = manquesPriseEnCharge(etatDuFormulaire);
  const blockingHint =
    manques.length === 0
      ? null
      : manques[0].quoi === "points"
        ? t("validation.checklistIncomplete")
        : manques[0].quoi === "photo"
          ? t("validation.photoMissing")
          : t("validation.notesTooLong", { count: manques[0].deTrop });

  /** Après une transition la vérité est en base : on invalide, on ne mute pas. */
  const refreshDeal = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: dealQueryKey(dealId) });
    void queryClient.invalidateQueries({ queryKey: MY_DEALS_QUERY_KEY });
  }, [queryClient, dealId]);

  const handleTransitionError = (e: unknown, fallback: string) => {
    if (e instanceof DealApiError && e.code === "TRANSITION_NOT_ALLOWED") {
      // Le deal a changé entre-temps (annulé, déjà pris en charge…) : on relit.
      toast.error(t("errors.dealChanged"));
      refreshDeal();
      router.push(`/carrier/deals/${dealId}`);
      return;
    }
    toast.error(fallback);
  };

  const handleConfirm = async () => {
    if (!deal || !canConfirm || isSubmittingConfirm) return;
    setIsSubmittingConfirm(true);
    try {
      // 1. Les photos partent d'abord vers ImageKit (D42) — une par une,
      //    le premier échec arrête tout : le deal-service ne reçoit que des URLs.
      const photoUrls: string[] = [];
      for (const photo of photos) {
        if (!photo.file) continue;
        const result = await uploadDetailed(photo.file);
        if (!result.ok) {
          toast.error(
            result.error.code === "TOO_LARGE"
              ? t("errors.uploadTooLarge", { maxMb: Math.round(PHOTO_MAX_SIZE_BYTES / (1024 * 1024)) })
              : result.error.code === "INVALID_TYPE"
                ? t("errors.uploadInvalidType")
                : t("errors.uploadFailed"),
            { duration: 6000 }
          );
          return;
        }
        photoUrls.push(result.file.url);
      }
      if (photoUrls.length === 0) {
        toast.error(t("errors.uploadFailed"));
        return;
      }

      // 2. La transition : le serveur revalide 5/5 + 1..5 photos et génère le code.
      await confirmPickup(deal.id, {
        // L'ordre du CONTRAT, pas celui des clics (D115 bis ②).
        checklist: checklistAEnvoyer(),
        photoUrls,
        notes: notesAEnvoyer(notes),
      });
      toast.success(
        t("confirm.toastSuccess", { shipperFirstName: deal.shipper.firstName }),
        { duration: 4500 }
      );
      refreshDeal();
      router.push(`/carrier/deals/${deal.id}`);
    } catch (e) {
      handleTransitionError(e, t("confirm.toastError"));
    } finally {
      setIsSubmittingConfirm(false);
    }
  };

  const handleRefuse = async (payload: { reason?: PickupRefuseReason }) => {
    if (!deal || isSubmittingRefuse) return;
    setIsSubmittingRefuse(true);
    try {
      await refusePickup(deal.id, payload);
      toast.success(
        t("refuse.toastSuccess", { shipperFirstName: deal.shipper.firstName }),
        { duration: 4500 }
      );
      setRefuseOpen(false);
      refreshDeal();
      router.push("/");
    } catch (e) {
      handleTransitionError(e, t("refuse.toastError"));
    } finally {
      setIsSubmittingRefuse(false);
    }
  };

  if (isMobile === null || (!deal && !loadError)) return <DealSkeleton />;
  // D115 bis ③ — une lecture qui échoue n'est pas un chargement : le
  // squelette tournait indéfiniment, sans un mot ni une sortie.
  if (loadError || !deal)
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-[15px] font-semibold text-slate-900 dark:text-white">
          {t("errors.loadTitle")}
        </p>
        <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
          {t("errors.loadBody")}
        </p>
        <button
          type="button"
          onClick={handleBack}
          className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-[14px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          {t("errors.loadBack")}
        </button>
      </div>
    );

  const shared = {
    deal,
    blockingHint,
    checked,
    photos,
    notes,
    canConfirm,
    isSubmitting: isSubmittingConfirm || isSubmittingRefuse,
    isSubmittingRefuse,
    refuseOpen,
    onBackAction: handleBack,
    onToggleCheckAction: toggleCheck,
    onAddPhotoAction: addPhoto,
    onRemovePhotoAction: removePhoto,
    onNotesChangeAction: setNotes,
    onOpenRefuseAction: () => setRefuseOpen(true),
    onCloseRefuseAction: () => !isSubmittingRefuse && setRefuseOpen(false),
    onConfirmAction: handleConfirm,
    onRefuseConfirmAction: handleRefuse,
  };

  return isMobile ? (
    <DealPickupMobile {...shared} />
  ) : (
    <DealPickupDesktop {...shared} />
  );
}

export type DealPickupViewProps = {
  deal: DealRequest;
  /** Ce qui manque pour confirmer, déjà traduit — UNE source pour les deux arbres. */
  blockingHint: string | null;
  checked: Set<PickupChecklistItemId>;
  photos: PickupPhotoDraft[];
  notes: string;
  canConfirm: boolean;
  isSubmitting: boolean;
  isSubmittingRefuse: boolean;
  refuseOpen: boolean;
  onBackAction: () => void;
  onToggleCheckAction: (id: PickupChecklistItemId) => void;
  onAddPhotoAction: (photo: PickupPhotoDraft) => void;
  onRemovePhotoAction: (photoId: string) => void;
  onNotesChangeAction: (value: string) => void;
  onOpenRefuseAction: () => void;
  onCloseRefuseAction: () => void;
  onConfirmAction: () => void;
  onRefuseConfirmAction: (payload: {
    reason?: import("../../deal.types").PickupRefuseReason;
  }) => void;
};
