import { setRequestLocale } from "next-intl/server";
import { FlaskConical } from "lucide-react";
import NotificationsPreview from "@/components/dashboard/notifications/NotificationsPreview";

type Props = { params: Promise<{ locale: string }> };

/** PREVIEW mock, non liée dans la nav. Cible visuelle du chantier Stripe backend. */
export default async function FinancesPreviewPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 text-[12px] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        <FlaskConical size={14} className="flex-shrink-0" />
        <span>PREVIEW · mock · {locale === "fr" ? "non liée dans la navigation" : "not linked in navigation"}</span>
      </div>
      <NotificationsPreview />
    </div>
  );
}
