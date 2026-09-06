import FinanceReportView from "@/components/FinanceReportView";

export default function FinanceReportPage() {
  return (
    <>
      <h1 className="text-xl font-bold">Rapport mensuel</h1>
      <p className="mt-1 text-[13px] text-slate-500">Par mois (UTC) et par devise, depuis les deals : encaissé, remboursé, versé, revenu reconnu (commission + prime des deals terminés), retenues. Les frais Stripe ne sont pas en base : le comptable rapproche avec l'export Stripe.</p>
      <FinanceReportView />
    </>
  );
}
