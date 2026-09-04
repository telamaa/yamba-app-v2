import AdminsManager from "@/components/AdminsManager";

export default function AdminsPage() {
  return (
    <>
      <h1 className="text-xl font-bold">Comptes admin</h1>
      <p className="mt-1 text-[13px] text-slate-500">Super administrateur seulement. Un compte invité naît sans rôle client et définit son mot de passe par le lien reçu (48 h).</p>
      <AdminsManager />
    </>
  );
}
