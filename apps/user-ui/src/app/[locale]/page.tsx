"use client";

import Image from "next/image";
import { useMemo } from "react";
import { PiggyBank, ShieldCheck, Leaf } from "lucide-react";
import TripSearchBar from "@/components/search/TripSearchBar";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";

type Lang = "fr" | "en";

export default function HomePage() {
  const { lang } = useUiPreferences();

  const copy = useMemo(() => {
    const isFr = (lang as Lang) === "fr";

    return {
      heroLine1: isFr ? "Un trajet existe déjà," : "A trip already exists,",
      heroLine2: isFr ? "Profitez-en :" : "Make the most of it:",
      heroLine3: isFr
        ? "Envoyer vos colis légers autrement."
        : "Send your lightweight parcels differently.",
      heroAlt: isFr
        ? "Voyageuse dans un transport, illustration du voyage collaboratif Yamba"
        : "Traveler in transport, illustration of collaborative shipping with Yamba",

      card1Tag: isFr ? "Économie" : "Savings",
      card1Title: isFr ? "Moins cher" : "More affordable",
      card1Text: isFr
        ? "Réduisez le coût d’envoi de vos petits colis grâce à des trajets déjà prévus."
        : "Lower the cost of sending small parcels by using trips that are already planned.",

      card2Tag: isFr ? "Confiance" : "Trust",
      card2Title: isFr ? "Plus transparent" : "More transparent",
      card2Text: isFr
        ? "Suivi clair du colis, échanges facilités et relation directe avec le voyageur."
        : "Clear parcel tracking, easier communication, and direct contact with the traveler.",

      card3Tag: isFr ? "Impact" : "Impact",
      card3Title: isFr ? "Plus responsable" : "More responsible",
      card3Text: isFr
        ? "Yamba optimise des trajets existants pour limiter les transports dédiés inutiles."
        : "Yamba optimizes existing trips to reduce unnecessary dedicated transport.",
    };
  }, [lang]);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-white dark:bg-slate-950">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-24 top-0 h-72 w-72 rounded-full bg-[#FF9900]/10 blur-3xl dark:bg-[#FF9900]/10" />
          <div className="absolute left-0 top-24 h-64 w-64 rounded-full bg-cyan-100/40 blur-3xl dark:bg-cyan-900/10" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pt-10 pb-20 md:pt-14 md:pb-24">
          <div className="grid items-center gap-4 md:grid-cols-[58%_42%] md:gap-4 lg:gap-6">
            {/* Texte */}
            <div className="flex h-full items-center md:pl-4 md:pr-6 lg:pl-1 lg:pr-10">
              <div className="w-full max-w-none">
                <h1 className="text-4xl font-extrabold leading-[1.02] tracking-tight text-slate-900 dark:text-white md:text-[44px] lg:text-[48px]">
                  <span className="block">{copy.heroLine1}</span>
                  <span className="mt-1 block">{copy.heroLine2}</span>

                  <span className="relative mt-3 block text-[#FF9900]">
                    {copy.heroLine3}
                    <span className="absolute -bottom-2 left-0 h-3 w-40 rounded-full bg-[#FF9900]/15 blur-md dark:bg-[#FF9900]/10" />
                  </span>
                </h1>
              </div>
            </div>

            {/* Image */}
            <div className="hidden md:block w-full md:pr-2 lg:pr-8">
              <div className="relative h-[260px] md:h-[300px] lg:h-[348px]">
                <div className="absolute right-0 top-0 h-full w-[108%] overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-100 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  <Image
                    src="/assets/images/home-hero-yamba.svg"
                    alt={copy.heroAlt}
                    fill
                    priority
                    className="object-cover object-center"
                  />
                </div>
              </div>
          </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-white dark:to-slate-950" />
      </section>

      {/* SEARCH BAR */}
      <section className="relative z-[60]">
        <div className="sticky top-2">
          <TripSearchBar />
        </div>
      </section>

      {/* PREMIUM VALUE CARDS */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-4 md:grid-cols-3">
          {/* Card 1 */}
          <div className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4">
              <div className="inline-flex rounded-full border border-[#FF9900]/20 bg-[#FFF6E8] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 dark:border-[#FF9900]/15 dark:bg-slate-900 dark:text-slate-300">
                {copy.card1Tag}
              </div>

              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#FF9900]/10 text-[#FF9900] dark:bg-[#FF9900]/10">
                <PiggyBank size={20} />
              </div>
            </div>

            <h2 className="mt-5 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
              {copy.card1Title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {copy.card1Text}
            </p>
          </div>

          {/* Card 2 */}
          <div className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4">
              <div className="inline-flex rounded-full border border-[#0F766E]/20 bg-[#0F766E]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 dark:border-[#0F766E]/15 dark:bg-slate-900 dark:text-slate-300">
                {copy.card2Tag}
              </div>

              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0F766E]/10 text-[#0F766E] dark:bg-[#0F766E]/10 dark:text-[#2DD4BF]">
                <ShieldCheck size={20} />
              </div>
            </div>

            <h2 className="mt-5 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
              {copy.card2Title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {copy.card2Text}
            </p>
          </div>

          {/* Card 3 */}
          <div className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4">
              <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 dark:border-emerald-900/20 dark:bg-slate-900 dark:text-slate-300">
                {copy.card3Tag}
              </div>

              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                <Leaf size={20} />
              </div>
            </div>

            <h2 className="mt-5 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
              {copy.card3Title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {copy.card3Text}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
