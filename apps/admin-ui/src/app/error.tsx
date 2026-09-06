"use client";

/**
 * error.tsx — frontière d'erreur du back-office
 * ==============================================
 * Public différent du site : un opérateur veut savoir quoi faire, pas être rassuré.
 * On affiche donc la référence d'incident en évidence, le message technique court
 * (l'opérateur le transmet au développeur), et deux gestes : réessayer, revenir à
 * l'accueil. Aucune traduction : le back-office est francophone.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [reference, setReference] = useState(error.digest ?? "");
  useEffect(() => {
    const id = Sentry.captureException(error);
    if (id) setReference(id.slice(0, 8));
  }, [error]);

  const outdated = /ChunkLoadError|Loading chunk|dynamically imported module/i.test(`${error.name} ${error.message}`);

  return (
    <div className="mx-auto max-w-xl py-16" role="alert">
      <h1 className="text-xl font-bold">Cet écran n&apos;a pas pu s&apos;afficher</h1>
      <p className="mt-2 text-[13.5px] text-slate-600">
        {outdated
          ? "Une nouvelle version du back-office vient d'être publiée. Recharge la page pour la récupérer."
          : "Un incident technique est survenu. Aucune action que tu as validée n'est perdue : le journal enregistre chaque geste au moment où il est appliqué."}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => (outdated ? window.location.reload() : reset())} className="rounded-lg bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white">
          {outdated ? "Recharger" : "Réessayer"}
        </button>
        <Link href="/home" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-[13px] font-medium">Retour à l&apos;accueil</Link>
      </div>
      {reference && (
        <p className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
          Référence de l&apos;incident : <code className="font-semibold">{reference}</code> — à donner au développeur.
          {error.message && <span className="mt-1 block font-mono text-[11px] text-slate-500">{error.message.slice(0, 300)}</span>}
        </p>
      )}
    </div>
  );
}
