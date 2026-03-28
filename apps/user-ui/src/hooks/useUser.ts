import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { AxiosError } from "axios";

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
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
