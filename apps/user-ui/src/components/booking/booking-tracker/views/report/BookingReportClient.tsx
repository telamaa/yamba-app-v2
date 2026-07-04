/**
 * BookingReportClient.tsx
 * =======================
 * Orchestrateur du formulaire de signalement. Tient tout le state du
 * formulaire + confirmation inline + envoi + succès (ticket YAM-XXXX).
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useRouter } from "@/i18n/navigation";
import { getBooking, submitDispute } from "../../booking-tracker.api";
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
    getBooking(bookingId).then((b) => {
      if (!cancelled) setBooking(b);
    });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const handleBack = useCallback(() => {
    router.push("/bookings/" + bookingId);
  }, [router, bookingId]);

  const handleAddPhoto = useCallback((photo: DisputePhotoDraft) => {
    setPhotos((prev) => [...prev, photo]);
  }, []);

  const handleRemovePhoto = useCallback((photoId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  }, []);

  const canSubmit =
    category !== null &&
    description.trim().length >= DISPUTE_MIN_DESCRIPTION_LENGTH &&
    pledgeAccepted;

  const handleSubmit = useCallback(async () => {
    if (!booking || !canSubmit || !category || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await submitDispute(booking.id, {
        category,
        description: description.trim(),
        photos,
        desiredOutcome: outcome ?? undefined,
        pledgeAccepted,
      });
      setTicketNumber(result.ticketNumber);
    } catch {
      toast.error(t("report.cta.toastError"));
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
