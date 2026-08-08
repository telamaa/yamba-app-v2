/**
 * useNotifications.ts — la boîte côté client (PR5, Lot 3)
 * ========================================================
 * Cache PARTAGÉ header/section : même queryKey → la cloche
 * et la liste voient le même état ; marquer lu invalide les
 * deux d'un coup. `enabled` : les surfaces publiques ne
 * déclenchent jamais l'appel authentifié.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMyNotifications,
  markNotificationRead,
} from "@/components/dashboard/notifications/notifications.api";

export const NOTIFICATIONS_QUERY_KEY = ["me", "notifications"] as const;

export function useNotifications(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: getMyNotifications,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
}
