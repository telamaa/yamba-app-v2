"use client";

/** MaintenanceBanner.tsx — l'état de maintenance vu du back-office (C-PR8c, D64 2A) : lit le public `/api/maintenance` toutes les 60 s. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { PublicMaintenance } from "@/lib/types";

export default function MaintenanceBanner() {
  const [state, setState] = useState<PublicMaintenance | null>(null);
  useEffect(() => {
    const load = () => apiFetch<PublicMaintenance>("/maintenance", {}, { auth: false }).then(setState).catch(() => undefined);
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);
  if (!state || (!state.enabled && !state.scheduledAt)) return null;
  const scheduled = state.scheduledAt && new Date(state.scheduledAt).getTime() > Date.now();
  return (
    <div className={`mb-4 rounded-xl border px-4 py-2 text-[12.5px] ${state.enabled ? "border-red-300 bg-red-50 text-red-900" : scheduled ? "border-amber-300 bg-amber-50 text-amber-900" : "hidden"}`}>
      <b>{state.enabled ? "Plateforme en lecture seule" : `Maintenance annoncée le ${new Date(state.scheduledAt as string).toLocaleString("fr-FR")}`}</b>
      {state.message.fr ? ` — ${state.message.fr}` : ""} · <Link href="/status" className="underline">état des services</Link>
    </div>
  );
}
