"use client";

import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import {
  BadgeCheck, KeyRound, Mail, PackageCheck, PartyPopper, Plane, Star, Wallet,
} from "lucide-react";
import SectionHeader from "@/components/dashboard/SectionHeader";

/**
 * PREVIEW Notifications — cible visuelle du chantier backend deals :
 * les événements de la state machine (spec §10). Non-lues surlignées.
 */

const EVENTS = [
  { icon: Mail, tone: "amber", unread: true,
    fr: ["Nouvelle demande de transport", "Aminata T. · Paris → Brazzaville · tu gagnes 89,30 € · expire dans 3 h", "il y a 21 h"],
    en: ["New transport request", "Aminata T. · Paris → Brazzaville · you earn €89.30 · expires in 3 h", "21 h ago"] },
  { icon: KeyRound, tone: "amber", unread: true,
    fr: ["Ton code de livraison est disponible", "Thomas a pris ton colis en charge · transmets le code à Marie", "il y a 2 h"],
    en: ["Your delivery code is available", "Thomas picked up your parcel · share the code with Marie", "2 h ago"] },
  { icon: PackageCheck, tone: "emerald", unread: true,
    fr: ["Ton colis a été livré à Marie", "Code validé par Thomas · tu as 3 jours pour confirmer ou signaler", "hier"],
    en: ["Your parcel was delivered to Marie", "Code validated by Thomas · 3 days to confirm or report", "yesterday"] },
  { icon: Plane, tone: "teal", unread: false,
    fr: ["Thomas a décollé ✈", "Paris → Brazzaville · vol de 8 h · atterrissage estimé 22h04", "hier"],
    en: ["Thomas took off ✈", "Paris → Brazzaville · 8 h flight · estimated landing 22:04", "yesterday"] },
  { icon: Wallet, tone: "emerald", unread: false,
    fr: ["Versement effectué : 89,30 €", "Deal Josué M. · viré sur ton compte via Stripe", "il y a 3 j"],
    en: ["Payout sent: €89.30", "Deal Josué M. · sent to your account via Stripe", "3 d ago"] },
  { icon: Star, tone: "amber", unread: false,
    fr: ["Pense à noter Léa", "Ton envoi Paris → Pointe-Noire est terminé", "il y a 4 j"],
    en: ["Remember to rate Léa", "Your Paris → Pointe-Noire shipment is complete", "4 d ago"] },
  { icon: BadgeCheck, tone: "teal", unread: false,
    fr: ["Signalement bien reçu · YAM-4821", "Accusé de réception · réponse sous 48 h ouvrées · paiement gelé", "il y a 5 j"],
    en: ["Report received · YAM-4821", "Acknowledged · reply within 48 business hours · payout frozen", "5 d ago"] },
  { icon: PartyPopper, tone: "emerald", unread: false,
    fr: ["Sofia t'a laissé ★ 5", "« Colis impeccable, communication au top ! »", "il y a 8 j"],
    en: ["Sofia left you ★ 5", "“Perfect parcel, great communication!”", "8 d ago"] },
] as const;

const TONE = {
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300",
  teal: "bg-teal-50 text-teal-700 dark:bg-teal-900/25 dark:text-teal-300",
};

export default function NotificationsPreview() {
  const { lang } = useUiPreferences();
  const isFr = lang === "fr";
  const unreadCount = EVENTS.filter((e) => e.unread).length;

  return (
    <>
      <SectionHeader
        title="Notifications"
        subtitle={isFr ? `${unreadCount} non lues` : `${unreadCount} unread`}
      />
      {EVENTS.map((event, i) => {
        const [title, sub, when] = isFr ? event.fr : event.en;
        const Icon = event.icon;
        return (
          <div
            key={i}
            className={
              "relative mb-1.5 flex items-center gap-3 rounded-lg bg-white px-4 py-3 transition-colors hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800/60 " +
              (event.unread ? "" : "opacity-70 hover:opacity-100")
            }
          >
            {event.unread && (
              <span aria-hidden className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r bg-amber-400" />
            )}
            <div className={"grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl " + TONE[event.tone]}>
              <Icon size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-medium text-slate-900 dark:text-white">{title}</div>
              <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{sub}</div>
            </div>
            <span className="flex-none text-[11px] text-slate-400 dark:text-slate-500">{when}</span>
          </div>
        );
      })}
    </>
  );
}
