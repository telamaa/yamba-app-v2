/**
 * ContactActions.tsx
 * ==================
 * Paire de boutons "Envoyer un message" + "Appeler" pour contacter
 * l'expéditeur ou le destinataire.
 *
 * Standards mobile natif :
 *  - Touch targets ≥ 48px
 *  - Grid 2 cols sur mobile (largeur partagée)
 *  - Flex auto sur desktop
 */

"use client";

import { MessageSquare, Phone } from "lucide-react";

type Props = {
  contactFirstName: string;
  messageLabel: string;
  callLabel: string;
  onMessageAction: () => void;
  onCallAction: () => void;
  variant?: "amber" | "outline";
  layout?: "grid" | "row";
  disabled?: boolean;
};

export default function ContactActions({
                                         contactFirstName,
                                         messageLabel,
                                         callLabel,
                                         onMessageAction,
                                         onCallAction,
                                         variant = "amber",
                                         layout = "grid",
                                         disabled = false,
                                       }: Props) {
  const containerClass =
    layout === "grid" ? "grid grid-cols-2 gap-2.5" : "flex flex-wrap gap-2.5";

  const primaryClass =
    variant === "amber"
      ? "bg-amber-700 text-white hover:bg-amber-800 active:bg-amber-900 dark:bg-amber-600 dark:hover:bg-amber-700"
      : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

  const secondaryClass =
    variant === "amber"
      ? "border border-amber-300 bg-white text-amber-900 hover:bg-amber-100/50 active:bg-amber-100 dark:border-amber-700 dark:bg-transparent dark:text-amber-200 dark:hover:bg-amber-950/30"
      : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

  return (
    <div className={containerClass}>
      <button
        type="button"
        onClick={onMessageAction}
        disabled={disabled}
        aria-label={`${messageLabel} ${contactFirstName}`}
        className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-semibold transition-colors disabled:opacity-50 sm:text-[14px] ${primaryClass}`}
      >
        <MessageSquare size={14} aria-hidden="true" />
        <span>{messageLabel}</span>
      </button>
      <button
        type="button"
        onClick={onCallAction}
        disabled={disabled}
        aria-label={`${callLabel} ${contactFirstName}`}
        className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-semibold transition-colors disabled:opacity-50 sm:text-[14px] ${secondaryClass}`}
      >
        <Phone size={14} aria-hidden="true" />
        <span>{callLabel}</span>
      </button>
    </div>
  );
}
