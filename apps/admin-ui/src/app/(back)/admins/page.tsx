import AdminsManager from "@/components/AdminsManager";
import PageAccess from "@/components/PageAccess";

export default function AdminsPage() {
  return (
    // Décision du 15/09 : un profil sans la permission lit un seul refus, sans consigne ni section.
    <PageAccess title="Comptes admin">
      <h1 className="text-xl font-bold">Comptes admin</h1>
      <p className="mt-1 text-[13px] text-slate-500">Super administrateur seulement. Un compte invité naît sans rôle client et définit son mot de passe par le lien reçu (48 h).</p>
      <AdminsManager />
    </PageAccess>
  );
}
