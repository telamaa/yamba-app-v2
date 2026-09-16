import UsersSearch from "@/components/UsersSearch";
import PageAccess from "@/components/PageAccess";

export default function UsersPage() {
  return (
    // Décision du 15/09 : un profil sans la permission lit un seul refus, sans consigne ni section.
    <PageAccess title="Utilisateurs">
      <h1 className="text-xl font-bold">Utilisateurs</h1>
      <p className="mt-1 text-[13px] text-slate-500">Recherche par email, prénom, nom, téléphone, identifiant de deal ou ticket YAM.</p>
      <UsersSearch />
    </PageAccess>
  );
}
