"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthCard from "./AuthCard";
import { authApi } from "@/lib/api/auth";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";

export default function RefreshGate() {
  const router = useRouter();
  const sp = useSearchParams();
  const { lang } = useUiPreferences();

  const next = sp.get("next") || "/";
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await authApi.refresh();
        router.replace(next);
      } catch (e: any) {
        setError(e?.message ?? "Refresh failed");
      }
    })();
  }, [next, router]);

  const L = lang === "fr"
    ? { title: "Rafraîchissement session", sub: "Mise à jour de la session en cours..." }
    : { title: "Refreshing session", sub: "Updating your session..." };

  return (
    <AuthCard title={{ fr: L.title, en: L.title }} subtitle={{ fr: L.sub, en: L.sub }}>
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : (
        <div className="text-sm text-slate-600 dark:text-slate-400">...</div>
      )}
    </AuthCard>
  );
}
