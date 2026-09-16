import { Suspense } from "react";
import TripsList from "@/components/TripsList";
import PageAccess from "@/components/PageAccess";

export default function TripsPage() {
  return (
    // Décision du 15/09 : un profil sans la permission lit un seul refus, sans consigne ni section.
    <PageAccess title="Trajets">
      <h1 className="text-xl font-bold">Trajets</h1>
      <p className="mt-1 text-[13px] text-slate-500">Tous les trajets, filtrables. Masquer retire un trajet de la recherche sans l'annuler.</p>
      <Suspense fallback={null}>
        <TripsList />
      </Suspense>
    </PageAccess>
  );
}
