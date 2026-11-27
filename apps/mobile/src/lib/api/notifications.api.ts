/**
 * notifications.api.ts — la boîte aux lettres, côté réseau (D119).
 * ==================================================================
 * Trois routes servies par `notification-service` (PR4bis), derrière le
 * gateway. Ces fonctions ne PROJETTENT rien : `lib/boite.ts` lit le corps.
 *
 * Aucune n'est bruyante : une boîte qu'on n'arrive pas à lire se dit à
 * l'écran (D117), et un « marquer lu » qui échoue ne vaut pas d'interrompre
 * une lecture — le pire qu'il arrive est une pastille qui reste.
 */
import { apiFetch } from '@/lib/api/client';

/** Mes notifications, les plus récentes d'abord, avec le compte non lu. */
export function mesNotifications(): Promise<unknown> {
  return apiFetch<unknown>('/me/notifications');
}

/** J'ai lu CELLE-CI. Le serveur pose la date ; l'app ne la fabrique pas. */
export function marquerUneLue(notificationId: string): Promise<unknown> {
  return apiFetch<unknown>(`/me/notifications/${notificationId}/read`, { method: 'PATCH' });
}

/**
 * J'ai tout lu. Geste EXPLICITE (D119 4A) : ouvrir la boîte ne marque
 * rien — une liste parcourue des yeux n'a pas été lue, et vider la
 * pastille à l'ouverture ferait perdre ce qu'on n'a pas eu le temps de voir.
 */
export function marquerToutLu(): Promise<unknown> {
  return apiFetch<unknown>('/me/notifications/read-all', { method: 'PATCH' });
}
