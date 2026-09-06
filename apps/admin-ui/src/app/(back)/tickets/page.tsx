import TicketsQueue from "@/components/TicketsQueue";

export default function TicketsPage() {
  return (
    <>
      <h1 className="text-xl font-bold">Billets à vérifier</h1>
      <p className="mt-1 text-[13px] text-slate-500">Trajets à venir seulement, les plus anciens d'abord. Ouvrir un billet est journalisé. Compare les dates, les villes et le nom.</p>
      <TicketsQueue />
    </>
  );
}
