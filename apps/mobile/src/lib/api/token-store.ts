import * as SecureStore from 'expo-secure-store';

/**
 * Jetons de session (A201) : le refresh vit dans le Keychain / Keystore
 * (expo-secure-store), le jeton d'accès (15 min) SEULEMENT en mémoire —
 * il ne survit pas à l'app, c'est le refresh qui rouvre la session.
 */

const REFRESH_TOKEN_KEY = 'yamba.refresh_token';

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    // Stockage sécurisé indisponible (web, Keychain verrouillé) : session absente.
    return null;
  }
}

export async function setRefreshToken(token: string | null): Promise<void> {
  try {
    if (token === null) await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    else await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  } catch {
    // Échec d'écriture : la session ne survivra pas au redémarrage, sans casser l'app.
  }
}

export async function clearTokens(): Promise<void> {
  setAccessToken(null);
  await setRefreshToken(null);
}
