/**
 * BookingReportClient.tsx
 * =======================
 * Orchestrateur du formulaire de signalement. Tient tout le state du
 * formulaire + confirmation inline + envoi + succès (ticket YAM-XXXX).
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useRouter } from "@/i18n/navigation";
import { PHOTO_MAX_SIZE_BYTES, PHOTO_MIME_TYPES, useImageKitUpload } from "@/hooks/useImageKitUpload";
import { BookingApiError, getBooking, submitDispute } from "../../booking-tracker.api";
import { bookingQueryKey } from "../../BookingTrackerClient";
import {
  DISPUTE_MIN_DESCRIPTION_LENGTH,
  type Booking,
  type DisputeCategory,
  type DisputeDesiredOutcome,
  type DisputePhotoDraft,
} from "../../booking-tracker.types";
import BookingTrackerSkeleton from "../../BookingTrackerSkeleton";
import BookingReportDesktop from "./BookingReportDesktop";
import BookingReportMobile from "./BookingReportMobile";
import ReportSuccess from "./ReportSuccess";

type Props = {
  bookingId: string;
};

export default function BookingReportClient({ bookingId }: Props) {
  const t = useTranslations("bookingTracker");
  const isMobile = useIsMobile();
  const router = useRouter();
  const queryClient = useQueryClient();
  // A73 — upload direct signé (D42), dossier dédié aux preuves de litige.
  const { uploadDetailed } = useImageKitUpload("/deals/dispute", {
    maxSizeBytes: PHOTO_MAX_SIZE_BYTES,
    allowedMimeTypes: PHOTO_MIME_TYPES,
  });

  const [booking, setBooking] = useState<Booking | null>(null);
  const [category, setCategory] = useState<DisputeCategory | null>(null);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<DisputePhotoDraft[]>([]);
  const [outcome, setOutcome] = useState<DisputeDesiredOutcome | null>(null);
  const [pledgeAccepted, setPledgeAccepted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBooking(bookingId)
      .then((b) => {
        if (cancelled) return;
        // 7A — sans droit de signaler (fenêtre close, deal terminé ou déjà
        // signalé, transit < 48 h) : retour au suivi avec un message. Le
        // serveur reste seul juge ; le front reflète `allowedActions`.
        if (!b.allowedActions?.includes("dispute")) {
          toast.info(t("report.notAllowed"));
          router.replace("/bookings/" + bookingId);
          return;
        }
        // 5A — en transit, seul « non livré » a un sens : motif verrouillé.
        if (b.status === "PICKED_UP") setCategory("NOT_DELIVERED");
        setBooking(b);
      })
      .catch(() => {
        // getBooking est RÉEL (A37) : introuvable / pas à toi → retour
        // au tracker, qui affiche son propre état d'erreur.
        if (!cancelled) router.push("/bookings/" + bookingId);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, router]);

  const handleBack = useCallback(() => {
    router.push("/bookings/" + bookingId);
  }, [router, bookingId]);

  // 6A — la photo part DÈS la sélection ; l'envoi du signalement attend
  // que toutes soient en ligne (RG-P-13 : rien à moitié fait).
  const handleAddPhoto = useCallback(
    (photo: DisputePhotoDraft) => {
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

  const photosReady = photos.every((p) => !!p.url && !p.uploading && !p.error);
  const canSubmit =
    category !== null &&
    description.trim().length >= DISPUTE_MIN_DESCRIPTION_LENGTH &&
    pledgeAccepted &&
    photosReady;

  const handleSubmit = useCallback(async () => {
    if (!booking || !canSubmit || !category || !pledgeAccepted || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await submitDispute(booking.id, {
        category,
        description: description.trim(),
        photoUrls: photos.map((p) => p.url).filter((u): u is string => !!u),
        desiredOutcome: outcome ?? undefined,
        pledgeAccepted: true,
      });
      setTicketNumber(result.ticketNumber);
      // Le suivi relira le deal (DISPUTED) au retour.
      void queryClient.invalidateQueries({ queryKey: bookingQueryKey(booking.id) });
    } catch (e) {
      const code = e instanceof BookingApiError ? e.code : "GENERIC";
      if (code === "TRANSITION_NOT_ALLOWED") {
        toast.error(t("report.cta.toastConflict"));
        router.replace("/bookings/" + booking.id);
      } else if (code === "VALIDATION") {
        toast.error(t("report.cta.toastValidation"));
      } else {
        toast.error(t("report.cta.toastError"));
      }
    } finally {
      setIsSubmitting(false);
      setConfirming(false);
    }
  }, [
    booking,
    canSubmit,
    category,
    description,
    photos,
    outcome,
    pledgeAccepted,
    isSubmitting,
    t,
    queryClient,
    router,
  ]);

  if (isMobile === null || !booking) return <BookingTrackerSkeleton />;

  if (ticketNumber) {
    return (
      <ReportSuccess
        ticketNumber={ticketNumber}
        carrierFirstName={booking.carrier.firstName}
        onBackToTrackingAction={handleBack}
      />
    );
  }

  const shared = {
    booking,
    lockedCategory: booking.status === "PICKED_UP",
    category,
    description,
    photos,
    outcome,
    pledgeAccepted,
    confirming,
    isSubmitting,
    canSubmit,
    onBackAction: handleBack,
    onCategoryAction: (id: string) => setCategory(id as DisputeCategory),
    onDescriptionAction: setDescription,
    onAddPhotoAction: handleAddPhoto,
    onRemovePhotoAction: handleRemovePhoto,
    onOutcomeAction: (id: string) => setOutcome(id as DisputeDesiredOutcome),
    onPledgeToggleAction: () => setPledgeAccepted((p) => !p),
    onRequestSubmitAction: () => setConfirming(true),
    onCancelConfirmAction: () => setConfirming(false),
    onConfirmSubmitAction: handleSubmit,
  };

  return isMobile ? (
    <BookingReportMobile {...shared} />
  ) : (
    <BookingReportDesktop {...shared} />
  );
}

export type BookingReportViewProps = {
  booking: Booking;
  /** 5A — en transit : motif « non livré » verrouillé, bandeau explicatif. */
  lockedCategory: boolean;
  category: DisputeCategory | null;
  description: string;
  photos: DisputePhotoDraft[];
  outcome: DisputeDesiredOutcome | null;
  pledgeAccepted: boolean;
  confirming: boolean;
  isSubmitting: boolean;
  canSubmit: boolean;
  onBackAction: () => void;
  onCategoryAction: (id: string) => void;
  onDescriptionAction: (value: string) => void;
  onAddPhotoAction: (photo: DisputePhotoDraft) => void;
  onRemovePhotoAction: (photoId: string) => void;
  onOutcomeAction: (id: string) => void;
  onPledgeToggleAction: () => void;
  onRequestSubmitAction: () => void;
  onCancelConfirmAction: () => void;
  onConfirmSubmitAction: () => void;
};
