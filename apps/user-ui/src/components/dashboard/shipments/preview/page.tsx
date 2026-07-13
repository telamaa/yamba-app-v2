import { setRequestLocale } from "next-intl/server";
import { FlaskConical } from "lucide-react";
import ShipmentsClient from "@/components/dashboard/shipments/ShipmentsClient";

type Props = { params: Promise<{ locale: string }> };

/**
 * PAGE PREVIEW — mock, non liée dans la navigation.
 * Vitrine de tous les cas de figure Expéditeur : code à transmettre,
 * vérification J+4, notation, attente 24h, accepté, transit, litige,
 * terminé, expiré. Cible visuelle du branchement GET /me/bookings.
 * URL : /fr/dashboard/shipments/preview
 */
export default async function ShipmentsPreviewPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 text-[12px] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        <FlaskConical size={14} className="flex-shrink-0" />
        <span>
          {locale === "fr"
            ? "PREVIEW · données mock · vitrine des états Expéditeur — non liée dans la navigation"
            : "PREVIEW · mock data · Shipper states showcase — not linked in navigation"}
        </span>
      </div>
      <ShipmentsClient source="preview" />
    </div>
  );
}
