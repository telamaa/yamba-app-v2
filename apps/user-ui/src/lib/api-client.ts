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

      flushRefreshQueue();
      return apiClient(originalRequest);
    } catch (refreshError) {
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
