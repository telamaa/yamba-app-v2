/**
 * profile.controller.ts — le profil que le membre tient lui-même (D67)
 * ====================================================================
 * GET /auth/me/profile · PATCH /auth/me/profile · POST /auth/me/avatar · DELETE /auth/me/avatar
 *
 * A195 (passe concurrence MEMBRE, suite de A192) — ces trois écritures lisaient un document puis
 * l'écrivaient sans condition. Deux onglets, ou un double clic sur « Enregistrer » : le document lu
 * pouvait avoir disparu (P2025) ou être créé en double (P2002) entre les deux, et le membre lisait
 * un 500. Chaque écriture est désormais conditionnée à l'état LU et rejouée sur conflit d'écriture.
 */
import type { NextFunction, Response } from "express";
import prisma from "@packages/libs/prisma";
import { withWriteConflictRetry } from "@packages/libs/prisma/write-conflict-retry";
import { SetMyAvatarRequestSchema, UpdateMyProfileRequestSchema, type MyProfileResponse } from "@packages/api-contracts";
import { AuthError, ConflictError, ValidationError } from "@packages/error-handler";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { deleteImageKitFile } from "@packages/libs/imagekit";
import { isImageKitUrl, normalizeProfileUpdate } from "../utils/profile.rules";

function zodErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[i.path.map(String).join(".") || "_"] = i.message;
  return errors;
}

/** A195 — « le profil a changé pendant ce temps » : le front recharge et rejoue, il n'y a rien à deviner ici. */
const profilChange = () => new ConflictError("Your profile was changed by another action. Reload it.", { code: "PROFILE_STATE_CHANGED" });
const estCollisionUnique = (e: unknown): boolean => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

async function buildProfile(userId: string): Promise<MyProfileResponse> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { firstName: true, lastName: true, publicSlug: true, birthDate: true, profilePublic: true, showCity: true, avatar: { select: { url: true } }, carrierPage: { select: { name: true, bio: true } } } });
  return { firstName: u.firstName, lastName: u.lastName, publicSlug: u.publicSlug, avatarUrl: u.avatar?.url ?? null, birthDate: u.birthDate ? u.birthDate.toISOString().slice(0, 10) : null, profilePublic: u.profilePublic, showCity: u.showCity, carrier: u.carrierPage ? { displayName: u.carrierPage.name, bio: u.carrierPage.bio } : null };
}

export const getMyProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AuthError("Unauthorized", { code: "UNAUTHENTICATED" }));
    return res.status(200).json(await buildProfile(req.user.id));
  } catch (e) {
    return next(e);
  }
};

export const updateMyProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AuthError("Unauthorized", { code: "UNAUTHENTICATED" }));
    const parsed = UpdateMyProfileRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    const page = await prisma.carrierPage.findUnique({ where: { userId: req.user.id }, select: { id: true } });
    const { errors, user, carrier } = normalizeProfileUpdate(parsed.data, { hasCarrierPage: !!page });
    if (Object.keys(errors).length) throw new ValidationError("Some fields are invalid.", { errors });
    if (Object.keys(user).length === 0 && Object.keys(carrier).length === 0) throw new ValidationError("Nothing to update.", { code: "NOTHING_TO_UPDATE" });
    // A195 — `update` lève P2025 (→ 500) si le document a disparu : le compte effacé (RGPD, C-PR8b) pendant
    // la requête, ou la page Voyageur supprimée entre la lecture et l'écriture. `updateMany` ne lève pas :
    // il compte, et un compte à zéro est une réponse métier (409), pas une panne.
    await withWriteConflictRetry(() =>
      prisma.$transaction(async (tx) => {
        if (Object.keys(user).length) {
          const ecrit = await tx.user.updateMany({ where: { id: req.user.id, isDeleted: false }, data: user });
          if (ecrit.count !== 1) throw profilChange();
        }
        if (page && Object.keys(carrier).length) {
          const ecrit = await tx.carrierPage.updateMany({ where: { id: page.id }, data: carrier });
          if (ecrit.count !== 1) throw profilChange();
        }
      })
    );
    return res.status(200).json(await buildProfile(req.user.id));
  } catch (e) {
    return next(e);
  }
};

export const setMyAvatar = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AuthError("Unauthorized", { code: "UNAUTHENTICATED" }));
    const parsed = SetMyAvatarRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    if (!isImageKitUrl(parsed.data.url, process.env.IMAGEKIT_URL_ENDPOINT)) throw new ValidationError("The avatar URL must belong to Yamba's media endpoint.", { errors: { url: "NOT_OUR_ENDPOINT" } });
    // A195 — deux envois simultanés (double clic, ou téléphone + ordinateur) lisaient tous deux « pas d'avatar »
    // et créaient chacun le leur : `Image.userId` est UNIQUE, le second recevait un 500 alors que son image était
    // déjà sur ImageKit. L'écriture est conditionnée au fichier LU ; une collision dit seulement que l'autre est
    // passé en premier. Dans les deux cas : 409, le front recharge et montre l'avatar réellement en place.
    const remplace = await withWriteConflictRetry(async () => {
      const previous = await prisma.image.findUnique({ where: { userId: req.user.id }, select: { id: true, fileId: true } });
      if (previous) {
        const ecrit = await prisma.image.updateMany({ where: { id: previous.id, fileId: previous.fileId }, data: { fileId: parsed.data.fileId, url: parsed.data.url } });
        if (ecrit.count !== 1) throw profilChange();
        return previous;
      }
      try {
        await prisma.image.create({ data: { userId: req.user.id, fileId: parsed.data.fileId, url: parsed.data.url } });
      } catch (e) {
        if (!estCollisionUnique(e)) throw e;
        throw profilChange();
      }
      return null;
    });
    // L'ancien fichier ne traîne pas — et il n'est effacé que par celui qui l'a VRAIMENT remplacé.
    if (remplace && remplace.fileId !== parsed.data.fileId) await deleteImageKitFile(remplace.fileId).catch(() => undefined);
    return res.status(200).json(await buildProfile(req.user.id));
  } catch (e) {
    return next(e);
  }
};

export const deleteMyAvatar = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AuthError("Unauthorized", { code: "UNAUTHENTICATED" }));
    // A195 — supprimer deux fois de suite (double clic) : `delete` lève P2025 → 500 pour le second, alors que
    // l'avatar est bien parti. `deleteMany` compte ; seul celui qui a effacé la LIGNE efface le FICHIER, sinon
    // on supprimerait sur ImageKit l'image d'un avatar déjà remplacé entre-temps.
    const previous = await prisma.image.findUnique({ where: { userId: req.user.id }, select: { id: true, fileId: true } });
    if (previous) {
      const efface = await prisma.image.deleteMany({ where: { id: previous.id, fileId: previous.fileId } });
      if (efface.count === 1) await deleteImageKitFile(previous.fileId).catch(() => undefined);
    }
    return res.status(200).json(await buildProfile(req.user.id));
  } catch (e) {
    return next(e);
  }
};
