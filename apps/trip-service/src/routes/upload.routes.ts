import { Router } from "express";
import { getImageKitAuthParams, deleteImageKitFile } from "../controllers/upload.controller";
import isAuthenticated from "@packages/middleware/isAuthenticated";

const router = Router();

router.get("/imagekit-auth", isAuthenticated, getImageKitAuthParams);
router.delete("/imagekit/:fileId", isAuthenticated, deleteImageKitFile);

export default router;
