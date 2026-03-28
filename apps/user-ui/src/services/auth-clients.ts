"use client";

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const AUTH_CHANGED_EVENT = "yamba-auth-changed";

const canUseDOM = () => typeof window !== "undefined";

export function getAccessToken(): string | null {
  if (!canUseDOM()) return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (!canUseDOM()) return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function isAuthenticatedClient(): boolean {
  return !!getAccessToken();
}

function emitAuthChanged() {
  if (!canUseDOM()) return;
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT));
}

export function setAuthTokens(params: {
  accessToken: string;
  refreshToken?: string | null;
}) {
  if (!canUseDOM()) return;

  window.localStorage.setItem(ACCESS_TOKEN_KEY, params.accessToken);

  if (params.refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, params.refreshToken);
  } else {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  emitAuthChanged();
}

export function clearAuthTokens() {
  if (!canUseDOM()) return;

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);

  emitAuthChanged();
}

export function subscribeToAuthChanges(
  callback: (isAuthenticated: boolean) => void
) {
  if (!canUseDOM()) return () => {};

  const handleCustomEvent = () => {
    callback(isAuthenticatedClient());
  };

  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === ACCESS_TOKEN_KEY ||
      event.key === REFRESH_TOKEN_KEY ||
      event.key === null
    ) {
      callback(isAuthenticatedClient());
    }
  };

  window.addEventListener(AUTH_CHANGED_EVENT, handleCustomEvent);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, handleCustomEvent);
    window.removeEventListener("storage", handleStorage);
  };
}
