"use client";

import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import SectionHeader from "@/components/dashboard/SectionHeader";

/**
 * PREVIEW Messages — cible visuelle du chantier messagerie in-app (V2) :
 * conversations contextualisées par deal.
 */

const CONVERSATIONS = [
  { initials: "AT", bg: "#B45309", unread: 2,
    fr: ["Aminata T.", "Parfait, je serai au Terminal 2E à 13h45 👍", "14:32", "Envoi · Paris → Brazzaville · Pris en charge"],
    en: ["Aminata T.", "Perfect, I'll be at Terminal 2E at 1:45pm 👍", "2:32pm", "Shipment · Paris → Brazzaville · Picked up"] },
  { initials: "SR", bg: "#0F766E", unread: 1,
    fr: ["Sonia R.", "Est-ce que je peux ajouter une petite enveloppe ?", "11:05", "Deal · Paris → Brazzaville · Accepté"],
    en: ["Sonia R.", "Can I add a small envelope?", "11:05am", "Deal · Paris → Brazzaville · Accepted"] },
  { initials: "MM", bg: "#534AB7", unread: 0,
    fr: ["Marie M.", "Bien reçu le code, merci ! À ce soir", "hier", "Destinataire · Brazzaville"],
    en: ["Marie M.", "Got the code, thanks! See you tonight", "yesterday", "Recipient · Brazzaville"] },
  { initials: "LK", bg: "#BE185D", unread: 0,
    fr: ["Léa K.", "Merci pour ta note ⭐ au plaisir !", "il y a 4 j", "Deal terminé · Paris → Pointe-Noire"],
    en: ["Léa K.", "Thanks for the rating ⭐ see you around!", "4 d ago", "Completed deal · Paris → Pointe-Noire"] },
] as const;

export default function MessagesPreview() {
  const { lang } = useUiPreferences();
  const isFr = lang === "fr";
  const unread = CONVERSATIONS.reduce((n, c) => n + c.unread, 0);

  return (
    <>
      <SectionHeader
        title="Messages"
        subtitle={isFr ? `${unread} messages non lus` : `${unread} unread messages`}
      />
      {CONVERSATIONS.map((conv, i) => {
        const [name, snippet, when, context] = isFr ? conv.fr : conv.en;
        return (
          <div
            key={i}
            className="mb-1.5 flex items-center gap-3 rounded-lg bg-white px-4 py-3 transition-colors hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800/60"
          >
            <div
              className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full text-[12px] font-bold text-white"
              style={{ backgroundColor: conv.bg }}
            >
              {conv.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[13.5px] font-medium text-slate-900 dark:text-white">{name}</span>
                <span className="flex-none text-[11px] text-slate-400 dark:text-slate-500">{when}</span>
              </div>
              <div className={"mt-0.5 truncate text-xs " + (conv.unread > 0 ? "font-medium text-slate-700 dark:text-slate-200" : "text-slate-500 dark:text-slate-400")}>
                {snippet}
              </div>
              <div className="mt-1 truncate text-[10.5px] text-slate-400 dark:text-slate-500">{context}</div>
            </div>
            {conv.unread > 0 && (
              <span className="grid h-5 min-w-[20px] flex-none place-items-center rounded-full px-1.5 text-[11px] font-bold text-slate-900" style={{ backgroundColor: "#FF9900" }}>
                {conv.unread}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}
