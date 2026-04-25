"use client";

import { useEffect } from "react";
import { ChevronLeft } from "lucide-react";

type Props = {
  isOpen: boolean;
  title: string;
  onBack: () => void;
  /** Slot pour un input de recherche en haut (optionnel, ex: From/To autocomplete) */
  inputSlot?: React.ReactNode;
  /** Contenu principal scrollable */
  children: React.ReactNode;
  /** Slot bottom-fixed (optionnel, ex: bouton Confirm pour la date) */
  bottomSlot?: React.ReactNode;
};

/**
 * Sub-screen mobile plein écran qui slide depuis la droite (pattern iOS natif).
 *
 * Utilisé pour les sous-écrans From/To/Date du MobileSearchExperience :
 *  - Header bar avec back arrow + titre
 *  - Slot optionnel pour input (autocomplete sur From/To)
 *  - Contenu principal (suggestions ou calendrier)
 *  - Slot optionnel bottom-fixed (CTA Confirm)
 *
 * Animation : translateX 100% → 0 avec ease-out-expo (350ms).
 * Cohérence : mêmes paramètres pour les 3 sub-screens.
 */
export default function MobileFieldFullScreen({
                                                isOpen,
                                                title,
                                                onBack,
                                                inputSlot,
                                                children,
                                                bottomSlot,
                                              }: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onBack]);

  return (
    <div
      className="fixed inset-0 z-[510] flex flex-col bg-white dark:bg-slate-950 md:hidden"
      style={{
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 350ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-3 dark:border-slate-800/60"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 12px)",
          paddingBottom: 12,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          <ChevronLeft size={22} strokeWidth={2.4} />
        </button>
        <h2 className="text-[17px] font-semibold text-slate-900 dark:text-white">
          {title}
        </h2>
      </div>

      {inputSlot && (
        <div className="shrink-0 px-4 pb-2 pt-3">{inputSlot}</div>
      )}

      <div className="flex-1 overflow-y-auto">{children}</div>

      {bottomSlot && (
        <div
          className="shrink-0 border-t border-slate-100 bg-white px-4 dark:border-slate-800/60 dark:bg-slate-950"
          style={{
            paddingTop: 12,
            paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
          }}
        >
          {bottomSlot}
        </div>
      )}
    </div>
  );
}
