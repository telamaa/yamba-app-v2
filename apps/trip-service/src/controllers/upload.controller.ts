import type { Response, NextFunction } from "express";
import imagekit from "../lib/imagekit";
import { ValidationError } from "@packages/error-handler";
import { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";

// GET /uploads/imagekit-auth
export const getImageKitAuthParams = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new ValidationError("Unauthorized"));

    // Let ImageKit SDK use its default expire (30 min from now).
    // Do NOT pass a relative duration — it expects an absolute Unix timestamp.
    const authenticationParameters = imagekit.getAuthenticationParameters();

    return res.status(200).json({
      success: true,
      ...authenticationParameters,
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
    });
  } catch (error) {
    return next(error);
  }
};

// DELETE /uploads/imagekit/:fileId
export const deleteImageKitFile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new ValidationError("Unauthorized"));

    const { fileId } = req.params;
    if (!fileId) return next(new ValidationError("fileId is required"));

    await imagekit.deleteFile(fileId);

    return res.status(200).json({
      success: true,
      message: "File deleted from ImageKit.",
    });
  } catch (error: any) {
    if (error?.message?.includes("does not exist")) {
      return res.status(200).json({
        success: true,
        message: "File was already deleted.",
      });
    }
    return next(error);
  }
};
