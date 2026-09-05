import Link from "next/link";
import PlatformSettingsEditor from "@/components/PlatformSettingsEditor";

export default function SettingsPage() {
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold">Paramètres de la plateforme</h1>
        <Link href="/settings/docs" className="text-[13px] font-medium text-slate-700 underline">Documentation des paramètres</Link>
      </div>
      <p className="mt-1 text-[13px] text-slate-500">
        Les curseurs métier (commission, planchers, fenêtres) se règlent par le super administrateur, ceux d&apos;exploitation (seuils d&apos;alerte, relances) par le profil Exploitation. Chaque modification exige un motif, s&apos;écrit au journal clé par clé et est annoncée par email à tous les super administrateurs. Rien n&apos;est rétroactif : une réservation garde le prix figé à sa création.
      </p>
      <PlatformSettingsEditor />
    </>
  );
}
