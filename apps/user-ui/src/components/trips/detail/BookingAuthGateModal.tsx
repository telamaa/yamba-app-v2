"use client";

/**
 * BookingAuthGateModal — « Connecte-toi pour réserver » (RG-C-12, A58)
 * Habillage de AuthGateModal pour la réservation : texte booking.authGate,
 * retour DIRECT dans le wizard (`/trips/:id/book`).
 */
import { useTranslations } from "next-intl";
import AuthGateModal from "@/components/auth/shared/AuthGateModal";
import { bookingRedirectFor } from "@/lib/auth/login-redirect";

type Props = {
  open: boolean;
  tripId: string;
  onCloseAction: () => void;
};

export default function BookingAuthGateModal({ open, tripId, onCloseAction }: Props) {
  const t = useTranslations("booking.authGate");
  return (
    <AuthGateModal
      open={open}
      onCloseAction={onCloseAction}
      title={t("title")}
      subtitle={t("subtitle")}
      redirect={bookingRedirectFor(tripId)}
    />
  );
}
