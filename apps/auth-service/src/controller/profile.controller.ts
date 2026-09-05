/**
 * profile.controller.ts — le profil que le membre tient lui-même (D67)
 * ====================================================================
 * GET /auth/me/profile · PATCH /auth/me/profile · POST /auth/me/avatar · DELETE /auth/me/avatar
 */
import type { NextFunction, Response } from "express";
import prisma from "@packages/libs/prisma";
import { SetMyAvatarRequestSchema, UpdateMyProfileRequestSchema, type MyProfileResponse } from "@packages/api-contracts";
import { AuthError, ValidationError } from "@packages/error-handler";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { deleteImageKitFile } from "@packages/libs/imagekit";
import { isImageKitUrl, normalizeProfileUpdate } from "../utils/profile.rules";

function zodErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[i.path.map(String).join(".") || "_"] = i.message;
  return errors;
}

async function buildProfile(userId: string): Promise<MyProfileResponse> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { firstName: true, lastName: true, publicSlug: true, birthDate: true, profilePublic: true, showCity: true, avatar: { select: { url: true } }, carrierPage: { select: { name: true, bio: true } } } });
  return { firstName: u.firstName, lastName: u.lastName, publicSlug: u.publicSlug, avatarUrl: u.avatar?.url ?? null, birthDate: u.birthDate ? u.birthDate.toISOString().slice(0, 10) : null, profilePublic: u.profilePublic, showCity: u.showCity, carrier: u.carrierPage ? { displayName: u.carrierPage.name, bio: u.carrierPage.bio } : null };
}

export const getMyProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AuthError("Unauthorized"));
    return res.status(200).json(await buildProfile(req.user.id));
  } catch (e) {
    return next(e);
  }
};

export const updateMyProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AuthError("Unauthorized"));
    const parsed = UpdateMyProfileRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    const page = await prisma.carrierPage.findUnique({ where: { userId: req.user.id }, select: { id: true } });
    const { errors, user, carrier } = normalizeProfileUpdate(parsed.data, { hasCarrierPage: !!page });
    if (Object.keys(errors).length) throw new ValidationError("Some fields are invalid.", { errors });
    if (Object.keys(user).length === 0 && Object.keys(carrier).length === 0) throw new ValidationError("Nothing to update.");
    await prisma.$transaction(async (tx) => {
      if (Object.keys(user).length) await tx.user.update({ where: { id: req.user.id }, data: user });
      if (page && Object.keys(carrier).length) await tx.carrierPage.update({ where: { id: page.id }, data: carrier });
    });
    return res.status(200).json(await buildProfile(req.user.id));
  } catch (e) {
    return next(e);
  }
};

export const setMyAvatar = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AuthError("Unauthorized"));
    const parsed = SetMyAvatarRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    if (!isImageKitUrl(parsed.data.url, process.env.IMAGEKIT_URL_ENDPOINT)) throw new ValidationError("The avatar URL must belong to Yamba's media endpoint.", { errors: { url: "NOT_OUR_ENDPOINT" } });
    const previous = await prisma.image.findUnique({ where: { userId: req.user.id }, select: { id: true, fileId: true } });
    if (previous) await prisma.image.update({ where: { id: previous.id }, data: { fileId: parsed.data.fileId, url: parsed.data.url } });
    else await prisma.image.create({ data: { userId: req.user.id, fileId: parsed.data.fileId, url: parsed.data.url } });
    if (previous && previous.fileId !== parsed.data.fileId) await deleteImageKitFile(previous.fileId).catch(() => undefined); // l'ancien fichier ne traîne pas
    return res.status(200).json(await buildProfile(req.user.id));
  } catch (e) {
    return next(e);
  }
};

export const deleteMyAvatar = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AuthError("Unauthorized"));
    const previous = await prisma.image.findUnique({ where: { userId: req.user.id }, select: { id: true, fileId: true } });
    if (previous) {
      await prisma.image.delete({ where: { id: previous.id } });
      await deleteImageKitFile(previous.fileId).catch(() => undefined);
    }
    return res.status(200).json(await buildProfile(req.user.id));
  } catch (e) {
    return next(e);
  }
};
