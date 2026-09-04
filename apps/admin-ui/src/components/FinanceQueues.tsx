"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ApiError, apiFetch, post } from "@/lib/api";
import { PAYOUT_FAILURE_LABEL, dateTime, money } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { AdminMe, FinanceQueueItem, FinanceQueueKind, FinanceQueueResponse } from "@/lib/types";

const KINDS: Array<{ kind: FinanceQueueKind; label: string; hint: string }> = [
  { kind: "FAILED", label: "Versements en échec", hint: "Le cron rejoue seul (5 min, puis 30 min, 2 h, 1 jour). « Relancer » n'attend pas l'échéance." },
  { kind: "REVERSED", label: "Transferts renversés", hint: "Stripe a renvoyé l'argent à la plateforme. Rien ne repart sans décision : re-verser ou abandonner, avec motif." },
  { kind: "HELD", label: "Retenues à arbitrer", hint: "Annulation après le départ sans prise en charge : la retenue attend la médiation." },
];

export default function FinanceQueues() {
  const sp = useSearchParams();
  const initial = (sp.get("kind") as FinanceQueueKind | null) ?? "FAILED";
  const [kind, setKind] = useState<FinanceQueueKind>(KINDS.some((k) => k.kind === initial) ? initial : "FAILED");
  const [data, setData] = useState<FinanceQueueResponse | null>(null);
  const [me, setMe] = useState<AdminMe | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => {
    setData(null);
    apiFetch<FinanceQueueResponse>(`/admin/finances/queue?kind=${kind}`).then(setData).catch((e) => setMsg(e instanceof ApiError ? `${e.status} : ${e.message}` : "Chargement impossible."));
  }, [kind]);
  useEffect(load, [load]);
  useEffect(() => { apiFetch<AdminMe>("/admin/me").then(setMe).catch(() => undefined); }, []);

  async function retry(it: FinanceQueueItem) {
    setMsg(null);
    try {
      const r = await post<{ payoutStatus: string; reason: string | null }>(`/admin/deals/${it.bookingId}/payout/retry`);
      setMsg(r.payoutStatus === "SENT" ? "Versement envoyé." : `Toujours en échec : ${r.reason ?? "motif inconnu"}.`);
      load();
    } catch (e) { setMsg(e instanceof ApiError ? `${e.status} : ${e.message}` : "Relance impossible."); }
  }

  const current = KINDS.find((k) => k.kind === kind)!;
  const canRetry = can(me?.adminRole, "payouts.retry");
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button key={k.kind} onClick={() => setKind(k.kind)} className={`rounded-lg border px-3 py-1.5 text-[12.5px] ${k.kind === kind ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"}`}>{k.label}</button>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-slate-500">{current.hint}</p>
      {msg && <p className="mt-2 text-[12.5px] text-slate-700">{msg}</p>}
      {!data ? <p className="mt-4 text-[13px] text-slate-500">Chargement…</p> : data.items.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center text-[13px] text-slate-500">Rien à traiter.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <tr><th className="px-3 py-2">Deal</th><th className="px-3 py-2">Parties</th><th className="px-3 py-2 text-right">Montant</th><th className="px-3 py-2">État</th><th className="px-3 py-2">Depuis</th><th className="px-3 py-2"></th></tr>
            </thead>
            <tbody>
              {data.items.map((it) => (
                <tr key={it.bookingId} className="border-t border-slate-100 align-top hover:bg-slate-50">
                  <td className="px-3 py-2"><Link href={`/deals/${it.bookingId}`} className="font-semibold underline-offset-2 hover:underline">{it.corridor.originCity} → {it.corridor.destinationCity}</Link><div className="text-[11px] text-slate-500">{it.status}{it.disputeTicket ? ` · ${it.disputeTicket}` : ""} · départ {dateTime(it.corridor.departureAt)}</div></td>
                  <td className="px-3 py-2 text-[12.5px]">Exp. <Link href={`/users/${it.shipper.id}`} className="underline-offset-2 hover:underline">{it.shipper.firstName}</Link> · Voy. <Link href={`/users/${it.carrier.id}`} className="underline-offset-2 hover:underline">{it.carrier.firstName}</Link>{it.carrier.stripeReady === false && <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Stripe non prêt</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(it.amountCents, it.currencyCode)}</td>
                  <td className="px-3 py-2 text-[12.5px]">
                    {kind === "HELD" ? "retenue conservée" : (
                      <>
                        {it.payoutFailureKind ? PAYOUT_FAILURE_LABEL[it.payoutFailureKind] : it.payoutStatus}
                        {it.payoutFailureDetail && <div className="font-mono text-[11px] text-slate-500">{it.payoutFailureDetail}</div>}
                        {kind === "FAILED" && <div className="text-[11px] text-slate-500">{it.payoutAttempts} tentative(s){it.nextRetryAt ? ` · prochaine ${dateTime(it.nextRetryAt)}` : ""}</div>}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-[12.5px]">{dateTime(it.since)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {kind === "FAILED" && canRetry && me?.id !== it.shipper.id && me?.id !== it.carrier.id && <button onClick={() => retry(it)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white">Relancer</button>}
                    {kind === "REVERSED" && <Link href={`/deals/${it.bookingId}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12px]">Décider</Link>}
                    {kind === "HELD" && <Link href={`/disputes/${it.bookingId}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12px]">Arbitrer</Link>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <p className="mt-2 text-[11px] text-slate-400">{data.items.length} ligne(s) · calculé le {dateTime(data.generatedAt)}.</p>}
    </div>
  );
}
