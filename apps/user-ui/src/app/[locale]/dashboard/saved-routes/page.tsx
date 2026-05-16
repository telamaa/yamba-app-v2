import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Bell } from "lucide-react";
import SavedRoutesList from "@/components/saved-routes/SavedRoutesList";

type Params = {
  locale: string;
};

export async function generateMetadata({
                                         params,
                                       }: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "savedRoutes.page",
  });

  return {
    title: `${t("title")} — Yamba`,
  };
}

export default async function SavedRoutesPage({
                                                params,
                                              }: {
  params: Promise<Params>;
}) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "savedRoutes.page",
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-6 lg:py-8">
      {/* Header */}
      <header className="mb-6">
        <div className="mb-2 flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-orange-50 text-[#FF9900] dark:bg-orange-500/15">
            <Bell size={16} strokeWidth={2.2} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white lg:text-2xl">
            {t("title")}
          </h1>
        </div>
        <p className="ml-12 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {t("description")}
        </p>
      </header>

      {/* Liste */}
      <SavedRoutesList />
    </div>
  );
}
