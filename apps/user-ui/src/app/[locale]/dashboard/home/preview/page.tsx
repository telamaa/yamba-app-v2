import { setRequestLocale } from "next-intl/server";
import { FlaskConical } from "lucide-react";
import HomeClient from "@/components/dashboard/home/HomeClient";

type Props = { params: Promise<{ locale: string }> };

/**
 * PAGE PREVIEW — mock, non liée dans la navigation.
 * La home inbox pleine : feed unifié des actions des deux rôles
 * (chips 📦 Envoi / ✈️ Trajet), dérivé des mocks shipments + trips.
 * URL : /fr/dashboard/home/preview
 */
export default async function HomePreviewPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 text-[12px] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        <FlaskConical size={14} className="flex-shrink-0" />
        <span>
          {locale === "fr"
            ? "PREVIEW · données mock · home inbox pleine (2 rôles) — non liée dans la navigation"
            : "PREVIEW · mock data · full home inbox (both roles) — not linked in navigation"}
        </span>
      </div>
      <HomeClient source="preview" />
    </div>
  );
}
