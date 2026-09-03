import QueueTable from "@/components/QueueTable";

export default function DisputesPage() {
  return (
    <>
      <h1 className="text-xl font-bold">À arbitrer</h1>
      <p className="mt-1 text-[13px] text-slate-500">Litiges ouverts et retenues en attente, les plus anciens d'abord. Lecture seule : les décisions arrivent avec C-PR2.</p>
      <QueueTable />
    </>
  );
}
