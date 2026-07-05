/**
 * RatingSuccess.tsx
 * =================
 * "Merci pour ton retour !" + rappel réciprocité (double-aveugle 14j)
 * + retour à l'accueil.
 */

"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  ratedFirstName: string;
  onBackHomeAction: () => void;
};

export default function RatingSuccess({ ratedFirstName, onBackHomeAction }: Props) {
  const t = useTranslations("rating");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg">
          <Star size={36} fill="currentColor" aria-hidden="true" />
        </div>

        <h1 className="mt-6 text-[26px] font-black tracking-tight text-slate-900 dark:text-white sm:text-[30px]">
          {t("success.title")}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-slate-600 dark:text-slate-400">
          {t("success.subtitle")}
        </p>

        <div className="mt-6 rounded-2xl bg-slate-100 px-5 py-4 text-left dark:bg-slate-900">
          <p className="text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-400">
            {t("success.reciprocity", { firstName: ratedFirstName })}
          </p>
        </div>

        <button
          type="button"
          onClick={onBackHomeAction}
          className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#FF9900] px-4 text-[14px] font-bold text-slate-950 transition-colors hover:bg-[#F08700]"
        >
          {t("success.backHome")}
        </button>
      </div>
    </div>
  );
}
