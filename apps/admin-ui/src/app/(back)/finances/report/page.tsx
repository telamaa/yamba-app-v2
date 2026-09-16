import FinanceReportView from "@/components/FinanceReportView";
import PageAccess from "@/components/PageAccess";

export default function FinanceReportPage() {
  return (
    // Décision du 15/09 : un profil sans la permission lit un seul refus, sans consigne ni section.
    <PageAccess title="Rapport mensuel">
      <h1 className="text-xl font-bold">Rapport mensuel</h1>
      <p className="mt-1 text-[13px] text-slate-500">Par mois (UTC) et par devise, depuis les deals : encaissé, remboursé, versé, revenu reconnu (commission + prime des deals terminés), retenues. Les frais Stripe ne sont pas en base : le comptable rapproche avec l'export Stripe.</p>
      <FinanceReportView />
    </PageAccess>
  );
}
