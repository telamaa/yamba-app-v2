/**
 * notify-sign-in.ts — email « nouvelle connexion » (D78)
 * ======================================================
 * Prévient le membre qu'une connexion a eu lieu : quand, quel appareil, quelle IP, quelle
 * localisation approximative, et « si ce n'était pas toi… ». Appelé en fire-and-forget après
 * une connexion réussie (jamais sur le chemin de la réponse — aucune latence ajoutée).
 *
 * Mode (`LOGIN_ALERT_MODE`) :
 *  - `new-device` (DÉFAUT) : email seulement depuis un appareil non déjà vu parmi les sessions
 *    actives. C'est le standard (Google, Airbnb…) : prévenir sans fatiguer.
 *  - `every` : email à CHAQUE connexion (plus bruyant ; à réserver aux comptes sensibles).
 *  - `off` : aucun email.
 */
import redis from "@packages/libs/redis";
import { sendAuthEmail } from "../emails/send-auth-email";
import { getAuthEmails } from "../emails/auth-emails";
import { isDeviceKnown } from "./session-device";
import { resolveApproxLocation } from "./geoip";
import type { SessionRecord } from "./auth.helper";

export type LoginAlertMode = "new-device" | "every" | "off";

export function loginAlertMode(env: Record<string, string | undefined> = process.env): LoginAlertMode {
  const raw = env.LOGIN_ALERT_MODE?.trim().toLowerCase();
  return raw === "every" ? "every" : raw === "off" ? "off" : "new-device";
}

/** Les libellés d'appareil des AUTRES sessions actives du membre (hors la session courante). */
async function otherSessionDevices(userId: string, excludeJti: string | null): Promise<string[]> {
  const devices: string[] = [];
  let cursor = "0";
  do {
    const [next, ks] = await redis.scan(cursor, "MATCH", `refresh_jti:${userId}:*`, "COUNT", 100);
    cursor = next;
    if (ks.length === 0) continue;
    const vals = await redis.mget(...ks);
    ks.forEach((k, i) => {
      const jti = k.split(":").pop() ?? "";
      if (jti === excludeJti) return;
      const raw = vals[i];
      if (!raw || raw === "1") return;
      try {
        const rec = JSON.parse(raw) as SessionRecord;
        if (rec.device) devices.push(rec.device);
      } catch {
        /* enregistrement illisible : ignoré */
      }
    });
  } while (cursor !== "0");
  return devices;
}

export type NewSignInInput = {
  userId: string;
  email: string;
  firstName?: string;
  locale: string | null | undefined;
  device: string;
  ip: string | null;
  currentJti: string | null;
  when?: Date;
  env?: Record<string, string | undefined>;
};

/** Envoie l'email de nouvelle connexion si le mode et la nouveauté de l'appareil l'exigent. */
export async function notifyNewSignIn(input: NewSignInInput): Promise<void> {
  const env = input.env ?? process.env;
  const mode = loginAlertMode(env);
  if (mode === "off") return;

  if (mode === "new-device") {
    const known = await otherSessionDevices(input.userId, input.currentJti);
    if (isDeviceKnown(known, input.device)) return; // appareil déjà connu → pas d'email
  }

  const location = await resolveApproxLocation(input.ip, { env });
  const when = input.when ?? new Date();
  const fr = (input.locale ?? "fr").toString().toLowerCase().startsWith("fr");
  const whenText = when.toLocaleString(fr ? "fr-FR" : "en-GB", { dateStyle: "long", timeStyle: "short" });
  const manageUrl = env.USER_APP_URL ? `${env.USER_APP_URL}/${fr ? "fr" : "en"}/dashboard/security` : undefined;

  await sendAuthEmail(
    input.email,
    input.locale,
    getAuthEmails(input.locale).newSignIn({
      firstName: input.firstName,
      whenText,
      device: input.device,
      ip: input.ip,
      location,
      manageUrl,
      supportEmail: "support@yamba.com",
    })
  );
}
