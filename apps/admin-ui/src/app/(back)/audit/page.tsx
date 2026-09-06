import AuditTable from "@/components/AuditTable";

export default function AuditPage() {
  return (
    <>
      <h1 className="text-xl font-bold">Journal des actions admin</h1>
      <p className="mt-1 text-[13px] text-slate-500">Qui a fait quoi, sur quoi, quand. Écrit dans la même transaction que chaque geste.</p>
      <AuditTable />
    </>
  );
}
