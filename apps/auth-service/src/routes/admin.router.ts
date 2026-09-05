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
import { getSettings, getSettingsHistory, resetSettings, updateSettings } from "../controller/admin-settings.controller"; // C-PR8a (D62)
import { adminEraseUser, listDataRequests } from "../controller/privacy.controller"; // C-PR8b (D63)
import { getMaintenance, getStatus, updateMaintenance } from "../controller/admin-status.controller"; // C-PR8c (D64)
import { getPilotageCorridors, getPilotageDrilldown, getPilotageSeries } from "../controller/admin-pilotage.controller";
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
router.get("/admin/pilotage/drilldown", isAdminAuthenticated, requireAdminPermission("pilotage.read"), getPilotageDrilldown); // C-PR6c (D60 3A)
router.delete("/admin/me/sessions/:jti", isAdminAuthenticated, revokeAdminSessionById);
router.get("/admin/audit", isAdminAuthenticated, requireAdminPermission("audit.read"), listAdminAudit);

// C-PR8a (D62) — paramètres : lecture pour tous les profils, écriture bornée par portée DANS le service (une requête peut mêler métier et exploitation).
router.get("/admin/settings", isAdminAuthenticated, requireAdminPermission("settings.read"), getSettings);
router.get("/admin/settings/history", isAdminAuthenticated, requireAdminPermission("settings.read"), getSettingsHistory);
router.patch("/admin/settings", isAdminAuthenticated, requireAdminPermission("settings.read"), updateSettings);
router.post("/admin/settings/reset", isAdminAuthenticated, requireAdminPermission("settings.read"), resetSettings);

// C-PR8c (D64) — état des services (tous les profils), maintenance (OPS ou SUPER_ADMIN)
router.get("/admin/status", isAdminAuthenticated, requireAdminPermission("status.read"), getStatus);
router.get("/admin/maintenance", isAdminAuthenticated, requireAdminPermission("status.read"), getMaintenance);
router.put("/admin/maintenance", isAdminAuthenticated, requireAdminPermission("maintenance.write"), updateMaintenance);

// C-PR3 (D56) — comptes du back-office (SUPER_ADMIN)
router.get("/admin/admins", isAdminAuthenticated, requireAdminPermission("admins.manage"), listAdmins);
router.post("/admin/admins/invite", isAdminAuthenticated, requireAdminPermission("admins.manage"), inviteAdmin);
router.patch("/admin/admins/:id", isAdminAuthenticated, requireAdminPermission("admins.manage"), updateAdminRole);
router.delete("/admin/admins/:id", isAdminAuthenticated, requireAdminPermission("admins.manage"), revokeAdmin);

// C-PR3 (D56) — utilisateurs et suspension
const adminUsers = makeAdminUsersController(makeAdminUsersService());
router.get("/admin/users", isAdminAuthenticated, requireAdminPermission("users.read"), adminUsers.search);
router.get("/admin/users/export", isAdminAuthenticated, requireAdminPermission("exports.personal"), adminUsers.exportCsv); // C-PR7a (D60 2A) — SUPER_ADMIN, motif, journal
router.get("/admin/users/:id", isAdminAuthenticated, requireAdminPermission("users.read"), adminUsers.getFile);
router.post("/admin/users/:id/suspension/propose", isAdminAuthenticated, requireAdminPermission("users.suspension.propose"), adminUsers.propose);
router.post("/admin/users/:id/suspension", isAdminAuthenticated, requireAdminPermission("users.suspension.apply"), adminUsers.apply);
router.delete("/admin/users/:id/suspension", isAdminAuthenticated, requireAdminPermission("users.suspension.apply"), adminUsers.lift);
router.delete("/admin/users/:id/email-suppression", isAdminAuthenticated, requireAdminPermission("users.email.unsuppress"), adminUsers.unsuppressEmail); // D35 4A
// C-PR8b (D63 6A) — données personnelles : effacement à la demande, registre des demandes
router.post("/admin/users/:id/erase", isAdminAuthenticated, requireAdminPermission("users.erase"), adminEraseUser);
router.get("/admin/privacy/requests", isAdminAuthenticated, requireAdminPermission("privacy.requests.read"), listDataRequests);

export default router;
