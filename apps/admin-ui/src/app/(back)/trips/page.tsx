import { Suspense } from "react";
import TripsList from "@/components/TripsList";

export default function TripsPage() {
  return (
    <>
      <h1 className="text-xl font-bold">Trajets</h1>
      <p className="mt-1 text-[13px] text-slate-500">Tous les trajets, filtrables. Masquer retire un trajet de la recherche sans l'annuler.</p>
      <Suspense fallback={null}>
        <TripsList />
      </Suspense>
    </>
  );
}
