import { useCallback, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import useUser from "@/hooks/useUser";

/**
 * Hook du bouton « Partager un trajet » (A60).
 *
 * - Non connecté → la porte d'identité s'ouvre EN MODALE (AuthGateModal) au-dessus
 *   de la page courante, message « partager un trajet », retour sur /trips/create.
 * - Connecté     → /trips/create (pas de gate onboarding : l'onboarding Yamber
 *   est requis à l'acceptation d'une première proposition, pas à la publication).
 * - Utilisateur inconnu (chargement) → /trips/create, la page tranche.
 */
const useShareTrip = () => {
  const router = useRouter();
  const { user, isLoading } = useUser();
  const [gateOpen, setGateOpen] = useState(false);

  const handleShareTrip = useCallback(() => {
    if (!user && !isLoading) {
      setGateOpen(true);
      return;
    }
    router.push("/trips/create");
  }, [user, isLoading, router]);

  const closeGate = useCallback(() => setGateOpen(false), []);

  return { handleShareTrip, isLoading, gateOpen, closeGate, shareRedirect: "/trips/create" };
};

export default useShareTrip;
