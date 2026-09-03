"use client";

/**
 * AuthGateModal — la porte d'identité SANS quitter la page (A58, A60)
 * ===================================================================
 * Un visiteur non connecté qui tente une action réservée (réserver, partager
 * un trajet, mettre en favori…) voit la porte dans une MODALE (dialogue
 * centré sur desktop, feuille du bas sur mobile) au-dessus de la page, jamais
 * une page blanche. A63 : la modale embarque LE FORMULAIRE DE CONNEXION
 * (e-mail / mot de passe, Google, Facebook) — aucune redirection. Après
 * connexion : `onSignedInAction` si fourni (l'appelant reprend son geste),
 * sinon navigation vers `redirect` (l'intention de départ). L'inscription
 * reste une page (lien avec retour). Le serveur reste seul juge (CNF-05).
 */
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Lock, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useIsMobile } from "@/hooks/useIsMobile";
import LoginForm from "@/components/auth/forms/LoginForm";

type Props = {
  open: boolean;
  onCloseAction: () => void;
  /** Texte de l'action (ex. « Connecte-toi pour réserver »). */
  title: string;
  subtitle: string;
  /** Chemin interne de retour après connexion / inscription. */
  redirect: string;
  /** A63 — après connexion DANS la modale : reprendre le geste (sinon navigation vers `redirect`). */
  onSignedInAction?: () => void;
};

export default function AuthGateModal({ open, onCloseAction, title, subtitle, redirect, onSignedInAction }: Props) {
  const t = useTranslations("common.authGate");
  const router = useRouter();
  const isMobile = useIsMobile();
  const panelRef = useRef<HTMLDivElement | null>(null);

  const handleSignedIn = () => {
    onCloseAction();
    if (onSignedInAction) onSignedInAction();
    else {
      router.push(redirect);
      router.refresh();
    }
  };

  // ESC ferme, focus sur l'action principale, scroll du fond verrouillé.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseAction();
    };
    document.addEventListener("keydown", onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>("input, button");
      first?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = original;
      cancelAnimationFrame(raf);
    };
  }, [open, onCloseAction]);

  if (!open || typeof document === "undefined") return null;

  const panelBase =
    "w-full bg-white text-left shadow-2xl dark:bg-slate-950 " +
    (isMobile
      ? "max-h-[92vh] overflow-y-auto rounded-t-3xl px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3"
      : "max-h-[92vh] max-w-md overflow-y-auto rounded-3xl p-6");

  // Portail vers <body> : la porte peut être déclenchée DEPUIS une carte-lien
  // (cœur favori) — rendue dans l'ancre, chaque clic naviguerait.
  return createPortal(
    <div
      className={`fixed inset-0 z-[210] flex ${isMobile ? "items-end" : "items-center justify-center p-4"}`}
      role="dialog"
      onClick={(e) => e.stopPropagation()}
      aria-modal="true"
      aria-labelledby="auth-gate-title"
      aria-describedby="auth-gate-subtitle"
    >
      <button
        type="button"
        aria-label={t("later")}
        onClick={onCloseAction}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
      />

      <div ref={panelRef} className={`relative ${panelBase}`}>
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
            <h2 id="auth-gate-title" className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              {title}
            </h2>
            <p id="auth-gate-subtitle" className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {subtitle}
            </p>
          </div>
        </div>

        {/* A63 — le formulaire de connexion lui-même (e-mail, Google, Facebook, lien inscription) */}
        <div className="mt-4">
          <LoginForm variant="modal" redirectOverride={redirect} onSuccessAction={handleSignedIn} />
        </div>

        <button
          type="button"
          onClick={onCloseAction}
          className="mt-4 block w-full text-center text-xs font-medium text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
        >
          {t("later")}
        </button>
      </div>
    </div>,
    document.body
  );
}
