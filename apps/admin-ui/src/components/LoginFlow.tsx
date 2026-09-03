/**
 * LoginFlow.tsx — connexion admin en deux temps (D54, 8A)
 * =======================================================
 * 1. email + mot de passe → { next: "TOTP" | "SETUP" }
 * 2. TOTP : code à 6 chiffres ou code de secours
 *    SETUP : QR + secret, premier code, puis codes de secours montrés UNE fois.
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { ApiError, post } from "@/lib/api";

type Stage = "PASSWORD" | "TOTP" | "SETUP" | "BACKUP_CODES";

/** Un message qui dit la VRAIE cause (code HTTP + message serveur) : l'admin sait lire. */
function describeError(err: unknown, prefix: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Email ou mot de passe incorrect.";
    if (err.status === 429) return "Trop de requêtes vers l'API (limiteur du gateway) : réessaie dans quelques minutes.";
    return `${prefix} (HTTP ${err.status}) : ${err.message}`;
  }
  return `${prefix} : ${err instanceof Error ? err.message : "erreur réseau"} — le gateway (8080) et auth-service (6001) tournent-ils ?`;
}

export default function LoginFlow() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("PASSWORD");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string; qr: string } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  useEffect(() => {
    if (stage !== "SETUP" || setup) return;
    post<{ secret: string; otpauthUrl: string }>("/auth/admin/totp/setup", undefined, { auth: false })
      .then(async (r) => setSetup({ ...r, qr: await QRCode.toDataURL(r.otpauthUrl, { width: 220, margin: 1 }) }))
      .catch((e) => setError(describeError(e, "Impossible de préparer la 2FA")));
  }, [stage, setup]);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ next: "TOTP" | "SETUP" }>("/auth/admin/login", { email, password }, { auth: false });
      setPassword("");
      setStage(r.next);
    } catch (err) {
      setError(describeError(err, "Connexion impossible"));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (stage === "SETUP") {
        const r = await post<{ backupCodes: string[] }>("/auth/admin/totp/enable", { code }, { auth: false });
        setBackupCodes(r.backupCodes);
        setStage("BACKUP_CODES");
      } else {
        await post("/auth/admin/totp/verify", { code }, { auth: false });
        router.replace("/disputes");
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && /expired|required/i.test(err.message)) {
        setError("Délai dépassé : recommence depuis le mot de passe.");
        setStage("PASSWORD");
      } else {
        setError(err instanceof ApiError && err.status === 401 ? "Code invalide." : describeError(err, "Vérification impossible"));
      }
    } finally {
      setBusy(false);
      setCode("");
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-lg font-bold">Yamba · Back-office</h1>
      <p className="mt-1 text-[13px] text-slate-500">Accès réservé, double authentification obligatoire.</p>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}

      {stage === "PASSWORD" && (
        <form onSubmit={submitPassword} className="mt-5 space-y-3">
          <label className="block text-[13px] font-medium">
            Email
            <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[14px]" />
          </label>
          <label className="block text-[13px] font-medium">
            Mot de passe
            <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[14px]" />
          </label>
          <button disabled={busy} className="w-full rounded-lg bg-slate-900 py-2.5 text-[14px] font-semibold text-white disabled:opacity-60">
            {busy ? "Vérification…" : "Continuer"}
          </button>
        </form>
      )}

      {stage === "SETUP" && (
        <div className="mt-5">
          <p className="text-[13px] text-slate-700">
            Première connexion : scanne ce code avec ton application d'authentification (Google Authenticator, Aegis, 1Password…), puis saisis le code affiché.
          </p>
          {setup ? (
            <div className="mt-3 flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={setup.qr} alt="QR code TOTP" width={220} height={220} />
              <p className="break-all text-center font-mono text-[11px] text-slate-500">{setup.secret}</p>
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-slate-500">Préparation…</p>
          )}
          <CodeForm code={code} setCode={setCode} busy={busy} onSubmit={submitCode} label="Activer la 2FA" />
        </div>
      )}

      {stage === "TOTP" && (
        <div className="mt-5">
          <p className="text-[13px] text-slate-700">Saisis le code de ton application d'authentification, ou un code de secours.</p>
          <CodeForm code={code} setCode={setCode} busy={busy} onSubmit={submitCode} label="Se connecter" allowBackup />
        </div>
      )}

      {stage === "BACKUP_CODES" && (
        <div className="mt-5">
          <p className="text-[13px] font-semibold text-slate-900">2FA activée. Codes de secours, montrés une seule fois :</p>
          <ul className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-3 font-mono text-[13px]">
            {backupCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-slate-500">Range-les hors de ce poste (gestionnaire de mots de passe). Chaque code ne sert qu'une fois.</p>
          <button onClick={() => router.replace("/disputes")} className="mt-4 w-full rounded-lg bg-slate-900 py-2.5 text-[14px] font-semibold text-white">
            J'ai enregistré mes codes
          </button>
        </div>
      )}
    </div>
  );
}

function CodeForm({ code, setCode, busy, onSubmit, label, allowBackup = false }: { code: string; setCode: (v: string) => void; busy: boolean; onSubmit: (e: React.FormEvent) => void; label: string; allowBackup?: boolean }) {
  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <input
        autoFocus
        inputMode={allowBackup ? "text" : "numeric"}
        autoComplete="one-time-code"
        placeholder={allowBackup ? "123 456 ou ABCDE-FGHIJ" : "123 456"}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-[18px] tracking-widest"
      />
      <button disabled={busy || code.trim().length < 6} className="w-full rounded-lg bg-slate-900 py-2.5 text-[14px] font-semibold text-white disabled:opacity-60">
        {busy ? "Vérification…" : label}
      </button>
    </form>
  );
}
