"use client";

import axios, { AxiosError } from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:6001/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let isRefreshing = false;

let refreshQueue: Array<{
  resolve: () => void;
  reject: (error: unknown) => void;
}> = [];

const flushRefreshQueue = (error?: unknown) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve();
  });

  refreshQueue = [];
};

// ─────────────────────────────────────────────────────────────────────
// Circuit breaker pour les tentatives de refresh
//
// Sans ce mécanisme, quand l'utilisateur n'est pas connecté (ou que son
// refresh token est expiré), chaque requête vers une route `requireAuth`
// déclenche son propre cycle "401 → tentative de refresh → 401". Sur une
// page qui mount plusieurs composants utilisant `useUser` ou faisant des
// appels API authentifiés, cela peut générer des dizaines d'appels en
// quelques secondes.
//
// Le circuit breaker fonctionne ainsi :
//   - Quand un refresh échoue, on enregistre le timestamp de l'échec
//   - Pendant les 30 secondes suivantes, on rejette directement les 401
//     sur les requêtes `requireAuth` sans tenter de nouveau refresh
//   - Si un refresh réussit (utilisateur se reconnecte), on reset le breaker
//
// Cela permet à l'app de gérer proprement l'état "déconnecté" sans
// bombarder le serveur ni boucler dans les composants.
// ─────────────────────────────────────────────────────────────────────
let refreshFailedAt = 0;
const REFRESH_COOLDOWN_MS = 30_000;

const isInRefreshCooldown = () => {
  return Date.now() - refreshFailedAt < REFRESH_COOLDOWN_MS;
};

/**
 * Reset manuel du circuit breaker.
 * À appeler après un login réussi pour que les requêtes ultérieures
 * puissent à nouveau tenter un refresh si besoin.
 */
export const resetAuthRefreshCircuitBreaker = () => {
  refreshFailedAt = 0;
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const is401 = error.response?.status === 401;
    const isRetry = originalRequest._retry === true;
    const requireAuth = originalRequest.requireAuth === true;
    const skipAuthRefresh = originalRequest.skipAuthRefresh === true;

    const shouldTryRefresh =
      is401 && requireAuth && !isRetry && !skipAuthRefresh;

    if (!shouldTryRefresh) {
      return Promise.reject(error);
    }

    // Circuit breaker : si un refresh a échoué récemment, ne tente pas
    // un nouveau refresh. L'utilisateur est probablement déconnecté.
    if (isInRefreshCooldown()) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({
          resolve: () => resolve(apiClient(originalRequest)),
          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      await axios.post(
        "/auth/refresh",
        {},
        {
          baseURL: API_BASE_URL,
          withCredentials: true,
          skipAuthRefresh: true,
        }
      );

      // Refresh réussi : reset du circuit breaker
      refreshFailedAt = 0;
      flushRefreshQueue();
      return apiClient(originalRequest);
    } catch (refreshError) {
      // Refresh échoué : enclenchement du circuit breaker
      refreshFailedAt = Date.now();
      flushRefreshQueue(refreshError);
      // Pas de redirection ici — on laisse le composant gérer
      // (useUser retournera user: undefined, le header affichera "Connexion")
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default apiClient;
