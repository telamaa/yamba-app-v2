"use client";

/**
 * ConversationView.tsx — lecture d'un fil depuis un dossier (F-PR3, D61 7A)
 * ==========================================================================
 * Lecture seule, entière, journalisée à l'ouverture (CONVERSATION_VIEWED). Les messages
 * signalés sont marqués ; les traces de révélation disent qui a vu le numéro et quand —
 * jamais le numéro lui-même.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, apiFetch } from "@/lib/api";
import { CHAT_ROLE_LABEL, REPORT_REASON_LABEL, REPORT_STATUS_LABEL, dateTime } from "@/lib/format";
import type { AdminConversation } from "@/lib/types";

const SYSTEM_LABEL: Record<string, string> = {
  "meetup.proposed": "Rendez-vous proposé",
  "meetup.accepted": "Rendez-vous confirmé",
  "phone.revealed": "Numéro affiché",
};

export default function ConversationView({ bookingId }: { bookingId: string }) {
  const [data, setData] = useState<AdminConversation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AdminConversation>(`/admin/conversations/by-deal/${bookingId}`)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError && e.status === 404 ? "Ce deal n'a pas de conversation." : e.message));
  }, [bookingId]);

  if (error) return <p className="text-[13px] text-red-700">{error}</p>;
  if (!data) return <p className="text-[13px] text-slate-500">Chargement de la conversation…</p>;

  const nameOf = (role: string) => (role === "SHIPPER" ? `${data.shipper.firstName} ${data.shipper.lastName}` : role === "CARRIER" ? `${data.carrier.firstName} ${data.carrier.lastName}` : "Système");

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap gap-3 text-[12.5px]">
        <Link href={`/disputes/${bookingId}`} className="text-slate-500 hover:underline">← Dossier du deal</Link>
        <Link href="/reports" className="text-slate-500 hover:underline">← Signalements</Link>
      </div>
      <h1 className="mt-2 text-xl font-bold">Conversation du deal</h1>
      <p className="text-[13px] text-slate-500">
        {data.corridor.originCity} → {data.corridor.destinationCity} · {data.bookingStatus} · Expéditeur {nameOf("SHIPPER")} · Voyageur {nameOf("CARRIER")}
      </p>
      <p className="mt-1 text-[12px] text-slate-500">Lecture journalisée. Le numéro de téléphone n'apparaît jamais ici : seules les révélations sont tracées.</p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Rendez-vous</h2>
          {data.meetups.length === 0 ? (
            <p className="mt-2 text-[13px] text-slate-500">Aucun.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-[13px]">
              {data.meetups.map((m) => (
                <li key={m.id}>
                  <span className="font-medium">{m.kind === "PICKUP" ? "Remise" : "Livraison"}</span> · {m.placeLabel} · {dateTime(m.startAt)} → {dateTime(m.endAt)} ·{" "}
                  <span className="text-slate-500">
                    {m.status === "ACCEPTED" ? "confirmé" : m.status === "PROPOSED" ? "proposé" : "annulé"} (par {CHAT_ROLE_LABEL[m.proposedByRole]})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Numéro révélé</h2>
          {data.phoneReveals.length === 0 ? (
            <p className="mt-2 text-[13px] text-slate-500">Personne n'a encore vu le numéro de l'autre.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-[13px]">
              {data.phoneReveals.map((r, i) => (
                <li key={i}>
                  {CHAT_ROLE_LABEL[r.revealedToRole]} a vu le numéro le {dateTime(r.revealedAt)}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Fil ({data.messages.length} messages)</h2>
        {data.messages.length === 0 ? (
          <p className="mt-2 text-[13px] text-slate-500">Aucun message.</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {data.messages.map((m) => {
              const reported = m.reports.length > 0;
              if (m.kind !== "TEXT") {
                return (
                  <li key={m.id} className="text-center text-[12px] text-slate-500">
                    {SYSTEM_LABEL[m.systemKey ?? ""] ?? m.body} · {CHAT_ROLE_LABEL[m.authorRole]} · {dateTime(m.createdAt)}
                  </li>
                );
              }
              return (
                <li key={m.id} className={`rounded-lg border px-3 py-2 ${reported ? "border-red-300 bg-red-50" : "border-slate-100 bg-slate-50"} ${m.authorRole === "CARRIER" ? "ml-8" : "mr-8"}`}>
                  <div className="flex flex-wrap justify-between gap-2 text-[11.5px] text-slate-500">
                    <span>
                      <span className="font-semibold text-slate-700">{nameOf(m.authorRole)}</span> · {CHAT_ROLE_LABEL[m.authorRole]}
                      {m.flaggedContact && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">coordonnées détectées</span>}
                    </span>
                    <span>{dateTime(m.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] text-slate-900">{m.body}</p>
                  {reported && (
                    <ul className="mt-1.5 space-y-0.5 text-[12px] text-red-800">
                      {m.reports.map((r) => (
                        <li key={r.id}>
                          ⚑ {REPORT_REASON_LABEL[r.reason] ?? r.reason} — signalé par {CHAT_ROLE_LABEL[r.reporterRole]} le {dateTime(r.createdAt)} · {REPORT_STATUS_LABEL[r.status]}
                          {r.details && <span className="text-red-700"> · « {r.details} »</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
