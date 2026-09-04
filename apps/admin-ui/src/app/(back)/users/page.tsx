import UsersSearch from "@/components/UsersSearch";

export default function UsersPage() {
  return (
    <>
      <h1 className="text-xl font-bold">Utilisateurs</h1>
      <p className="mt-1 text-[13px] text-slate-500">Recherche par email, prénom, nom, téléphone, identifiant de deal ou ticket YAM.</p>
      <UsersSearch />
    </>
  );
}
