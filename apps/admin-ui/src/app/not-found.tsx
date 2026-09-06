import Link from "next/link";

/** Page introuvable du back-office : l'opérateur repart de l'accueil, sans détour. */
export default function AdminNotFound() {
  return (
    <div className="mx-auto max-w-xl py-16">
      <h1 className="text-xl font-bold">Cet écran n&apos;existe pas</h1>
      <p className="mt-2 text-[13.5px] text-slate-600">
        L&apos;adresse est peut-être erronée, ou l&apos;écran demande une permission que ton profil n&apos;a pas — dans ce cas il n&apos;apparaît pas non plus dans le menu.
      </p>
      <Link href="/home" className="mt-5 inline-block rounded-lg bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white">Retour à l&apos;accueil</Link>
    </div>
  );
}
