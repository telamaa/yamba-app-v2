import PilotageView from "@/components/PilotageView";

export default function PilotagePage() {
  return (
    <>
      <h1 className="text-xl font-bold">Pilotage</h1>
      <p className="mt-1 text-[13px] text-slate-500">Courbes et corridors calculés depuis les deals, les trajets et les comptes (rafraîchis toutes les 60 s). Les vues et les recherches viennent de la recherche publique. Chaque courbe s'agrandit : le tableau apparaît dessous, et un clic sur un point liste les éléments de la période. Les alertes de seuil arrivent avec C-PR6b.</p>
      <PilotageView />
    </>
  );
}
