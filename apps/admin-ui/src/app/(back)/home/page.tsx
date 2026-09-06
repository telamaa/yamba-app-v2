import HomeKpis from "@/components/HomeKpis";

export default function HomePage() {
  return (
    <>
      <h1 className="text-xl font-bold">Accueil</h1>
      <p className="mt-1 text-[13px] text-slate-500">Ce qui attend une action, selon ton profil. Les chiffres de fond se lisent dans Pilotage, l'argent dans Finances.</p>
      <HomeKpis />
    </>
  );
}
