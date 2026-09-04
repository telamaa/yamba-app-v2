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
import { requireAdminPermission } from "@packages/middleware/requireAdminRole";
import { makeAdminUsersController } from "../controller/admin-users.controller";
import { makeAdminUsersService } from "../services/admin-users.service";
import { acceptAdminInvite, inviteAdmin, listAdmins, revokeAdmin, updateAdminRole } from "../controller/admin-admins.controller";
import { getAdminKpis } from "../controller/admin-kpis.controller";
import { getPilotageCorridors, getPilotageSeries } from "../controller/admin-pilotage.controller";
import {
  adminLogin,
  adminLogout,
  adminRefresh,
  adminTotpEnable,
  adminTotpSetup,
  adminTotpVerify,
  getAdminMe,
  listAdminAudit,
  listAdminSessions,
  revokeAdminSessionById,
} from "../controller/admin-auth.controller";

const router = Router();

router.post("/auth/admin/login", adminLogin);
router.post("/auth/admin/totp/setup", adminTotpSetup);
router.post("/auth/admin/totp/enable", adminTotpEnable);
router.post("/auth/admin/totp/verify", adminTotpVerify);
router.post("/auth/admin/refresh", adminRefresh);
router.post("/auth/admin/logout", adminLogout);

router.post("/auth/admin/invite/accept", acceptAdminInvite); // C-PR3 — jeton d'invitation (public)

router.get("/admin/me", isAdminAuthenticated, getAdminMe);
router.get("/admin/me/sessions", isAdminAuthenticated, listAdminSessions);
router.get("/admin/kpis", isAdminAuthenticated, requireAdminPermission("kpi.read"), getAdminKpis); // C-PR4 (D57)
router.get("/admin/pilotage/series", isAdminAuthenticated, requireAdminPermission("pilotage.read"), getPilotageSeries); // C-PR6a (D59)
router.get("/admin/pilotage/corridors", isAdminAuthenticated, requireAdminPermission("pilotage.read"), getPilotageCorridors);
router.delete("/admin/me/sessions/:jti", isAdminAuthenticated, revokeAdminSessionById);
router.get("/admin/audit", isAdminAuthenticated, requireAdminPermission("audit.read"), listAdminAudit);

// C-PR3 (D56) — comptes du back-office (SUPER_ADMIN)
router.get("/admin/admins", isAdminAuthenticated, requireAdminPermission("admins.manage"), listAdmins);
router.post("/admin/admins/invite", isAdminAuthenticated, requireAdminPermission("admins.manage"), inviteAdmin);
router.patch("/admin/admins/:id", isAdminAuthenticated, requireAdminPermission("admins.manage"), updateAdminRole);
router.delete("/admin/admins/:id", isAdminAuthenticated, requireAdminPermission("admins.manage"), revokeAdmin);

// C-PR3 (D56) — utilisateurs et suspension
const adminUsers = makeAdminUsersController(makeAdminUsersService());
router.get("/admin/users", isAdminAuthenticated, requireAdminPermission("users.read"), adminUsers.search);
router.get("/admin/users/:id", isAdminAuthenticated, requireAdminPermission("users.read"), adminUsers.getFile);
router.post("/admin/users/:id/suspension/propose", isAdminAuthenticated, requireAdminPermission("users.suspension.propose"), adminUsers.propose);
router.post("/admin/users/:id/suspension", isAdminAuthenticated, requireAdminPermission("users.suspension.apply"), adminUsers.apply);
router.delete("/admin/users/:id/suspension", isAdminAuthenticated, requireAdminPermission("users.suspension.apply"), adminUsers.lift);

export default router;
