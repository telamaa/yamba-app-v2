/**
 * member-profile.schema.ts — le profil que le membre tient lui-même (D67, chantier E)
 * ===================================================================================
 */
import { z } from "zod";

export const PROFILE_NAME_MIN = 2;
export const PROFILE_NAME_MAX = 40;
export const PROFILE_BIO_MAX = 300;
export const PROFILE_MIN_AGE_YEARS = 16;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export const UpdateMyProfileRequestSchema = z
  .object({
    firstName: z.string().trim().min(PROFILE_NAME_MIN).max(PROFILE_NAME_MAX).optional(),
    lastName: z.string().trim().min(PROFILE_NAME_MIN).max(PROFILE_NAME_MAX).optional(),
    /** Nom d'affichage du Voyageur (CarrierPage.name) — seulement si la page Voyageur existe */
    displayName: z.string().trim().min(PROFILE_NAME_MIN).max(PROFILE_NAME_MAX).optional(),
    bio: z.string().trim().max(PROFILE_BIO_MAX).nullable().optional(),
    /** ISO date (YYYY-MM-DD), passée, 16 ans au moins ; null pour effacer */
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    profilePublic: z.boolean().optional(),
    showCity: z.boolean().optional(),
  })
  .meta({ id: "UpdateMyProfileRequest", description: "Member-editable profile (D67 1A); the public slug never changes" });
export type UpdateMyProfileRequest = z.infer<typeof UpdateMyProfileRequestSchema>;

export const SetMyAvatarRequestSchema = z
  .object({ fileId: z.string().min(1).max(128), url: z.string().url().max(1024) })
  .meta({ id: "SetMyAvatarRequest", description: "After a signed ImageKit upload (folder /avatars); the URL must belong to IMAGEKIT_URL_ENDPOINT (D42)" });
export type SetMyAvatarRequest = z.infer<typeof SetMyAvatarRequestSchema>;

export const MyProfileResponseSchema = z
  .object({
    firstName: z.string(),
    lastName: z.string(),
    publicSlug: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    birthDate: z.string().nullable(),
    profilePublic: z.boolean(),
    showCity: z.boolean(),
    carrier: z.object({ displayName: z.string(), bio: z.string().nullable() }).nullable(),
  })
  .meta({ id: "MyProfileResponse" });
export type MyProfileResponse = z.infer<typeof MyProfileResponseSchema>;
