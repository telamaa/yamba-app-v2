import AuditTable from "@/components/AuditTable";
import PageAccess from "@/components/PageAccess";

export default function AuditPage() {
  return (
    // Décision du 15/09 : un profil sans la permission lit un seul refus, sans consigne ni section.
    <PageAccess title="Journal des actions admin">
      <h1 className="text-xl font-bold">Journal des actions admin</h1>
      <p className="mt-1 text-[13px] text-slate-500">Qui a fait quoi, sur quoi, quand. Écrit dans la même transaction que chaque geste.</p>
      <AuditTable />
    </PageAccess>
  );
}
