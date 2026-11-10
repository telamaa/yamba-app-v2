"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import {
  AtSign,
  CreditCard,
  Inbox,
  ShieldCheck,
  Timer,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import type { HeroVisual } from "@/lib/auth/hero-visuals";

type Props = {
  visual: HeroVisual;
  /**
   * D92 1A — ce que la colonne RACONTE.
   *
   * `promises` (défaut) : les trois garanties produit de D45, qui servent
   * l'ACQUISITION — elles ont leur place devant quelqu'un qui hésite encore.
   *
   * `waiting` : l'étape de vérification. Servir l'argumentaire à quelqu'un
   * qui vient de signer, c'est vendre après la vente ; la colonne répond
   * alors à la seule question du moment — « et si le mail n'arrive pas ? ».
   */
  variant?: "promises" | "waiting";
  /** Le geste de la variante `waiting` (« Ouvrir ma boîte mail »). */
  action?: ReactNode;
};

/** D45 — trois promesses PRODUIT vraies (CNF-05, capture manuelle D11, GAR-02), jamais un chiffre inventé. */
type Promise = { icon: LucideIcon; title: string; text: string };

export default function AuthHeroVisual({ visual, variant = "promises", action }: Props) {
  const { lang } = useUiPreferences();
  const help = useTranslations("auth.otp.help");
  const fr = lang === "fr";
  const alt = fr ? visual.altFr : visual.altEn;

  // Mode photo : full-bleed sans gradient ni stats ni témoignage
  if (visual.type === "photo") {
    return (
      <div className="relative h-full min-h-[560px] w-full overflow-hidden">
        <Image
          src={visual.src}
          alt={alt}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-950/15 to-transparent" />
      </div>
    );
  }

  // Mode illustration : gradient + accroche + illustration + trois points
  const waiting = variant === "waiting";
  const headline = waiting
    ? help("headline")
    : fr
      ? "Le transport, c'est toi."
      : "Shipping, by the people.";
  const subline = waiting
    ? help("subline")
    : fr
      ? "Yamba connecte celles et ceux qui envoient un colis à celles et ceux qui voyagent."
      : "Yamba connects people who send a parcel with people who travel.";

  // D92 1A — les trois réponses à « et si le mail n'arrive pas ? ». Elles
  // remplacent l'argumentaire SUR CETTE ÉTAPE seulement.
  const waitingPoints: Promise[] = [
    { icon: Timer, title: help("delayTitle"), text: help("delayText") },
    { icon: Inbox, title: help("spamTitle"), text: help("spamText") },
    { icon: AtSign, title: help("addressTitle"), text: help("addressText") },
  ];

  // Recette 03/09 (D45) : les « 12k+ Yambers / 48h / 4.8 » et le témoignage
  // fictif sont remplacés par ce que le produit garantit VRAIMENT.
  const promises: Promise[] = [
    {
      icon: UserCheck,
      title: fr ? "Des personnes identifiées" : "Identified people",
      text: fr
        ? "Un compte vérifié pour réserver, un profil public pour chaque Voyageur."
        : "A verified account to book, a public profile for every Traveler.",
    },
    {
      icon: CreditCard,
      title: fr ? "Débité seulement si c'est accepté" : "Charged only once accepted",
      text: fr
        ? "Le paiement est autorisé à la demande et confirmé à l'acceptation du Voyageur."
        : "Payment is authorized at request time and captured when the Traveler accepts.",
    },
    {
      icon: ShieldCheck,
      title: fr ? "Garantie Yamba incluse" : "Yamba guarantee included",
      text: fr
        ? "Code de remise, photos de prise en charge et suivi à chaque étape."
        : "Handover code, pickup photos and tracking at every step.",
    },
  ];

  return (
    <div className="flex h-full min-h-[560px] w-full flex-col justify-between gap-4 bg-gradient-to-b from-[#FFF7E8] to-white p-6 lg:p-8 dark:from-[#1F1408] dark:to-slate-950">
      {/* Headline */}
      <div>
        <h2 className="text-xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-white lg:text-2xl">
          {headline}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {subline}
        </p>
      </div>

      {/* Promesses produit (D45) — REMONTÉES sous l'accroche (D91).
          Elles étaient ancrées en bas de colonne, sous ~400 px de vide : les
          trois meilleurs arguments de la page arrivaient après l'illustration,
          hors du premier regard. L'ordre de lecture suit maintenant l'ordre
          d'importance ; l'illustration descend et redevient ce qu'elle est,
          un décor. */}
      <ul className="mt-6 space-y-2.5">
        {(waiting ? waitingPoints : promises).map((p) => (
          <li key={p.title} className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white text-[#0F766E] shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-teal-300 dark:ring-slate-800">
              <p.icon size={15} strokeWidth={2.2} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-tight text-slate-900 dark:text-white">{p.title}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-slate-500 dark:text-slate-400">{p.text}</p>
            </div>
          </li>
        ))}
      </ul>

      {action !== undefined && action !== null && <div className="mt-5">{action}</div>}

      {/* Illustration */}
      <div className="flex flex-1 items-center justify-center py-2">
        <Image
          src={visual.src}
          alt={alt}
          width={320}
          height={180}
          priority
          className="h-auto max-h-[180px] max-w-full"
        />
      </div>
    </div>
  );
}
