import QueueTable from "@/components/QueueTable";

export default function DisputesPage() {
  return (
    <>
      <h1 className="text-xl font-bold">À arbitrer</h1>
      <p className="mt-1 text-[13px] text-slate-500">Litiges ouverts et retenues en attente, les plus anciens d'abord. Un litige se tranche dès la version du Voyageur reçue, ou 72 h après l'ouverture.</p>
      <QueueTable />
    </>
  );
}
