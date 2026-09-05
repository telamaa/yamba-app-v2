"use client";

/**
 * PrivacySection.tsx — « Mes données » (C-PR8b, D63) : télécharger, supprimer, préférence de relance
 * ==================================================================================================
 * Deux gestes sensibles derrière la porte sudo (D65 : SudoGate, fenêtre de 15 min). L'effacement est immédiat
 * et irréversible : on le dit, on fait taper SUPPRIMER, et le serveur refuse tant qu'un deal vit
 * (liste fermée de motifs, traduite ici).
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { DashboardCopy } from "@/app/[locale]/dashboard/dashboard.copy";
import { CardSection } from "@/components/dashboard/DashboardUI";
import useUser from "@/hooks/useUser";
import { ErasureBlockedError, downloadMyData, eraseMyAccount, fetchErasureBlockers, updateMyPreferences, type ErasureBlocker } from "@/services/privacy.api";
import { isSudoRequired } from "@/services/account.api";
import SudoGate from "@/components/dashboard/sections/SudoGate";
import { analyticsConfigured, disableAnalytics, ensureAnalytics, readConsent, writeConsent } from "@/lib/analytics";

type Flow = "idle" | "export" | "erase";

export default function PrivacySection({ copy }: { copy: DashboardCopy }) {
  const p = copy.privacy;
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useUser();
  const [flow, setFlow] = useState<Flow>("idle");
  const [gate, setGate] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [blockers, setBlockers] = useState<ErasureBlocker[] | null>(null);
  const [reminders, setReminders] = useState<boolean>(true);
  const [analytics, setAnalytics] = useState<boolean>(false); // D66

  useEffect(() => {
    if (user && typeof (user as { messagingReminderEmails?: boolean }).messagingReminderEmails === "boolean") setReminders((user as { messagingReminderEmails?: boolean }).messagingReminderEmails as boolean);
  }, [user]);
  useEffect(() => { setAnalytics(readConsent() === "granted"); }, [user]);

  async function start(next: Flow) {
    setFlow(next);
    setMsg(null);
    setConfirmation("");
    setGate(false);
    if (next === "erase") {
      try {
        const check = await fetchErasureBlockers();
        setBlockers(check.blockers);
      } catch {
        setBlockers(null);
      }
    }
  }

  async function runExport() {
    setBusy(true);
    setMsg(null);
    try {
      const { filename } = await downloadMyData();
      setMsg({ tone: "ok", text: `${p.exportDone} (${filename})` });
      setFlow("idle");
    } catch (e) {
      if (isSudoRequired(e)) setGate(true);
      else setMsg({ tone: "err", text: errorText(e) ?? p.error });
    } finally {
      setBusy(false);
    }
  }

  async function runErase() {
    setBusy(true);
    setMsg(null);
    try {
      await eraseMyAccount(confirmation);
      qc.clear();
      router.replace("/");
    } catch (e) {
      if (isSudoRequired(e)) {
        setGate(true);
      } else if (e instanceof ErasureBlockedError) {
        setBlockers(e.check.blockers);
        setMsg({ tone: "err", text: p.blocked });
      } else {
        setMsg({ tone: "err", text: errorText(e) ?? p.error });
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleAnalytics() {
    const next = !analytics;
    setAnalytics(next);
    writeConsent(next ? "granted" : "denied");
    if (next) void ensureAnalytics(); else disableAnalytics();
    updateMyPreferences({ analyticsOptIn: next }).catch(() => undefined);
  }
  async function toggleReminders() {
    const next = !reminders;
    setReminders(next);
    try {
      await updateMyPreferences({ messagingReminderEmails: next });
      qc.invalidateQueries({ queryKey: ["user"] });
    } catch {
      setReminders(!next);
    }
  }

  const blocked = blockers && blockers.length > 0;

  return (
    <div className="space-y-4">
      <CardSection>
        <div className="px-4 py-3">
          <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">{p.title}</h3>
          <p className="mt-0.5 text-[12.5px] text-slate-500 dark:text-slate-400">{p.sub}</p>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          <div>
            <p className="text-[13.5px] font-medium text-slate-900 dark:text-white">{p.reminders}</p>
            <p className="text-[12px] text-slate-500 dark:text-slate-400">{p.remindersSub}</p>
          </div>
          <button type="button" role="switch" aria-checked={reminders} onClick={toggleReminders} className={`relative h-6 w-11 shrink-0 rounded-full transition ${reminders ? "bg-[#0F766E]" : "bg-slate-300 dark:bg-slate-700"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${reminders ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>
        {analyticsConfigured() && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
            <div>
              <p className="text-[13.5px] font-medium text-slate-900 dark:text-white">{p.analytics}</p>
              <p className="text-[12px] text-slate-500 dark:text-slate-400">{p.analyticsSub}</p>
            </div>
            <button type="button" role="switch" aria-checked={analytics} onClick={toggleAnalytics} className={`relative h-6 w-11 shrink-0 rounded-full transition ${analytics ? "bg-[#0F766E]" : "bg-slate-300 dark:bg-slate-700"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${analytics ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          <div>
            <p className="text-[13.5px] font-medium text-slate-900 dark:text-white">{p.export}</p>
            <p className="text-[12px] text-slate-500 dark:text-slate-400">{p.exportSub}</p>
          </div>
          <button type="button" onClick={() => start("export")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] font-medium dark:border-slate-700">{p.exportAction}</button>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          <div>
            <p className="text-[13.5px] font-medium text-red-700 dark:text-red-400">{p.erase}</p>
            <p className="text-[12px] text-slate-500 dark:text-slate-400">{p.eraseSub}</p>
          </div>
          <button type="button" onClick={() => start("erase")} className="rounded-lg border border-red-300 px-3 py-1.5 text-[12.5px] font-medium text-red-700 dark:border-red-800 dark:text-red-400">{p.eraseAction}</button>
        </div>
      </CardSection>

      {msg && <p className={`rounded-lg px-3 py-2 text-[12.5px] ${msg.tone === "ok" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200"}`}>{msg.text}</p>}

      {flow !== "idle" && (
        <CardSection>
          <div className="space-y-3 px-4 py-4 text-[13px]">
            <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">{flow === "export" ? p.export : p.erase}</h3>
            {flow === "erase" && (
              <>
                <p className="text-slate-700 dark:text-slate-300">{p.eraseExplain}</p>
                {blocked && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    <p className="font-medium">{p.blocked}</p>
                    <ul className="mt-1 list-disc pl-5">{blockers!.map((b) => <li key={b}>{p.blockers[b]}</li>)}</ul>
                  </div>
                )}
              </>
            )}
            {!blocked && gate && <SudoGate copy={copy.sudo} onVerifiedAction={() => { setGate(false); return flow === "export" ? runExport() : runErase(); }} onCancelAction={() => setGate(false)} />}
            {!blocked && !gate && (
              <>
                {flow === "erase" && (
                  <label className="block">
                    <span className="text-slate-700 dark:text-slate-300">{p.confirmLabel}</span>
                    <input value={confirmation} onChange={(e) => setConfirmation(e.target.value.toUpperCase())} placeholder="SUPPRIMER" className="mt-1 w-48 rounded-lg border border-slate-300 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900" />
                  </label>
                )}
                <div className="flex gap-2">
                  {flow === "export" && <button type="button" disabled={busy} onClick={runExport} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900">{p.exportConfirm}</button>}
                  {flow === "erase" && <button type="button" disabled={busy || confirmation !== "SUPPRIMER"} onClick={runErase} className="rounded-lg bg-red-700 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-40">{p.eraseConfirm}</button>}
                  <button type="button" onClick={() => setFlow("idle")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] dark:border-slate-700">{p.cancel}</button>
                </div>
              </>
            )}
            {blocked && <button type="button" onClick={() => setFlow("idle")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] dark:border-slate-700">{p.cancel}</button>}
          </div>
        </CardSection>
      )}
    </div>
  );
}

function errorText(e: unknown): string | null {
  const data = (e as { response?: { data?: { message?: string; details?: { message?: string } } } })?.response?.data;
  return data?.message ?? null;
}
