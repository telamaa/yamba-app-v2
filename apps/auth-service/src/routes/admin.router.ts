/**
 * admin.router.ts — routes ADMIN de l'auth-service (D54)
 * ======================================================
 * /auth/admin/* : connexion en deux temps (pré-auth cookie), 2FA, refresh, logout.
 * /admin/*      : sous `isAdminAuthenticated` (cookie admin_access_token, amr totp).
 * Le gateway proxifie /api/auth/* et /api/admin/* vers ce service (catch-all),
 * sauf /api/admin/disputes → deal-service.
 */
import { Router } from "express";
import isAdminAuthenticated from "@packages/middleware/isAdminAuthenticated";
import {
  adminLogin,
  adminLogout,
  adminRefresh,
  adminTotpEnable,
  adminTotpSetup,
  adminTotpVerify,
  getAdminMe,
  listAdminAudit,
} from "../controller/admin-auth.controller";

const router = Router();

router.post("/auth/admin/login", adminLogin);
router.post("/auth/admin/totp/setup", adminTotpSetup);
router.post("/auth/admin/totp/enable", adminTotpEnable);
router.post("/auth/admin/totp/verify", adminTotpVerify);
router.post("/auth/admin/refresh", adminRefresh);
router.post("/auth/admin/logout", adminLogout);

router.get("/admin/me", isAdminAuthenticated, getAdminMe);
router.get("/admin/audit", isAdminAuthenticated, listAdminAudit);

export default router;
