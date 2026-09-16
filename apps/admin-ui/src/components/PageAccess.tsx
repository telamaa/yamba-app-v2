"use client";

/**
 * PageAccess.tsx — une page que le profil n'ouvre pas dit UN refus, en tête, et rien d'autre (décision du 15/09/2026)
 * =================================================================================================================
 * Recette 02-ADMIN § 5.19 : un profil sans la permission d'une page lisait le titre, la consigne, les titres de section et,
 * sous chacun, « Chargement… » ou un message anglais. Le refus vient du SERVEUR (403 de la lecture principale de la page,
 * A146 — jamais une décision du front) : le composant qui charge appelle `useDenyPage()(texte)`, et la page entière est
 * remplacée par son titre et un seul bloc de refus. Les pages où tous les profils ont la permission n'en ont pas besoin.
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

const DenyContext = createContext<(text: string) => void>(() => undefined);

export default function PageAccess({ title, children }: { title: string; children: ReactNode }) {
  const [refusal, setRefusal] = useState<string | null>(null);
  const deny = useCallback((text: string) => setRefusal((current) => current ?? text), []);
  if (refusal) {
    return (
      <>
        <h1 className="text-xl font-bold">{title}</h1>
        <p role="alert" className="mt-4 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-[13.5px] text-slate-800">{refusal}</p>
      </>
    );
  }
  return <DenyContext.Provider value={deny}>{children}</DenyContext.Provider>;
}

/** Le refus d'une page, à appeler depuis la lecture principale quand le serveur répond 403. */
export const useDenyPage = () => useContext(DenyContext);

/** Un refus de permission (403, code ADMIN_PERMISSION_DENIED) — à distinguer d'une panne ou d'une ressource absente. */
export function isPermissionRefusal(e: unknown): boolean {
  const err = e as { status?: number; data?: { details?: { code?: string } } } | null;
  return err?.status === 403 || err?.data?.details?.code === "ADMIN_PERMISSION_DENIED";
}
