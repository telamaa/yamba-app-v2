"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { CATEGORY_LABEL, dateTime, daysSince, money } from "@/lib/format";
import type { ArbitrationQueueResponse } from "@/lib/types";

export default function QueueTable() {
  const [data, setData] = useState<ArbitrationQueueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ArbitrationQueueResponse>("/admin/disputes").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="mt-6 text-[13px] text-red-700">{error}</p>;
  if (!data) return <p className="mt-6 text-[13px] text-slate-500">Chargement…</p>;
  if (data.items.length === 0) return <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center text-[13px] text-slate-500">Rien à arbitrer.</p>;

  return (
    <div className="mt-5">
      <p className="text-[12.5px] text-slate-500">{data.counts.disputes} litige(s) · {data.counts.retentions} retenue(s)</p>
      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2">Dossier</th>
              <th className="px-3 py-2">Motif</th>
              <th className="px-3 py-2">Corridor</th>
              <th className="px-3 py-2">Parties</th>
              <th className="px-3 py-2 text-right">Montant</th>
              <th className="px-3 py-2">Ouvert</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it) => {
              const age = daysSince(it.openedAt);
              return (
                <tr key={it.bookingId} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link href={`/disputes/${it.bookingId}`} className="font-semibold text-slate-900 underline-offset-2 hover:underline">
                      {it.kind === "DISPUTE" ? it.ticketNumber ?? "Litige" : "Retenue"}
                    </Link>
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${it.kind === "DISPUTE" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
                      {it.kind === "DISPUTE" ? "Litige" : "Retenue"}
                    </span>
                  </td>
                  <td className="px-3 py-2">{it.category ? CATEGORY_LABEL[it.category] ?? it.category : "Annulation après le départ"}</td>
                  <td className="px-3 py-2">{it.originCity} → {it.destinationCity}</td>
                  <td className="px-3 py-2">{it.shipperFirstName} (Exp.) · {it.carrierFirstName} (Voy.)</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(it.amountCents, it.currencyCode)}</td>
                  <td className="px-3 py-2">
                    {dateTime(it.openedAt)}
                    <span className={`ml-2 text-[11px] ${age >= 5 ? "font-semibold text-red-600" : "text-slate-400"}`}>J+{age}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
