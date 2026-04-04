import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { AxiosError } from "axios";

type OnboardingStep = "PROFILE" | "STRIPE" | "COMPLETE";
type CarrierStatus = "NONE" | "ONBOARDING" | "ACTIVE" | "SUSPENDED";

type CarrierPage = {
  id: string;
  name: string;
  bio?: string | null;
  phoneE164?: string | null;
  onboardingStep: OnboardingStep;
  stripeOnboardingComplete: boolean;
  stripeChargesEnabled: boolean;
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

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  carrierStatus: CarrierStatus;
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

const useUser = () => {
  const {
    data: user,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["user"],
    queryFn: fetchUser,
    staleTime: 1000 * 60 * 5,
    retry: (failureCount, error) => {
      // Ne pas retry sur 401 — l'utilisateur n'est simplement pas connecté
      if (error instanceof AxiosError && error.response?.status === 401) {
        return false;
      }
      // Pour les autres erreurs (réseau, 500…), retry 1 fois
      return failureCount < 1;
    },
  });

  return { user, isLoading, isError, refetch };
};

export default useUser;
