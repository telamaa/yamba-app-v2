import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

export type CarrierPage = {
  id: string;
  name: string;
  bio?: string | null;
  phoneE164?: string | null;
  onboardingStep: "PROFILE" | "STRIPE" | "COMPLETE";
  stripeAccountId?: string | null;
  stripeOnboardingComplete?: boolean;
  stripeChargesEnabled?: boolean;
  primaryAddress?: {
    formattedAddress?: string | null;
    placeId?: string | null;
    lat?: number | null;
    lng?: number | null;
    streetLine1?: string | null;
    city?: string | null;
    region?: string | null;
    postalCode?: string | null;
    country?: string | null;
    countryCode?: string | null;
  } | null;
};

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  phoneE164?: string | null;
  gender?: string;
  birthDate?: string | null;
  roles: string[];
  carrierStatus?: string;
  carrierPage?: CarrierPage | null;
  avatar?: { url: string } | null;
};

type GetMeResponse = {
  success: boolean;
  user: User;
  roles?: string[];
};

const fetchUser = async (): Promise<User> => {
  const response = await apiClient.get<GetMeResponse>("/auth/me", {
    requireAuth: true,
  });

  return response.data.user;
};

/**
 * Hook centralisé pour l'utilisateur connecté.
 *
 * Stratégie de cache :
 *  - Un seul fetch /auth/me par session (pas de refetch automatique)
 *  - Cache valide 5 minutes (les données user changent rarement)
 *  - Cache mort gardé 10 minutes pour éviter les refetch lors des re-mount
 *  - Pas de retry sur erreur (un 401 = "non connecté", c'est définitif jusqu'au login)
 *
 * Pour invalider après un login/logout/profile update :
 *   queryClient.invalidateQueries({ queryKey: ["user"] })
 *
 * Pour forcer un refetch manuel :
 *   const { refetch } = useUser();
 *   await refetch();
 */
const useUser = () => {
  const {
    data: user,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["user"],
    queryFn: fetchUser,
    // Données stables pendant 5 minutes
    staleTime: 1000 * 60 * 5,
    // Garde le cache mort pendant 10 minutes (évite refetch au re-mount des composants)
    gcTime: 1000 * 60 * 10,
    // Pas de retry : un 401 signifie "non connecté", pas une erreur transitoire
    retry: false,
    // Pas de refetch quand un nouveau composant utilisant useUser se mount
    refetchOnMount: false,
    // Pas de refetch quand l'utilisateur revient sur l'onglet
    refetchOnWindowFocus: false,
    // Pas de refetch après une perte/reprise de connexion réseau
    refetchOnReconnect: false,
  });

  return { user, isLoading, isError, refetch };
};

export default useUser;
