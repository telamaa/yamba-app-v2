import HomeKpis from "@/components/HomeKpis";

export default function HomePage() {
  return (
    <>
      <h1 className="text-xl font-bold">Accueil</h1>
      <p className="mt-1 text-[13px] text-slate-500">Ce qui attend une action, selon ton profil. Les courbes et les finances arrivent avec le pilotage (C-PR6).</p>
      <HomeKpis />
    </>
  );
}
