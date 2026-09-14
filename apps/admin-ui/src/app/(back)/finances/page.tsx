import { Suspense } from "react";
import FinanceQueues from "@/components/FinanceQueues";

export default function FinancesPage() {
  return (
    <>
      <h1 className="text-xl font-bold">Finances</h1>
      <p className="mt-1 text-[13px] text-slate-500">Ce qui n'a pas suivi son cours : versements en échec, transferts renversés, retenues à arbitrer, remboursements proposés. Chaque montant vient du deal, rien n'est recalculé. Le rapport mensuel et son export s'ouvrent à droite des onglets.</p>
      <Suspense fallback={null}>
        <FinanceQueues />
      </Suspense>
    </>
  );
}
