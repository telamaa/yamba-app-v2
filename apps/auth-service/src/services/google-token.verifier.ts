/**
 * google-token.verifier.ts — vérification d'un id_token Google (D47)
 * Isolé pour que le service reste pur : ce fichier est le SEUL à parler à Google.
 * Sans GOOGLE_CLIENT_ID → `null` (le service répond 503 GOOGLE_NOT_CONFIGURED).
 */
import { OAuth2Client } from "google-auth-library";
import type { GoogleProfile, GoogleTokenVerifier } from "./google-auth.service";

export function buildGoogleTokenVerifier(): GoogleTokenVerifier | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return null;
  const client = new OAuth2Client(clientId);

  return async (idToken: string): Promise<GoogleProfile | null> => {
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: clientId });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) return null;
      return {
        sub: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified === true,
        firstName: payload.given_name?.trim() || payload.name?.split(" ")[0] || "Yamba",
        lastName: payload.family_name?.trim() || payload.name?.split(" ").slice(1).join(" ") || "",
        avatarUrl: payload.picture,
      };
    } catch (error) {
      console.warn("[google-auth] id_token rejected:", (error as Error).message);
      return null;
    }
  };
}
