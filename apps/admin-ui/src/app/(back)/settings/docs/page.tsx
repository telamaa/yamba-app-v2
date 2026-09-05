import Link from "next/link";
import SettingsDocumentation from "@/components/SettingsDocumentation";

export default function SettingsDocsPage() {
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold">Documentation des paramètres</h1>
        <Link href="/settings" className="text-[13px] font-medium text-slate-700 underline">← Retour aux paramètres</Link>
      </div>
      <p className="mt-1 text-[13px] text-slate-500">Le même texte que les info-bulles, à une seule source (le catalogue). Trois classes : réglable en ligne, modifiable par déploiement, prévue mais pas encore lue par le code.</p>
      <SettingsDocumentation />
    </>
  );
}
