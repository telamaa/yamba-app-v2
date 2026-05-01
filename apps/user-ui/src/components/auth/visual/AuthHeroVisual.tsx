"use client";

import Image from "next/image";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import type { HeroVisual } from "@/lib/auth/hero-visuals";

type Props = {
  visual: HeroVisual;
};

type Stat = { num: string; label: string };
type Testimonial = { quote: string; name: string; role: string; initial: string };

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

  // Mode illustration : gradient + headline + illustration + stats + testimonial
  const headline = fr ? "Le transport, c'est vous." : "Shipping, by the people.";
  const subline = fr
    ? "Yamba connecte expéditeurs et transporteurs pour livrer mieux, ensemble."
    : "Yamba connects shippers and travellers to deliver better, together.";

  // ⚠️ TODO Yamba : remplacer par les vrais chiffres une fois en prod
  const stats: Stat[] = [
    { num: "12k+", label: fr ? "Yambers" : "Yambers" },
    { num: "48h", label: fr ? "Livraison" : "Delivery" },
    { num: "4.8", label: fr ? "Note" : "Rating" },
  ];

  // ⚠️ TODO Yamba : remplacer par un vrai témoignage
  const testimonial: Testimonial = {
    quote: fr
      ? "Mes colis arrivent en 48h, et bien moins cher qu'en transporteur classique."
      : "My parcels arrive in 48h, much cheaper than traditional carriers.",
    name: "Aminata D.",
    role: fr ? "Yamber depuis 2025" : "Yamber since 2025",
    initial: "A",
  };

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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 border-y border-slate-200 py-3 dark:border-slate-800">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-lg font-extrabold tracking-tight text-[#FF9900]">
              {s.num}
            </div>
            <div className="mt-0.5 text-[10px] leading-tight text-slate-500 dark:text-slate-400">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Testimonial — 2 lignes max via line-clamp */}
      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF9900] to-[#FF7A1A] text-xs font-bold text-white">
          {testimonial.initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs italic leading-snug text-slate-500 dark:text-slate-400">
            &ldquo;{testimonial.quote}&rdquo;
          </p>
          <p className="mt-1 text-[10px] text-slate-700 dark:text-slate-300">
            <span className="font-semibold">{testimonial.name}</span>
            <span className="text-slate-500 dark:text-slate-400"> — {testimonial.role}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
