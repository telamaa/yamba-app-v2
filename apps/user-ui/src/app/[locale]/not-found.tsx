/**
 * not-found.tsx — la page introuvable du site
 * ============================================
 * Un membre qui atterrit ici n'a pas besoin d'un lien « accueil » : il cherchait
 * quelque chose. On propose les deux gestes du produit — chercher un trajet, en
 * publier un — et on nomme les causes fréquentes (trajet supprimé, profil masqué)
 * pour qu'il comprenne que le lien n'est pas cassé de son fait.
 */
import { getTranslations } from "next-intl/server";
import { Compass, PlusCircle, SearchX } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default async function LocaleNotFound() {
  const t = await getTranslations("errors.notFound");
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-4 py-16">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <SearchX size={24} aria-hidden />
      </div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t("title")}</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-slate-600 dark:text-slate-400">{t("message")}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/search" className="inline-flex items-center gap-1.5 rounded-full bg-[#FF9900] px-5 py-2.5 text-[13px] font-bold text-slate-950 transition-colors hover:bg-[#F08700]">
          <Compass size={14} aria-hidden />
          {t("search")}
        </Link>
        <Link href="/trips/create" className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-[13px] font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
          <PlusCircle size={14} aria-hidden />
          {t("publish")}
        </Link>
        <Link href="/" className="inline-flex items-center px-2 py-2.5 text-[13px] font-medium text-slate-500 underline-offset-4 hover:underline dark:text-slate-400">
          {t("home")}
        </Link>
      </div>
    </main>
  );
}
