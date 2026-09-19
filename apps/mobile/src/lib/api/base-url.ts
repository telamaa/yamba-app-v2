import Constants from 'expo-constants';

/**
 * Base URL de l'API (gateway :8080).
 *
 * Priorité :
 * 1. `EXPO_PUBLIC_API_BASE_URL` (env Expo, ex. https://api.yamba.com/api en prod) ;
 * 2. en dev, l'IP du poste qui sert Metro (`hostUri`, ex. "192.168.1.23:8081") —
 *    le gateway tourne sur la même machine : le téléphone comme le simulateur
 *    Android (où localhost = l'émulateur lui-même) joignent la bonne adresse
 *    sans aucune configuration ;
 * 3. localhost, pour le simulateur iOS sans Metro (cas résiduel).
 */
export function apiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:8080/api`;

  return 'http://localhost:8080/api';
}
