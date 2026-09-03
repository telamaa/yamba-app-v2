"use client";

import Image from "next/image";
import { CreditCard, ShieldCheck, UserCheck, type LucideIcon } from "lucide-react";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import type { HeroVisual } from "@/lib/auth/hero-visuals";

type Props = {
  visual: HeroVisual;
};

/** D45 — trois promesses PRODUIT vraies (CNF-05, capture manuelle D11, GAR-02), jamais un chiffre inventé. */
type Promise = { icon: LucideIcon; title: string; text: string };

export default function AuthHeroVisual({ visual }: Props) {
  const { lang } = useUiPreferences();
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

  // Mode illustration : gradient + accroche + illustration + promesses produit
  const headline = fr ? "Le transport, c'est toi." : "Shipping, by the people.";
  const subline = fr
    ? "Yamba connecte celles et ceux qui envoient un colis à celles et ceux qui voyagent."
    : "Yamba connects people who send a parcel with people who travel.";

  // Recette 03/09 (D45) : les « 12k+ Yambers / 48h / 4.8 » et le témoignage
  // fictif sont remplacés par ce que le produit garantit VRAIMENT.
  const promises: Promise[] = [
    {
      icon: UserCheck,
      title: fr ? "Des personnes identifiées" : "Identified people",
      text: fr
        ? "Un compte vérifié pour réserver, un profil public pour chaque Voyageur."
        : "A verified account to book, a public profile for every carrier.",
    },
    {
      icon: CreditCard,
      title: fr ? "Débité seulement si c'est accepté" : "Charged only once accepted",
      text: fr
        ? "Le paiement est autorisé à la demande et confirmé à l'acceptation du Voyageur."
        : "Payment is authorized at request time and captured when the carrier accepts.",
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
        <h2 className="text-xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white lg:text-2xl">
          {headline}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {subline}
        </p>
      </div>

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

      {/* Promesses produit (D45) */}
      <ul className="space-y-2.5 border-t border-slate-200 pt-4 dark:border-slate-800">
        {promises.map((p) => (
          <li key={p.title} className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white text-[#0F766E] shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-teal-300 dark:ring-slate-800">
              <p.icon size={15} strokeWidth={2.2} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold leading-tight text-slate-900 dark:text-white">{p.title}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-slate-500 dark:text-slate-400">{p.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
