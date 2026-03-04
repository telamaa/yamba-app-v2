import Link from "next/link";
import TripSearchBar from "@/components/search/TripSearchBar";

export default function HomePage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-sky-700 to-cyan-500">
        <div className="mx-auto max-w-6xl px-4 py-14 md:py-20">
          <h1 className="max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-white md:text-6xl">
            Vous avez vos plans, on a vos bons plans.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/90 md:text-lg">
            Trouvez rapidement un trajet : départ, destination et date. (UI only pour l’instant)
          </p>
        </div>

        {/* petite séparation douce */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-white dark:to-slate-950" />
      </section>

      {/* SEARCH BAR */}
      <TripSearchBar />

      {/* CONTENT */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <h2 className="text-2xl font-semibold tracking-tight">Yamba</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            Base UI prête : header, thème, langue (UI), recherche trajet (UI), pages placeholder.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/auth/login"
              className="rounded-lg bg-slate-900 px-4 py-2 text-center text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              Se connecter
            </Link>
            <Link
              href="/auth/register"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-center hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
            >
              Créer un compte
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
