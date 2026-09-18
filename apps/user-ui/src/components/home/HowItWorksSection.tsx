"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Search,
  CreditCard,
  Handshake,
  KeyRound,
  PlaneTakeoff,
  Inbox,
  PackageCheck,
  Wallet,
} from "lucide-react";

type Tab = "send" | "travel";

/**
 * « Comment ça marche » à deux onglets (refonte accueil 18/09) : remplace les
 * 5 étapes qui mélangeaient tutoiement/vouvoiement et inventaient une étape
 * « Signez un contrat ». Les étapes décrivent le VRAI parcours produit, et la
 * face Voyageur est enfin visible avant le pied de page.
 */
const STEPS: Record<Tab, { id: string; icon: React.ReactNode }[]> = {
  send: [
    { id: "find", icon: <Search size={20} /> },
    { id: "book", icon: <CreditCard size={20} /> },
    { id: "handoff", icon: <Handshake size={20} /> },
    { id: "delivered", icon: <KeyRound size={20} /> },
  ],
  travel: [
    { id: "publish", icon: <PlaneTakeoff size={20} /> },
    { id: "accept", icon: <Inbox size={20} /> },
    { id: "deliver", icon: <PackageCheck size={20} /> },
    { id: "paid", icon: <Wallet size={20} /> },
  ],
};

export default function HowItWorksSection() {
  const t = useTranslations("home.how");
  const [tab, setTab] = useState<Tab>("send");

  return (
    <section className="bg-slate-50 py-14 dark:bg-slate-900 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto mb-8 max-w-xl text-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            {t("label")}
          </span>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white md:text-4xl">
            {t("title")}
          </h2>
        </div>

        {/* Onglets Expéditeur / Voyageur */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-950">
            {(["send", "travel"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-pressed={tab === id}
                className={`rounded-full px-5 py-2 text-[13px] font-semibold transition-colors ${
                  tab === id
                    ? "bg-[#FF9900] text-slate-950"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {t(`tabs.${id}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 md:gap-4">
          {STEPS[tab].map((step, i) => (
            <div
              key={step.id}
              className="rounded-2xl border border-slate-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 text-[#FF9900] dark:from-orange-950/40 dark:to-orange-900/40">
                  {step.icon}
                </div>
                <span className="text-[11px] font-bold tracking-[0.15em] text-[#FF9900]">
                  0{i + 1}
                </span>
              </div>
              <h3 className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
                {t(`${tab}.${step.id}.title`)}
              </h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">
                {t(`${tab}.${step.id}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
