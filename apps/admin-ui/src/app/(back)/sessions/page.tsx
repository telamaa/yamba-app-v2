import SessionsList from "@/components/SessionsList";

export default function SessionsPage() {
  return (
    <>
      <h1 className="text-xl font-bold">Mes sessions admin</h1>
      <p className="mt-1 text-[13px] text-slate-500">Une alerte email part à chaque ouverture de session. Révoque ce que tu ne reconnais pas.</p>
      <SessionsList />
    </>
  );
}
