import MessageReportsQueue from "@/components/MessageReportsQueue";

export default function ReportsPage() {
  return (
    <>
      <h1 className="text-xl font-bold">Messages signalés</h1>
      <p className="mt-1 text-[13px] text-slate-500">Les plus anciens d&apos;abord. Lis la conversation avant de décider (lecture journalisée). « Traité » quand tu as agi, « Sans suite » quand rien n&apos;est à faire ; ta note part au journal.</p>
      <MessageReportsQueue />
    </>
  );
}
