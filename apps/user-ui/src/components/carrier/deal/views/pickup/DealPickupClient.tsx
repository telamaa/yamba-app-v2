/**
 * DealPickupClient.tsx
 * ====================
 * Orchestrateur de l'écran pickup. Charge le Deal, tient le state du
 * formulaire (checklist, photos, notes) et rend Desktop ou Mobile.
 *
 * canConfirm = 5 checks cochés + au moins 1 photo.
 * Confirmer → confirmPickup (mock) → toast + retour sur /carrier/deals/[dealId].
 * Refuser  → refusePickup (mock) → toast + retour à la home.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useRouter } from "@/i18n/navigation";
import { confirmPickup, getDealRequest, refusePickup } from "../../deal.api";
import type {
  DealRequest,
  PickupChecklistItemId,
  PickupPhotoDraft,
  PickupRefuseReason,
} from "../../deal.types";
import DealSkeleton from "../../DealSkeleton";
import { PICKUP_CHECKLIST_ITEMS } from "./PickupChecklist";
import DealPickupDesktop from "./DealPickupDesktop";
import DealPickupMobile from "./DealPickupMobile";

type Props = {
  dealId: string;
};

export default function DealPickupClient({ dealId }: Props) {
  const t = useTranslations("carrierDealPickup");
  const isMobile = useIsMobile();
  const router = useRouter();

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
    setPhotos((prev) => [...prev, photo]);
  }, []);

  const removePhoto = useCallback((photoId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  }, []);

  const canConfirm =
    PICKUP_CHECKLIST_ITEMS.every((id) => checked.has(id)) && photos.length >= 1;

  const handleConfirm = async () => {
    if (!deal || !canConfirm || isSubmittingConfirm) return;
    setIsSubmittingConfirm(true);
    try {
      await confirmPickup(deal.id, {
        checklist: Array.from(checked),
        photos,
        notes: notes.trim() || undefined,
      });
      toast.success(
        t("confirm.toastSuccess", { shipperFirstName: deal.shipper.firstName }),
        { duration: 4500 }
      );
      // Retour sur la page Deal. NB mock stateless : la vue PICKED_UP
      // persistante arrive avec le chantier Expéditeur (code révélé).
      router.push(`/carrier/deals/${deal.id}`);
    } catch {
      toast.error(t("confirm.toastError"));
    } finally {
      setIsSubmittingConfirm(false);
    }
  };

  const handleRefuse = async (payload: {
    reason?: PickupRefuseReason;
    details?: string;
  }) => {
    if (!deal || isSubmittingRefuse) return;
    setIsSubmittingRefuse(true);
    try {
      await refusePickup(deal.id, payload);
      toast.success(
        t("refuse.toastSuccess", { shipperFirstName: deal.shipper.firstName }),
        { duration: 4500 }
      );
      setRefuseOpen(false);
      router.push("/");
    } catch {
      toast.error(t("refuse.toastError"));
    } finally {
      setIsSubmittingRefuse(false);
    }
  };

  if (isMobile === null || (!deal && !loadError)) return <DealSkeleton />;
  if (loadError || !deal) return <DealSkeleton />;

  const shared = {
    deal,
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
    details?: string;
  }) => void;
};
