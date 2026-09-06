"use client";

/**
 * SudoGate.tsx — la porte des gestes sensibles (D65 1A, SES-03)
 * =============================================================
 * Un composant, trois usages : mot de passe, email, données (D63), tableau de bord Stripe.
 * Il envoie le code, le vérifie, ouvre la fenêtre de 15 min, puis appelle `onVerifiedAction`.
 */
import { useState } from "react";
import type { DashboardCopy } from "@/app/[locale]/dashboard/dashboard.copy";
import { apiMessage, requestSudoCode, verifySudo } from "@/services/account.api";

export default function SudoGate({ copy, onVerifiedAction, onCancelAction }: { copy: DashboardCopy["sudo"]; onVerifiedAction: () => void | Promise<void>; onCancelAction?: () => void }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function send() {
    setBusy(true);
    setMsg(null);
    try {
      await requestSudoCode();
      setSent(true);
      setMsg({ tone: "ok", text: copy.sent });
    } catch (e) {
      setMsg({ tone: "err", text: apiMessage(e) ?? copy.error });
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    setBusy(true);
    setMsg(null);
    try {
      await verifySudo(code);
      await onVerifiedAction();
    } catch (e) {
      setMsg({ tone: "err", text: apiMessage(e) ?? copy.error });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-[13px] dark:border-amber-800 dark:bg-amber-950/30">
      <p className="font-medium text-amber-900 dark:text-amber-200">{copy.title}</p>
      <p className="mt-0.5 text-amber-800 dark:text-amber-300">{copy.explain}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={send} className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-[12.5px] font-medium disabled:opacity-50 dark:bg-slate-900">{sent ? copy.resend : copy.send}</button>
        {sent && (
          <>
            <input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" aria-label={copy.codeLabel} className="w-32 rounded-lg border border-slate-300 px-3 py-1.5 tracking-widest dark:border-slate-700 dark:bg-slate-900" />
            <button type="button" disabled={busy || code.length !== 6} onClick={verify} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900">{copy.confirm}</button>
          </>
        )}
        {onCancelAction && <button type="button" onClick={onCancelAction} className="text-[12.5px] underline">{copy.cancel}</button>}
      </div>
      {msg && <p className={`mt-2 text-[12.5px] ${msg.tone === "ok" ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"}`}>{msg.text}</p>}
    </div>
  );
}
