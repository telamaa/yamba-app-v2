import { setRequestLocale } from "next-intl/server";
import { FlaskConical } from "lucide-react";
import TripsClient from "@/components/dashboard/trips/TripsClient";

type Props = { params: Promise<{ locale: string }> };

/**
 * PAGE PREVIEW — mock, non liée dans la navigation.
 *
 * Vitrine de tous les cas de figure du module deals côté Voyageur :
 * bande "À traiter" (RESPOND / PICKUP / DELIVER / RATE), trip cards
 * (à venir avec demande + accepté, sans deal, en vol, atterri avec
 * litige), historique. C'est la cible visuelle du branchement backend
 * deals — la page réelle /dashboard/trips affichera cette structure
 * quand GET /me/trips?include=deals existera.
 *
 * URL : /fr/dashboard/trips/preview
 */
export default async function TripsPreviewPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 text-[12px] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        <FlaskConical size={14} className="flex-shrink-0" />
        <span>
          {locale === "fr"
            ? "PREVIEW · données mock · vitrine des cas de figure deals — non liée dans la navigation"
            : "PREVIEW · mock data · deals states showcase — not linked in navigation"}
        </span>
      </div>
      <TripsClient />
    </div>
  );
}
