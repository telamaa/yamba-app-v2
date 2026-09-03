// apps/user-ui/src/components/layout/header/HeaderShareTripCTA.tsx
"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import useShareTrip from "@/hooks/useShareTrip";
import AuthGateModal from "@/components/auth/shared/AuthGateModal";
import { HEADER_COLORS } from "./header.constants";

type Props = {
  /** Variante : `desktop` plein label, `mobile` label court, `compact` icône+ uniquement. */
  variant?: "desktop" | "mobile" | "compact";
};

/**
 * CTA "Partager un trajet".
 *
 * Logique gérée par `useShareTrip` (A60) :
 * - Non connecté → modale « Connecte-toi pour partager un trajet » (retour /trips/create)
 * - Connecté     → /trips/create
 *
 * Aucun gate Stripe ici — l'onboarding Yamber est déclenché à l'acceptation
 * d'une proposition, pas à la publication d'un trajet.
 */
export default function HeaderShareTripCTA({ variant = "desktop" }: Props) {
  const t = useTranslations("common.header");
  const tGate = useTranslations("common.authGate.shareTrip");
  const { handleShareTrip, gateOpen, closeGate, shareRedirect } = useShareTrip();

  const gate = (
    <AuthGateModal
      open={gateOpen}
      onCloseAction={closeGate}
      title={tGate("title")}
      subtitle={tGate("subtitle")}
      redirect={shareRedirect}
    />
  );

  const baseClass =
    "inline-flex items-center justify-center font-semibold transition-colors focus:outline-none focus-visible:ring-4";
  const ringStyle = { outlineColor: `${HEADER_COLORS.mango}40` };

  if (variant === "compact") {
    return (
      <>
      {gate}
      <button
        type="button"
        onClick={handleShareTrip}
        aria-label={t("shareTrip")}
        title={t("shareTrip")}
        className={`${baseClass} h-9 w-9 rounded-full text-slate-950`}
        style={{ backgroundColor: HEADER_COLORS.mango, ...ringStyle }}
      >
        <Plus size={18} strokeWidth={2.5} />
      </button>
      </>
    );
  }

  if (variant === "mobile") {
    return (
      <>
      {gate}
      <button
        type="button"
        onClick={handleShareTrip}
        className={`${baseClass} rounded-full border px-3 py-1.5 text-[12px]`}
        style={{
          borderColor: HEADER_COLORS.mango,
          color: HEADER_COLORS.mango,
          ...ringStyle,
        }}
      >
        {t("shareTripShort")}
      </button>
      </>
    );
  }

  return (
    <>
    {gate}
    <button
      type="button"
      onClick={handleShareTrip}
      className={`${baseClass} rounded-full border bg-white px-4 py-2 text-sm text-slate-700 hover:bg-[#FFF6E8] dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900/60`}
      style={{ borderColor: HEADER_COLORS.mango, color: HEADER_COLORS.mango, ...ringStyle }}
    >
      {t("shareTrip")}
    </button>
    </>
  );
}
