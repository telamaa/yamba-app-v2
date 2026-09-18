"use client";

import { useTranslations } from "next-intl";
import { ShieldCheck, KeyRound, BadgeCheck, LifeBuoy } from "lucide-react";

/**
 * La confiance par les mécanismes RÉELS du produit (refonte accueil 18/09) :
 * remplace les statistiques et les témoignages inventés. Quatre dispositifs
 * qui existent dans le code — séquestre Stripe, code de livraison, profils et
 * billets vérifiés, médiation — et une promesse de prix vérifiable.
 */
const ITEMS = [
  { id: "escrow", icon: <ShieldCheck size={22} />, accent: "text-[#0F766E] bg-teal-50 dark:bg-teal-950/40 dark:text-teal-400" },
  { id: "code", icon: <KeyRound size={22} />, accent: "text-[#FF9900] bg-orange-50 dark:bg-orange-950/40 dark:text-[#FFB84D]" },
  { id: "verified", icon: <BadgeCheck size={22} />, accent: "text-[#0F766E] bg-teal-50 dark:bg-teal-950/40 dark:text-teal-400" },
  { id: "support", icon: <LifeBuoy size={22} />, accent: "text-[#FF9900] bg-orange-50 dark:bg-orange-950/40 dark:text-[#FFB84D]" },
] as const;

export default function TrustSection() {
  const t = useTranslations("home.trust");

  return (
    <section className="bg-white py-14 dark:bg-slate-950 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto mb-10 max-w-xl text-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            {t("label")}
          </span>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white md:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className={`mb-4 grid h-11 w-11 place-items-center rounded-xl ${item.accent}`}>
                {item.icon}
              </div>
              <h3 className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
                {t(`items.${item.id}.title`)}
              </h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">
                {t(`items.${item.id}.description`)}
              </p>
            </div>
          ))}
        </div>

        {/* La promesse de prix, en une ligne : pas de grille de commission en page d'accueil */}
        <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-slate-100 bg-slate-50 px-6 py-5 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[15px] font-bold text-slate-900 dark:text-white">
            {t("pricing.promise")}
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">
            {t("pricing.detail")}
          </p>
        </div>
      </div>
    </section>
  );
}
