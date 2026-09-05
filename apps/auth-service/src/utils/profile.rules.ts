/**
 * profile.rules.ts — règles pures du profil éditable (D67 1A/2A)
 * ==============================================================
 * Une erreur par champ (le front les affiche sous le champ), jamais d'exception.
 */
import { PROFILE_MIN_AGE_YEARS, type UpdateMyProfileRequest } from "@packages/api-contracts";

export type ProfileErrors = Partial<Record<keyof UpdateMyProfileRequest, string>>;

/** Nettoie un nom : espaces réduits, première lettre gardée telle quelle (les majuscules sont un choix). */
export const cleanName = (s: string) => s.trim().replace(/\s+/g, " ");

export function validateBirthDate(iso: string, now: Date = new Date()): string | null {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return "INVALID_DATE";
  if (d.getTime() > now.getTime()) return "IN_THE_FUTURE";
  const min = new Date(now); min.setUTCFullYear(min.getUTCFullYear() - PROFILE_MIN_AGE_YEARS);
  if (d.getTime() > min.getTime()) return "TOO_YOUNG";
  if (now.getUTCFullYear() - d.getUTCFullYear() > 120) return "INVALID_DATE";
  return null;
}

/** Valide et prépare l'écriture : `user` (User) et `carrier` (CarrierPage) séparés, erreurs par champ. */
export function normalizeProfileUpdate(input: UpdateMyProfileRequest, ctx: { hasCarrierPage: boolean; now?: Date }): { errors: ProfileErrors; user: Record<string, unknown>; carrier: Record<string, unknown> } {
  const errors: ProfileErrors = {};
  const user: Record<string, unknown> = {};
  const carrier: Record<string, unknown> = {};
  if (input.firstName !== undefined) user.firstName = cleanName(input.firstName);
  if (input.lastName !== undefined) user.lastName = cleanName(input.lastName);
  if (input.birthDate !== undefined) {
    if (input.birthDate === null) user.birthDate = null;
    else {
      const err = validateBirthDate(input.birthDate, ctx.now);
      if (err) errors.birthDate = err;
      else user.birthDate = new Date(`${input.birthDate}T00:00:00.000Z`);
    }
  }
  if (input.profilePublic !== undefined) user.profilePublic = input.profilePublic;
  if (input.showCity !== undefined) user.showCity = input.showCity;
  if (input.displayName !== undefined) {
    if (!ctx.hasCarrierPage) errors.displayName = "NO_CARRIER_PAGE";
    else carrier.name = cleanName(input.displayName);
  }
  if (input.bio !== undefined) {
    if (!ctx.hasCarrierPage) errors.bio = "NO_CARRIER_PAGE";
    else carrier.bio = input.bio === null || input.bio.trim() === "" ? null : input.bio.trim();
  }
  return { errors, user, carrier };
}

/** D42 — l'URL d'un fichier déclaré doit appartenir à notre compte ImageKit. */
export function isImageKitUrl(url: string, endpoint: string | undefined): boolean {
  if (!endpoint) return false;
  const base = endpoint.replace(/\/+$/, "");
  return url.startsWith(`${base}/`) && !url.includes("..");
}
