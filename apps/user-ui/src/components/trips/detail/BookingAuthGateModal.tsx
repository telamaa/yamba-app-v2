"use client";

/**
 * BookingAuthGateModal — « Connecte-toi pour réserver » SANS quitter le trajet
 * ==========================================================================
 * RG-C-12 / A58 : un visiteur non connecté qui clique « Réserver » voit la
 * porte d'identité dans une MODALE (dialogue centré sur desktop, feuille du
 * bas sur mobile) au-dessus de la page du trajet, au lieu d'être emmené sur
 * une page blanche. La page `/trips/[id]/book` garde sa propre porte pour
 * un accès direct par URL (le serveur reste le seul juge : CNF-05).
 *
 * Après connexion ou inscription, retour DIRECT dans le wizard
 * (`/trips/:id/book`) — l'intention était de réserver.
 */
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Lock, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { withRedirect } from "@/lib/auth/safe-redirect";
import { bookingRedirectFor } from "@/lib/auth/login-redirect";
import { useIsMobile } from "@/hooks/useIsMobile";

type Props = {
  open: boolean;
  tripId: string;
  onCloseAction: () => void;
};

export default function BookingAuthGateModal({ open, tripId, onCloseAction }: Props) {
  const t = useTranslations("booking.authGate");
  const router = useRouter();
  const isMobile = useIsMobile();
  const primaryRef = useRef<HTMLButtonElement | null>(null);

  const redirect = bookingRedirectFor(tripId);

  // ESC ferme, focus sur l'action principale, scroll du fond verrouillé.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseAction();
    };
    document.addEventListener("keydown", onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => primaryRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = original;
      cancelAnimationFrame(raf);
    };
  }, [open, onCloseAction]);

  if (!open) return null;

  const goLogin = () => router.push(withRedirect("/login", redirect));
  const goRegister = () => router.push(withRedirect("/register", redirect));

  const panelBase =
    "w-full bg-white text-left shadow-2xl dark:bg-slate-950 " +
    (isMobile
      ? "rounded-t-3xl px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3"
      : "max-w-md rounded-3xl p-6");

  return (
    <div
      className={`fixed inset-0 z-[210] flex ${isMobile ? "items-end" : "items-center justify-center p-4"}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-auth-gate-title"
      aria-describedby="booking-auth-gate-subtitle"
    >
      <button
        type="button"
        aria-label={t("later")}
        onClick={onCloseAction}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
      />

      <div className={`relative ${panelBase}`}>
        {isMobile ? (
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" aria-hidden />
        ) : (
          <button
            type="button"
            onClick={onCloseAction}
            aria-label={t("later")}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <X size={18} />
          </button>
        )}

        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-[#FF9900]/15 text-[#B45309] dark:bg-[#FF9900]/20 dark:text-[#FFAE33]">
            <Lock size={18} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="booking-auth-gate-title" className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              {t("title")}
            </h2>
            <p id="booking-auth-gate-subtitle" className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {t("subtitle")}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            ref={primaryRef}
            type="button"
            onClick={goLogin}
            className="w-full rounded-full bg-[#FF9900] px-5 py-3 text-sm font-bold text-slate-950 transition-all hover:brightness-95 active:scale-[0.99]"
          >
            {t("login")}
          </button>
          <button
            type="button"
            onClick={goRegister}
            className="w-full rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900"
          >
            {t("register")}
          </button>
          <button
            type="button"
            onClick={onCloseAction}
            className="mt-1 text-center text-xs font-medium text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
          >
            {t("later")}
          </button>
        </div>
      </div>
    </div>
  );
}
