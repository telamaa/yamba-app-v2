import { Suspense } from "react";
import QueueTable from "@/components/QueueTable";
import PageAccess from "@/components/PageAccess";

export default function DisputesPage() {
  return (
    // Décision du 15/09 : un profil sans la permission lit un seul refus, sans consigne ni section.
    <PageAccess title="À arbitrer">
      <h1 className="text-xl font-bold">À arbitrer</h1>
      <p className="mt-1 text-[13px] text-slate-500">Litiges ouverts et retenues en attente, les plus anciens d'abord. Un litige se tranche dès la version du Voyageur reçue, ou passé le délai de réponse (paramètre « Délai de réponse au litige », 72 h par défaut) ; la date exacte est affichée sur chaque dossier.</p>
      <Suspense fallback={null}>
        <QueueTable />
      </Suspense>
    </PageAccess>
  );
}
