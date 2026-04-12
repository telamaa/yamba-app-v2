import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { AxiosError } from "axios";

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
      if (error instanceof AxiosError && error.response?.status === 401) {
        return false;
      }
      return failureCount < 1;
    },
  });

  return { user, isLoading, isError, refetch };
};

export default useUser;
