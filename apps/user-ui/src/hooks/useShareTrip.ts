import { useCallback } from "react";
import { useRouter } from "next/navigation";
import useUser from "@/hooks/useUser";

/**
 * Hook qui gère le flow du bouton "Partager un trajet".
 *
 * Flow progressif :
 * - Non connecté → /login?redirect=/trips/create
 * - Connecté     → /trips/create (pas de gate onboarding)
 *
 * L'onboarding carrier (profil + Stripe) sera requis plus tard,
 * au moment d'accepter une première proposition d'affaire.
 */
const useShareTrip = () => {
  const router = useRouter();
  const { user, isLoading } = useUser();

  const handleShareTrip = useCallback(() => {
    if (!user) {
      router.push("/login?redirect=/trips/create");
      return;
    }

    router.push("/trips/create");
  }, [user, router]);

  return { handleShareTrip, isLoading };
};

export default useShareTrip;
