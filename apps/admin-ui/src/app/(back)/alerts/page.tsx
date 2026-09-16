import AlertsView from "@/components/AlertsView";
import PageAccess from "@/components/PageAccess";

/** A150 — les alertes de seuil ont leur page : l'accueil n'en garde qu'un résumé. */
export default function AlertsPage() {
  return (
    // Décision du 15/09 : un profil sans la permission lit un seul refus, sans consigne ni section.
    <PageAccess title="Alertes de seuil">
      <h1 className="text-xl font-bold">Alertes de seuil</h1>
      <p className="mt-1 text-[13px] text-slate-500">
        Neuf règles recalculées à chaque lecture, jamais stockées. Chaque alerte mène à l&apos;écran où agir. Les seuils sont des paramètres : les changer change l&apos;alerte, pas l&apos;historique.
      </p>
      <AlertsView />
    </PageAccess>
  );
}
