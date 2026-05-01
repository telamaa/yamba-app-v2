"use client";

import Link from "next/link";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import React from "react";

type Props = {
  title: { fr: string; en: string };
  subtitle?: { fr: string; en: string };
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export default function AuthCard({ title, subtitle, children, footer }: Props) {
  const { lang } = useUiPreferences();
  const t = lang === "fr" ? title.fr : title.en;
  const s = subtitle ? (lang === "fr" ? subtitle.fr : subtitle.en) : null;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-5">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {t}
          </h1>
          {s && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{s}</p>}
        </div>

        {children}

        {footer ? <div className="mt-5">{footer}</div> : null}

        <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-500">
          <Link className="hover:underline" href="/apps/user-ui/public">
            Yamba
          </Link>
          {" · "}© {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
