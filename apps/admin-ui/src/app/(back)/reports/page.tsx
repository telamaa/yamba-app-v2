import MessageReportsQueue from "@/components/MessageReportsQueue";
import ReportsQueue from "@/components/ReportsQueue";

/** D68 3A — deux files : trajets et membres (auth-service), messages (message-service). */
export default function ReportsPage() {
  return (
    <>
      <h1 className="text-xl font-bold">Signalements</h1>
      <p className="mt-1 text-[13px] text-slate-500">
        Les plus anciens d&apos;abord. Un signalement ne sanctionne rien tout seul : ouvre la cible, masque le trajet ou propose une sanction si c&apos;est justifié, puis reviens marquer « Traité ». « Sans suite » quand rien n&apos;est à faire ; ta note part au journal. L&apos;auteur n&apos;est jamais révélé à la cible.
      </p>
      <h2 className="mt-6 text-base font-semibold">Trajets et membres</h2>
      <ReportsQueue />
      <h2 id="messages" className="mt-10 text-base font-semibold">Messages</h2>
      <p className="mt-1 text-[12.5px] text-slate-500">Lis la conversation avant de décider (lecture journalisée).</p>
      <MessageReportsQueue />
    </>
  );
}
