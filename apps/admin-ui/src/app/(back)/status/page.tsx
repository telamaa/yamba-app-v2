import StatusView from "@/components/StatusView";

export default function StatusPage() {
  return (
    <>
      <h1 className="text-xl font-bold">État des services</h1>
      <p className="mt-1 text-[13px] text-slate-500">Les six services, leurs dépendances, les crons et l&apos;outbox, relus toutes les 30 secondes tant que la page est ouverte. Ce n&apos;est pas un outil de supervision : Sentry garde les erreurs, et un moniteur externe reste nécessaire pour savoir que Yamba est tombé quand personne n&apos;a cette page ouverte.</p>
      <StatusView />
    </>
  );
}
