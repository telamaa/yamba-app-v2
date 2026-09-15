import DataRequestsList from "@/components/DataRequestsList";
import PageAccess from "@/components/PageAccess";

export default function PrivacyPage() {
  return (
    // Décision du 15/09 : un profil sans la permission lit un seul refus, sans consigne ni section.
    <PageAccess title="Données personnelles">
      <h1 className="text-xl font-bold">Données personnelles</h1>
      <p className="mt-1 text-[13px] text-slate-500">Le registre des demandes (export, effacement) : la preuve du délai légal d&apos;un mois. Un effacement à la demande d&apos;un membre se fait depuis sa fiche (« Effacer ce compte »). Cette consultation est journalisée.</p>
      <DataRequestsList />
    </PageAccess>
  );
}
