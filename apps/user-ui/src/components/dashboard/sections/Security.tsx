"use client";

/**
 * Security.tsx — mot de passe, email, appareils connectés, mes données (D65 + D63)
 * ===============================================================================
 * Chaque geste sensible passe par la porte sudo (SudoGate) : un 403 SUDO_REQUIRED ouvre la
 * porte, puis le geste est rejoué. Les sessions se listent et se révoquent une à une.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { DashboardCopy } from "@/app/[locale]/dashboard/dashboard.copy";
import SectionHeader from "@/components/dashboard/SectionHeader";
import { CardSection } from "@/components/dashboard/DashboardUI";
import PrivacySection from "@/components/dashboard/sections/PrivacySection";
import SudoGate from "@/components/dashboard/sections/SudoGate";
import useUser from "@/hooks/useUser";
import { apiMessage, changePassword, confirmEmailChange, fetchMySessions, isSudoRequired, requestEmailChange, revokeOtherSessions, revokeSession, type MemberSession } from "@/services/account.api";

type Flow = "idle" | "password" | "email";

export default function Security({ copy }: { copy: DashboardCopy }) {
  const s = copy.securityPage;
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useUser();
  const [flow, setFlow] = useState<Flow>("idle");
  const [gate, setGate] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // mot de passe
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  // email
  const [newEmail, setNewEmail] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [emailCode, setEmailCode] = useState("");
  // sessions
  const [sessions, setSessions] = useState<MemberSession[] | null>(null);

  const loadSessions = useCallback(() => fetchMySessions().then(setSessions).catch(() => setSessions([])), []);
  useEffect(() => { loadSessions(); }, [loadSessions]);

  function start(next: Flow) {
    setFlow(next);
    setGate(false);
    setMsg(null);
    setPwd(""); setPwd2(""); setNewEmail(""); setPending(null); setEmailCode("");
  }

  /** Joue un geste sensible ; sur 403 SUDO_REQUIRED, ouvre la porte et le rejouera. */
  async function sensitive(run: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try {
      await run();
    } catch (e) {
      if (isSudoRequired(e)) setGate(true);
      else setMsg({ tone: "err", text: apiMessage(e) ?? s.error });
    } finally {
      setBusy(false);
    }
  }

  const doPassword = () => sensitive(async () => {
    const r = await changePassword(pwd);
    setMsg({ tone: "ok", text: r.revokedSessions > 0 ? s.passwordDoneRevoked.replace("{n}", String(r.revokedSessions)) : s.passwordDone });
    setFlow("idle");
    loadSessions();
  });
  const doEmailRequest = () => sensitive(async () => {
    const r = await requestEmailChange(newEmail);
    setPending(r.pendingEmail);
    setMsg({ tone: "ok", text: s.emailCodeSent.replace("{email}", r.pendingEmail) });
  });
  async function doEmailConfirm() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await confirmEmailChange(emailCode);
      setMsg({ tone: "ok", text: s.emailDone.replace("{email}", r.email) });
      setFlow("idle");
      qc.invalidateQueries({ queryKey: ["user"] });
      loadSessions();
    } catch (e) {
      setMsg({ tone: "err", text: apiMessage(e) ?? s.error });
    } finally {
      setBusy(false);
    }
  }
  async function doRevoke(sess: MemberSession) {
    const r = await revokeSession(sess.jti).catch(() => null);
    if (r?.current) { qc.clear(); router.replace("/"); return; }
    loadSessions();
  }
  async function doRevokeOthers() {
    const n = await revokeOtherSessions().catch(() => 0);
    setMsg({ tone: "ok", text: s.sessionsRevoked.replace("{n}", String(n)) });
    loadSessions();
  }

  const pwdOk = pwd.length >= 8 && pwd === pwd2;
  const retryAfterGate = () => { setGate(false); if (flow === "password") void doPassword(); if (flow === "email") void doEmailRequest(); };

  return (
    <>
      <SectionHeader title={copy.security.title} subtitle={copy.security.sub} />

      <CardSection>
        <Row label={copy.password} description={s.passwordSub} action={s.change} onAction={() => start("password")} />
        <Row label={s.email} description={user?.email ?? ""} action={s.change} onAction={() => start("email")} />
      </CardSection>

      {msg && <p className={`mb-4 rounded-lg px-3 py-2 text-[12.5px] ${msg.tone === "ok" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200"}`}>{msg.text}</p>}

      {flow === "password" && (
        <CardSection>
          <div className="space-y-3 text-[13px]">
            <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">{s.passwordTitle}</h3>
            <p className="text-slate-600 dark:text-slate-400">{s.passwordExplain}</p>
            {gate ? <SudoGate copy={copy.sudo} onVerifiedAction={retryAfterGate} onCancelAction={() => setGate(false)} /> : (
              <>
                <input type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder={s.newPassword} className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900" />
                <input type="password" autoComplete="new-password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} placeholder={s.confirmPassword} className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900" />
                {pwd2 && pwd !== pwd2 && <p className="text-[12px] text-red-700">{s.passwordMismatch}</p>}
                <div className="flex gap-2">
                  <button type="button" disabled={busy || !pwdOk} onClick={doPassword} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900">{s.passwordConfirm}</button>
                  <button type="button" onClick={() => setFlow("idle")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] dark:border-slate-700">{s.cancel}</button>
                </div>
              </>
            )}
          </div>
        </CardSection>
      )}

      {flow === "email" && (
        <CardSection>
          <div className="space-y-3 text-[13px]">
            <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">{s.emailTitle}</h3>
            <p className="text-slate-600 dark:text-slate-400">{s.emailExplain}</p>
            {gate ? <SudoGate copy={copy.sudo} onVerifiedAction={retryAfterGate} onCancelAction={() => setGate(false)} /> : !pending ? (
              <>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder={s.newEmail} className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900" />
                <div className="flex gap-2">
                  <button type="button" disabled={busy || !/^\S+@\S+\.\S+$/.test(newEmail)} onClick={doEmailRequest} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900">{s.emailSendCode}</button>
                  <button type="button" onClick={() => setFlow("idle")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] dark:border-slate-700">{s.cancel}</button>
                </div>
              </>
            ) : (
              <>
                <input inputMode="numeric" maxLength={6} value={emailCode} onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" aria-label={s.emailCodeLabel} className="w-32 rounded-lg border border-slate-300 px-3 py-1.5 tracking-widest dark:border-slate-700 dark:bg-slate-900" />
                <div className="flex gap-2">
                  <button type="button" disabled={busy || emailCode.length !== 6} onClick={doEmailConfirm} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900">{s.emailConfirm}</button>
                  <button type="button" onClick={() => setFlow("idle")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] dark:border-slate-700">{s.cancel}</button>
                </div>
              </>
            )}
          </div>
        </CardSection>
      )}

      <CardSection>
        <div className="flex items-start justify-between gap-3 px-1 py-1">
          <div>
            <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">{copy.activeSessions}</h3>
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">{s.sessionsSub}</p>
          </div>
          {sessions && sessions.length > 1 && <button type="button" onClick={doRevokeOthers} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] dark:border-slate-700">{s.revokeOthers}</button>}
        </div>
        <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
          {!sessions ? <li className="py-2 text-[13px] text-slate-500">…</li> : sessions.map((sess) => (
            <li key={sess.jti} className="flex items-center justify-between gap-3 py-2 text-[13px]">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{sess.device}{sess.current ? ` · ${s.thisDevice}` : ""}</p>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">{s.lastActivity} {new Date(sess.lastActivityAt).toLocaleString()}{sess.ip ? ` · ${sess.ip}` : ""}{sess.rememberMe ? ` · ${s.remembered}` : ""}</p>
              </div>
              <button type="button" onClick={() => doRevoke(sess)} className="text-[12.5px] text-red-700 underline dark:text-red-400">{sess.current ? s.logoutHere : s.revoke}</button>
            </li>
          ))}
        </ul>
      </CardSection>

      {/* C-PR8b (D63) — mes données : relance, export, effacement (sous la même porte sudo) */}
      <PrivacySection copy={copy} />
    </>
  );
}

function Row({ label, description, action, onAction }: { label: string; description: string; action: string; onAction: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-1 py-2">
      <div>
        <p className="text-[13.5px] font-medium text-slate-900 dark:text-white">{label}</p>
        <p className="text-[12px] text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <button type="button" onClick={onAction} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] font-medium dark:border-slate-700">{action}</button>
    </div>
  );
}
