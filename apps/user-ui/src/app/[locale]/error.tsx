"use client";

/**
 * error.tsx — la frontière d'erreur du site (toutes les pages sous [locale])
 * ===========================================================================
 * Trois exigences, dans cet ordre.
 *
 * 1. Ne JAMAIS montrer la trace technique au membre : elle ne lui apprend rien et
 *    inquiète. On affiche une référence d'incident courte, copiable, que le support
 *    retrouve dans Sentry.
 * 2. Rassurer sur ce qui compte. Un plantage pendant la réservation pose une seule
 *    question au membre : « ai-je été débité ? ». La réponse est donnée avant tout le
 *    reste, et elle est vraie : l'argent n'est autorisé qu'à la création de la demande.
 * 3. Une action évidente. « Réessayer » relance le rendu sans recharger ; si la panne
 *    vient d'une version publiée pendant la navigation (morceau de code introuvable),
 *    réessayer ne sert à rien, c'est « Recharger » qu'il faut proposer.
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, Copy, Home, RefreshCw, Check } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@yamba.app";

/** Un morceau de code introuvable = une version publiée pendant la navigation, pas un bug. */
function isOutdatedBuild(error: Error): boolean {
  return /ChunkLoadError|Loading chunk|dynamically imported module/i.test(`${error.name} ${error.message}`);
}

export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors.boundary");
  const pathname = usePathname();
  const [reference, setReference] = useState<string>(error.digest ?? "");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const eventId = Sentry.captureException(error);
    if (eventId) setReference(eventId.slice(0, 8));
  }, [error]);

  const outdated = isOutdatedBuild(error);
  // Le tunnel de réservation : la seule question du membre est « ai-je été débité ? ».
  const inBooking = /\/(book|bookings)(\/|$)/.test(pathname ?? "");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers indisponible : la référence reste lisible à l'écran */
    }
  };

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-4 py-16" role="alert" aria-live="assertive">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#FF9900]/15 text-[#B45309] dark:text-[#FFAE33]">
        <AlertTriangle size={24} aria-hidden />
      </div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t("title")}</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-slate-600 dark:text-slate-400">
        {outdated ? t("outdated") : t("message")}
      </p>
      {inBooking && !outdated && (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
          {t("booking")}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => (outdated ? window.location.reload() : reset())}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#FF9900] px-5 py-2.5 text-[13px] font-bold text-slate-950 transition-colors hover:bg-[#F08700]"
        >
          <RefreshCw size={14} aria-hidden />
          {outdated ? t("reload") : t("retry")}
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-[13px] font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        >
          <Home size={14} aria-hidden />
          {t("home")}
        </Link>
      </div>

      {reference && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-slate-500">{t("referenceLabel")}</div>
              <code className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">{reference}</code>
            </div>
            <button type="button" onClick={copy} aria-label={t("referenceLabel")} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[12px] dark:border-slate-700 dark:bg-slate-950">
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? t("copied") : t("referenceLabel")}
            </button>
          </div>
          <p className="mt-1 text-[11.5px] text-slate-500">
            {t("referenceHelp")}{" "}
            <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Incident ${reference}`)}`} className="underline underline-offset-2">
              {t("support")}
            </a>
          </p>
        </div>
      )}
    </main>
  );
}
