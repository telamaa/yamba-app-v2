import TicketsQueue from "@/components/TicketsQueue";
import PageAccess from "@/components/PageAccess";

export default function TicketsPage() {
  return (
    // Décision du 15/09 : un profil sans la permission lit un seul refus, sans consigne ni section.
    <PageAccess title="Billets à vérifier">
      <h1 className="text-xl font-bold">Billets à vérifier</h1>
      <p className="mt-1 text-[13px] text-slate-500">Trajets à venir seulement, les plus anciens d'abord. Ouvrir un billet est journalisé. Compare les dates, les villes et le nom.</p>
      <TicketsQueue />
    </PageAccess>
  );
}
