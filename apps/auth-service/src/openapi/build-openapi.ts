import { z } from "zod";
// Import à effet de bord : enregistre tous les schémas .meta({ id }) dans z.globalRegistry.
import "@packages/api-contracts";

/**
 * build-openapi.ts — document OAS 3.1 d'auth-service (A145, met en œuvre D3)
 * ===========================================================================
 * Même pattern que les quatre autres services : registre Zod commun, chemins écrits à la main,
 * sémantique d'erreurs documentée au réel. Un test (`build-openapi.spec.ts`) vérifie que CHAQUE
 * route montée par les cinq routeurs est documentée et que chaque $ref existe.
 * Les contrôleurs historiques gardent leurs validateurs : les schémas `member-auth.schema.ts`
 * décrivent, ils ne gardent pas encore l'entrée (porte, chantier mobile D36).
 */
const ref = (id: string) => ({ $ref: `#/components/schemas/${id}` });
const jsonResponse = (schemaId: string, description: string) => ({ description, content: { "application/json": { schema: ref(schemaId) } } });
const jsonBody = (schemaId: string) => ({ required: true, content: { "application/json": { schema: ref(schemaId) } } });
const inline = (description: string, schema: Record<string, unknown>) => ({ description, content: { "application/json": { schema } } });

const memberSecurity = [{ cookieAuth: [] }, { bearerAuth: [] }];
const adminSecurity = [{ adminCookieAuth: [] }];
const r400 = jsonResponse("ErrorResponse", "Invalid request (ValidationError — details.errors per field when available)");
const r401 = jsonResponse("UnauthorizedResponse", "Missing, invalid or expired token; suspended account (isAuthenticated)");
const r401a = jsonResponse("UnauthorizedResponse", "No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated)");
const r403 = jsonResponse("ErrorResponse", "Forbidden — details.code = SUDO_REQUIRED when the sudo window is closed (D65)");
const r403p = jsonResponse("ErrorResponse", "The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix)");
const r404 = jsonResponse("ErrorResponse", "Not found (NotFoundError)");
const r409 = jsonResponse("ErrorResponse", "Conflict (ConflictError)");
const r429 = jsonResponse("ErrorResponse", "Too many attempts — OTP lock (RateLimitError, security-alert email after 10 failures)");
const r500 = jsonResponse("UnhandledError", "Unhandled server error");
const idParam = (name: string, description: string) => ({ name, in: "path", required: true, schema: ref("ObjectId"), description });
const slugParam = { name: "slug", in: "path", required: true, schema: { type: "string" }, description: "Member public slug (immutable, D28)" };
const jtiParam = { name: "jti", in: "path", required: true, schema: { type: "string", pattern: "^[a-f0-9]{32}$" }, description: "Session id (refresh token jti)" };
const cursorParam = { name: "cursor", in: "query", required: false, schema: ref("ObjectId"), description: "Id of the last item of the previous page" };
const q = (name: string, schema: Record<string, unknown>, description: string, required = false) => ({ name, in: "query", required, schema, description });
const ok = (schemaId: string, description = "OK") => jsonResponse(schemaId, description);
const okBody = jsonResponse("SuccessMessageResponse", "Done");
const okOnly = jsonResponse("OkResponse", "Done");

type Op = Record<string, unknown>;
const member = (o: Op): Op => ({ security: memberSecurity, ...o });
const admin = (permission: string, o: Op): Op => ({ security: adminSecurity, "x-permission": permission, ...o });
const responses = (extra: Record<string, unknown>, ...base: Array<[string, unknown]>) => Object.fromEntries([...base, ...Object.entries(extra)]);
const memberResponses = (extra: Record<string, unknown>) => responses(extra, ["401", r401], ["500", r500]);
const adminResponses = (extra: Record<string, unknown>) => responses(extra, ["401", r401a], ["403", r403p], ["500", r500]);

export function buildOpenApiDocument() {
  const { schemas } = z.toJSONSchema(z.globalRegistry, { uri: (id) => `#/components/schemas/${id}`, target: "draft-2020-12" });
  const components: Record<string, unknown> = {};
  for (const [id, schema] of Object.entries(schemas)) {
    const { $id, $schema, ...rest } = schema as Record<string, unknown>;
    components[id] = rest;
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Yamba Auth Service API",
      version: "1.0.0",
      description:
        "Accounts, sessions and everything that belongs to a member (auth-service, port 6001, gateway catch-all /api). " +
        "Registration and password reset go through a 6-digit email OTP with a lock after repeated failures. Sessions are JWT cookies " +
        "(access_token / refresh_token) with a refresh-token jti recorded per device (D65); sensitive gestures need the 15-minute sudo window. " +
        "ADMIN sessions are separate (admin_* cookies, password + TOTP, D54) and every route carries a permission of the ADMIN_PERMISSIONS matrix " +
        "(x-permission). Carrier onboarding (Stripe Connect), route alerts, public profiles and follows, member profile (D67), reports (D68), " +
        "GDPR export / erasure (D63), platform settings (D62), maintenance and status (D64) live here too.",
    },
    servers: [
      { url: "http://localhost:8080/api", description: "API Gateway (dev)" },
      { url: "http://localhost:6001/api", description: "auth-service direct (debug)" },
    ],
    tags: [
      { name: "auth", description: "Registration (email OTP), login, Google, refresh, logout, password reset" },
      { name: "me", description: "The authenticated member: profile, preferences, sessions, sudo, GDPR" },
      { name: "carrier", description: "Carrier onboarding and Stripe Connect" },
      { name: "saved-routes", description: "Route alerts (max 20 per member, 6-month expiry)" },
      { name: "users", description: "Public profiles and follows" },
      { name: "reports", description: "Report a trip or a member (D68)" },
      { name: "admin-auth", description: "ADMIN two-step login (password + TOTP), sessions, invitations" },
      { name: "admin", description: "Back-office: KPIs, pilotage, audit, settings, status, maintenance, admins, users, privacy, reports" },
    ],
    paths: {
      /* ── auth ──────────────────────────────────────────────────────── */
      "/auth/register": { post: { tags: ["auth"], summary: "Start a registration — OTP sent by email", description: "Consent (terms + privacy versions) is mandatory. The pending registration lives in Redis for 10 minutes. An existing email answers 409.", operationId: "register", requestBody: jsonBody("MemberRegisterRequest"), responses: { "200": ok("RegistrationStartedResponse", "OTP sent"), "400": r400, "409": r409, "429": r429, "500": r500 } } },
      "/auth/register/verify": { post: { tags: ["auth"], summary: "Verify the OTP and create the account", description: "10 wrong codes lock the token for 30 minutes and send a security-alert email. On success: User + ConsentLog, welcome email.", operationId: "verifyRegistration", requestBody: jsonBody("VerifyRegistrationRequest"), responses: { "201": okBody, "400": r400, "401": jsonResponse("ErrorResponse", "Wrong or expired OTP"), "429": r429, "500": r500 } } },
      "/auth/register/resend": { post: { tags: ["auth"], summary: "Send the OTP again (same token)", operationId: "resendRegistrationOtp", requestBody: jsonBody("VerificationTokenRequest"), responses: { "200": ok("RegistrationStartedResponse", "OTP sent again"), "400": r400, "404": r404, "429": r429, "500": r500 } } },
      "/auth/register/cancel": { post: { tags: ["auth"], summary: "Cancel a pending registration", operationId: "cancelRegistration", requestBody: jsonBody("VerificationTokenRequest"), responses: { "200": okBody, "400": r400, "500": r500 } } },
      "/auth/login": { post: { tags: ["auth"], summary: "Login with email + password", description: "Sets access_token and refresh_token cookies; rememberMe = 30-day refresh (A62). A session record (device, ip, user agent) is written (D65). Suspended account → 401.", operationId: "login", requestBody: jsonBody("MemberLoginRequest"), responses: { "200": ok("MemberLoginResponse", "Logged in"), "400": r400, "401": jsonResponse("UnauthorizedResponse", "Invalid credentials or suspended account"), "500": r500 } } },
      "/auth/google": { post: { tags: ["auth"], summary: "Sign in with Google (D47)", description: "Verifies the Google ID token. Existing email → linked; new account → needs consent, otherwise status CONSENT_REQUIRED without creating anything.", operationId: "googleSignIn", requestBody: jsonBody("GoogleSignInRequest"), responses: { "200": ok("GoogleSignInResponse", "Logged in, or consent required"), "400": r400, "401": jsonResponse("UnauthorizedResponse", "Invalid Google token"), "500": r500 } } },
      "/auth/refresh": { post: { tags: ["auth"], summary: "Rotate the session (refresh cookie)", description: "Reads refresh_token, checks the jti in Redis, issues a new pair. The front replays queued requests after a 401 (api-client circuit breaker).", operationId: "refreshTokens", responses: { "200": okBody, "401": jsonResponse("UnauthorizedResponse", "Refresh token missing, revoked or expired"), "500": r500 } } },
      "/auth/logout": { post: { tags: ["auth"], summary: "Logout — revokes the refresh jti and clears cookies", operationId: "logout", responses: { "200": okBody, "500": r500 } } },
      "/auth/password/forgot": { post: { tags: ["auth"], summary: "Password reset — send an OTP", description: "Always 200, never reveals whether the account exists.", operationId: "requestPasswordReset", requestBody: jsonBody("PasswordForgotRequest"), responses: { "200": ok("MessageResponse", "Sent if the account exists"), "400": r400, "429": r429, "500": r500 } } },
      "/auth/password/verify": { post: { tags: ["auth"], summary: "Verify the reset OTP", operationId: "verifyPasswordReset", requestBody: jsonBody("PasswordVerifyRequest"), responses: { "200": ok("PasswordVerifyResponse", "Verified — reset token"), "400": r400, "401": jsonResponse("ErrorResponse", "Wrong or expired OTP"), "429": r429, "500": r500 } } },
      "/auth/password/resend": { post: { tags: ["auth"], summary: "Send the reset OTP again", operationId: "resendPasswordReset", requestBody: jsonBody("PasswordForgotRequest"), responses: { "200": ok("MessageResponse", "Sent if the account exists"), "400": r400, "429": r429, "500": r500 } } },
      "/auth/password/reset": { post: { tags: ["auth"], summary: "Set the new password with the reset token", description: "Password rules (length, no email inside). Other sessions are revoked; a passwordChanged email is sent.", operationId: "resetPassword", requestBody: jsonBody("PasswordResetRequest"), responses: { "200": ok("MessageResponse", "Reset"), "400": r400, "401": jsonResponse("ErrorResponse", "Reset token invalid or expired"), "500": r500 } } },

      /* ── me ────────────────────────────────────────────────────────── */
      "/auth/me": { get: member({ tags: ["me"], summary: "The authenticated member", description: "The User record without passwordHash, plus the effective roles.", operationId: "getMe", responses: memberResponses({ "200": ok("MeResponse", "Member") }) }) },
      "/auth/me/locale": { patch: member({ tags: ["me"], summary: "Set the preferred locale (D44) — email language", operationId: "updateMyLocale", requestBody: jsonBody("UpdateLocaleRequest"), responses: memberResponses({ "200": ok("UpdateLocaleResponse", "Saved"), "400": r400 }) }) },
      "/auth/me/preferences": { patch: member({ tags: ["me"], summary: "Preferences: reminder emails, locale, analytics consent (D66)", description: "A change of analyticsOptIn is traced in ConsentLog (COOKIES).", operationId: "updateMyPreferences", requestBody: jsonBody("UpdateMyPreferencesRequest"), responses: memberResponses({ "200": ok("PreferencesResponse", "Saved"), "400": r400 }) }) },
      "/auth/me/sudo/request": { post: member({ tags: ["me"], summary: "Sudo — send the code by email (D65 1A)", operationId: "requestSudoCode", responses: memberResponses({ "200": okBody, "429": r429 }) }) },
      "/auth/me/sudo/verify": { post: member({ tags: ["me"], summary: "Sudo — open the 15-minute window for THIS session", description: "The window is bound to the refresh jti: another session of the same member does not inherit it.", operationId: "verifySudo", requestBody: jsonBody("SudoVerifyRequest"), responses: memberResponses({ "200": ok("SudoWindowResponse", "Window open"), "400": r400, "401": jsonResponse("ErrorResponse", "Wrong or expired code"), "429": r429 }) }) },
      "/auth/me/sudo": { get: member({ tags: ["me"], summary: "Sudo — is the window open, until when", operationId: "getSudoStatus", responses: memberResponses({ "200": ok("SudoStatus", "Status") }) }) },
      "/auth/me/sessions": {
        get: member({ tags: ["me"], summary: "Connected devices (D65 2A)", operationId: "listMySessions", responses: memberResponses({ "200": ok("MemberSessionsResponse", "Sessions, current first") }) }),
        delete: member({ tags: ["me"], summary: "Revoke every OTHER session", operationId: "revokeMyOtherSessions", responses: memberResponses({ "200": ok("RevokeSessionResponse", "Revoked count") }) }),
      },
      "/auth/me/sessions/{jti}": { delete: member({ tags: ["me"], summary: "Revoke one session (current allowed — cookies cleared)", operationId: "revokeMySession", parameters: [jtiParam], responses: memberResponses({ "200": ok("RevokeSessionResponse", "Revoked"), "400": r400, "404": r404 }) }) },
      "/auth/me/password": { post: member({ tags: ["me"], summary: "Change the password (sudo)", description: "Requires the sudo window (403 SUDO_REQUIRED). Other sessions revoked, passwordChanged email. A Google-only account sets its first password.", operationId: "changeMyPassword", requestBody: jsonBody("ChangePasswordRequest"), responses: memberResponses({ "200": ok("PasswordChangedResponse", "Changed"), "400": r400, "403": r403 }) }) },
      "/auth/me/email/request": { post: member({ tags: ["me"], summary: "Change the email — code sent to the NEW address (sudo)", operationId: "requestEmailChange", requestBody: jsonBody("RequestEmailChange"), responses: memberResponses({ "200": ok("EmailChangeRequestedResponse", "Code sent"), "400": r400, "403": r403, "409": jsonResponse("ErrorResponse", "Email already used") }) }) },
      "/auth/me/email/confirm": { post: member({ tags: ["me"], summary: "Confirm the new email with the code", description: "The old address is warned (emailChanged), other sessions are revoked.", operationId: "confirmEmailChange", requestBody: jsonBody("ConfirmEmailChange"), responses: memberResponses({ "200": ok("EmailChangeConfirmedResponse", "Changed"), "400": r400, "401": jsonResponse("ErrorResponse", "Wrong or expired code"), "409": r409 }) }) },
      "/auth/me/data-export": { post: member({ tags: ["me"], summary: "GDPR — download my data as JSON (sudo, D63 2A)", description: "Content-Disposition attachment; a DataRequest EXPORT is written.", operationId: "exportMyData", responses: memberResponses({ "200": ok("DataExport", "JSON export"), "403": r403 }) }) },
      "/auth/me/erasure/blockers": { get: member({ tags: ["me"], summary: "GDPR — what prevents erasure right now (D63 3A)", operationId: "getMyErasureBlockers", responses: memberResponses({ "200": inline("Blockers (empty = erasable)", { type: "object", properties: { blockers: { type: "array", items: ref("ErasureBlocker") }, counts: { type: "object", additionalProperties: { type: "integer" } } }, required: ["blockers"] }) }) }) },
      "/auth/me/erasure": { post: member({ tags: ["me"], summary: "GDPR — erase my account now (sudo, D63 3A)", description: "ONE transaction anonymising the User field by field; bookings, disputes, reviews and messages are kept. 409 ERASURE_BLOCKED with the closed list of blockers.", operationId: "eraseMyAccount", requestBody: jsonBody("EraseMyAccountRequest"), responses: memberResponses({ "200": ok("ErasedResponse", "Erased — session ended"), "400": r400, "403": r403, "409": ok("ErasureBlockedResponse", "Blocked by a live deal") }) }) },
      "/auth/me/profile": {
        get: member({ tags: ["me"], summary: "My editable profile (D67)", operationId: "getMyProfile", responses: memberResponses({ "200": ok("MyProfileResponse", "Profile") }) }),
        patch: member({ tags: ["me"], summary: "Update names, birth date, carrier display name / bio, visibilities (D67 1A)", description: "Errors per field in details.errors (INVALID_DATE, IN_THE_FUTURE, TOO_YOUNG, NO_CARRIER_PAGE). The public slug never changes.", operationId: "updateMyProfile", requestBody: jsonBody("UpdateMyProfileRequest"), responses: memberResponses({ "200": ok("MyProfileResponse", "Saved"), "400": r400 }) }),
      },
      "/auth/me/avatar": {
        post: member({ tags: ["me"], summary: "Declare the avatar uploaded to ImageKit (D67 2A)", description: "The URL must belong to IMAGEKIT_URL_ENDPOINT; the previous file is deleted.", operationId: "setMyAvatar", requestBody: jsonBody("SetMyAvatarRequest"), responses: memberResponses({ "200": ok("MyProfileResponse", "Saved"), "400": r400 }) }),
        delete: member({ tags: ["me"], summary: "Remove the avatar", operationId: "deleteMyAvatar", responses: memberResponses({ "200": ok("MyProfileResponse", "Removed") }) }),
      },

      /* ── reports (D68) ─────────────────────────────────────────────── */
      "/reports": { post: member({ tags: ["reports"], summary: "Report a trip or a member (D68 1A)", description: "targetRef = trip id or member public slug. 400 OWN_TARGET / REASON_NOT_ALLOWED, 404 invisible target (deleted trip, erased member, hidden page), 409 open duplicate. Acknowledgement email to the reporter; the target never learns who reported.", operationId: "createReport", requestBody: jsonBody("CreateReportRequest"), responses: memberResponses({ "201": ok("CreateReportResponse", "Recorded"), "400": r400, "404": r404, "409": r409 }) }) },

      /* ── carrier ───────────────────────────────────────────────────── */
      "/carrier/onboarding/profile": { post: member({ tags: ["carrier"], summary: "Carrier onboarding — step PROFILE", description: "Creates or updates the CarrierPage (name, bio, phone, primary address).", operationId: "saveCarrierProfile", requestBody: jsonBody("CarrierProfileRequest"), responses: memberResponses({ "200": ok("CarrierProfileResponse", "Saved"), "400": r400 }) }) },
      "/carrier/onboarding/stripe": { post: member({ tags: ["carrier"], summary: "Carrier onboarding — Stripe Connect account link", description: "Creates the Express account on first call; returns a single-use onboarding URL.", operationId: "createStripeConnectLink", responses: memberResponses({ "200": ok("StripeLinkResponse", "Onboarding URL"), "400": r400 }) }) },
      "/carrier/onboarding/stripe/status": { get: member({ tags: ["carrier"], summary: "Stripe account status (charges / payouts)", operationId: "getStripeStatus", responses: memberResponses({ "200": ok("StripeStatusResponse", "Status") }) }) },
      "/carrier/onboarding/complete": { post: member({ tags: ["carrier"], summary: "Carrier onboarding — complete", description: "Grants the CARRIER role and sends the onboarding-complete email.", operationId: "completeCarrierOnboarding", responses: memberResponses({ "200": okBody, "400": r400 }) }) },
      "/carrier/stripe/dashboard-link": { post: member({ tags: ["carrier"], summary: "Stripe Express dashboard link (sudo, A84)", operationId: "createStripeDashboardLink", responses: memberResponses({ "200": ok("StripeLinkResponse", "Dashboard URL"), "403": r403, "409": jsonResponse("ErrorResponse", "No Stripe account yet") }) }) },

      /* ── saved routes ──────────────────────────────────────────────── */
      "/saved-routes": {
        post: member({ tags: ["saved-routes"], summary: "Create a route alert (6-month expiry)", operationId: "createSavedRoute", requestBody: jsonBody("SavedRouteRequest"), responses: memberResponses({ "201": ok("SavedRouteResponse", "Created"), "400": r400, "409": jsonResponse("ErrorResponse", "Limit of 20 alerts reached") }) }),
        get: member({ tags: ["saved-routes"], summary: "My route alerts", operationId: "listSavedRoutes", responses: memberResponses({ "200": ok("SavedRoutesResponse", "Alerts") }) }),
      },
      "/saved-routes/{id}": {
        patch: member({ tags: ["saved-routes"], summary: "Update a route alert", operationId: "updateSavedRoute", parameters: [idParam("id", "Saved route id")], requestBody: jsonBody("SavedRouteRequest"), responses: memberResponses({ "200": ok("SavedRouteResponse", "Updated"), "400": r400, "404": r404 }) }),
        delete: member({ tags: ["saved-routes"], summary: "Delete a route alert", operationId: "deleteSavedRoute", parameters: [idParam("id", "Saved route id")], responses: memberResponses({ "200": okBody, "404": r404 }) }),
      },
      "/saved-routes/{id}/extend": { post: member({ tags: ["saved-routes"], summary: "Extend a route alert by 6 months", operationId: "extendSavedRoute", parameters: [idParam("id", "Saved route id")], responses: memberResponses({ "200": ok("SavedRouteResponse", "Extended"), "404": r404 }) }) },

      /* ── users (public + follow) ───────────────────────────────────── */
      "/users/{slug}/public": { get: { tags: ["users"], summary: "Public profile (D28 / D29 / D67)", description: "Optional auth (follow state). 404 when the member is erased or has hidden the page — unless the caller is the owner (hidden: true).", operationId: "getUserPublic", parameters: [slugParam], responses: { "200": ok("PublicUserResponse", "Profile"), "404": r404, "500": r500 } } },
      "/users/{slug}/public/reviews": { get: { tags: ["users"], summary: "Revealed reviews of a member, paginated", operationId: "listUserPublicReviews", parameters: [slugParam, q("kind", { type: "string", enum: ["AS_CARRIER", "AS_SHIPPER"] }, "Role reviewed"), q("limit", { type: "integer", minimum: 1, maximum: 50 }, "Page size"), cursorParam], responses: { "200": ok("PublicReviewsResponse", "Reviews"), "404": r404, "500": r500 } } },
      "/users/{slug}/public/trips": { get: { tags: ["users"], summary: "Upcoming published trips of a carrier, paginated", operationId: "listUserPublicTrips", parameters: [slugParam, q("limit", { type: "integer", minimum: 1, maximum: 50 }, "Page size"), cursorParam], responses: { "200": ok("PublicTripsResponse", "Trips"), "404": r404, "500": r500 } } },
      "/users/{slug}/follow": {
        post: member({ tags: ["users"], summary: "Follow a member (D46)", operationId: "followUser", parameters: [slugParam], requestBody: { required: false, content: { "application/json": { schema: ref("FollowPreferencesRequest") } } }, responses: memberResponses({ "200": ok("FollowResponse", "Followed"), "404": r404 }) }),
        delete: member({ tags: ["users"], summary: "Unfollow", operationId: "unfollowUser", parameters: [slugParam], responses: memberResponses({ "200": okBody, "404": r404 }) }),
        patch: member({ tags: ["users"], summary: "Follow preferences — notify on next trip", operationId: "updateFollowPreferences", parameters: [slugParam], requestBody: jsonBody("FollowPreferencesRequest"), responses: memberResponses({ "200": ok("FollowResponse", "Saved"), "400": r400, "404": r404 }) }),
      },
      "/me/following": { get: member({ tags: ["users"], summary: "Members I follow — those with an upcoming trip first", operationId: "listMyFollowing", responses: memberResponses({ "200": ok("FollowingResponse", "Following") }) }) },

      /* ── admin auth (D54) ──────────────────────────────────────────── */
      "/auth/admin/login": { post: { tags: ["admin-auth"], summary: "ADMIN login step 1 — password", description: "Requires User.adminRoles. Sets the admin_preauth cookie (5 min); next = TOTP or SETUP.", operationId: "adminLogin", requestBody: jsonBody("AdminLoginRequest"), responses: { "200": ok("AdminLoginResponse", "Pre-authenticated"), "400": r400, "401": jsonResponse("UnauthorizedResponse", "Invalid credentials or not an admin"), "500": r500 } } },
      "/auth/admin/totp/setup": { post: { tags: ["admin-auth"], summary: "TOTP setup — secret and otpauth URL (pre-auth cookie)", operationId: "adminTotpSetup", responses: { "200": ok("AdminTotpSetupResponse", "Secret"), "401": r401a, "500": r500 } } },
      "/auth/admin/totp/enable": { post: { tags: ["admin-auth"], summary: "TOTP enable — first code, returns the backup codes ONCE", operationId: "adminTotpEnable", requestBody: jsonBody("AdminTotpCodeRequest"), responses: { "200": ok("AdminTotpEnableResponse", "Enabled"), "400": r400, "401": r401a, "500": r500 } } },
      "/auth/admin/totp/verify": { post: { tags: ["admin-auth"], summary: "ADMIN login step 2 — TOTP or backup code", description: "Opens the ADMIN session: admin_access_token / admin_refresh_token cookies (claims adm + amr pwd,totp).", operationId: "adminTotpVerify", requestBody: jsonBody("AdminTotpCodeRequest"), responses: { "200": ok("AdminTotpVerifyResponse", "Session open"), "400": r400, "401": r401a, "429": r429, "500": r500 } } },
      "/auth/admin/refresh": { post: { tags: ["admin-auth"], summary: "Rotate the ADMIN session", operationId: "adminRefresh", responses: { "200": okOnly, "401": r401a, "500": r500 } } },
      "/auth/admin/logout": { post: { tags: ["admin-auth"], summary: "ADMIN logout", operationId: "adminLogout", responses: { "200": okOnly, "500": r500 } } },
      "/auth/admin/invite/accept": { post: { tags: ["admin-auth"], summary: "Accept an admin invitation (public token, D56)", description: "Sets the password of the invited account; the token is single-use and expires.", operationId: "acceptAdminInvite", requestBody: jsonBody("AcceptAdminInviteRequest"), responses: { "200": inline("Accepted", { type: "object", properties: { ok: { type: "boolean" }, email: { type: "string" } }, required: ["ok", "email"] }), "400": r400, "404": r404, "500": r500 } } },
      "/admin/me": { get: admin("(session)", { tags: ["admin-auth"], summary: "The ADMIN account and its profiles", operationId: "getAdminMe", responses: { "200": ok("AdminMeResponse", "Admin"), "401": r401a, "500": r500 } }) },
      "/admin/me/sessions": { get: admin("(session)", { tags: ["admin-auth"], summary: "ADMIN sessions", operationId: "listAdminSessions", responses: { "200": inline("Sessions", { type: "object", properties: { items: { type: "array", items: ref("AdminSessionItem") } }, required: ["items"] }), "401": r401a, "500": r500 } }) },
      "/admin/me/sessions/{jti}": { delete: admin("(session)", { tags: ["admin-auth"], summary: "Revoke one ADMIN session", operationId: "revokeAdminSession", parameters: [jtiParam], responses: { "200": okOnly, "400": r400, "401": r401a, "500": r500 } }) },

      /* ── admin ─────────────────────────────────────────────────────── */
      "/admin/kpis": { get: admin("kpi.read", { tags: ["admin"], summary: "Home counters (D57) — null = not visible to this profile", operationId: "getAdminKpis", responses: adminResponses({ "200": ok("AdminHomeKpis", "KPIs") }) }) },
      "/admin/pilotage/series": { get: admin("pilotage.read", { tags: ["admin"], summary: "Pilotage series (D59, 60 s Redis cache)", operationId: "getPilotageSeries", parameters: [q("granularity", { type: "string", enum: ["week", "month"] }, "Default week"), q("months", { type: "integer" }, "Window (default 3 for week, 12 for month)")], responses: adminResponses({ "200": ok("PilotageSeriesResponse", "Series") }) }) },
      "/admin/pilotage/corridors": { get: admin("pilotage.read", { tags: ["admin"], summary: "Corridors — demand vs supply (D59)", operationId: "getPilotageCorridors", parameters: [q("days", { type: "integer" }, "Window, default 30")], responses: adminResponses({ "200": ok("CorridorsResponse", "Corridors") }) }) },
      "/admin/pilotage/drilldown": { get: admin("pilotage.read", { tags: ["admin"], summary: "Drilldown of one point of a series (D60 3A, journaled)", operationId: "getPilotageDrilldown", parameters: [q("metric", ref("PilotageMetric"), "Metric", true), q("granularity", { type: "string", enum: ["week", "month"] }, "Default week"), q("period", { type: "string" }, "Period key of the series point", true)], responses: adminResponses({ "200": ok("PilotageDrilldownResponse", "Items"), "400": r400 }) }) },
      "/admin/audit": { get: admin("audit.read", { tags: ["admin"], summary: "Admin journal, newest first", operationId: "listAdminAudit", parameters: [cursorParam], responses: adminResponses({ "200": ok("AdminAuditResponse", "Journal page") }) }) },
      "/admin/settings": {
        get: admin("settings.read", { tags: ["admin"], summary: "Platform settings + catalogue (D62)", operationId: "getSettings", responses: adminResponses({ "200": ok("AdminSettingsResponse", "Settings") }) }),
        patch: admin("settings.read + per-key scope", { tags: ["admin"], summary: "Change settings (D62 5A)", description: "Reason ≥ 20 chars, optimistic version. Scope enforced per key in the service: BUSINESS = SUPER_ADMIN, OPERATIONS = OPS. One SETTING_CHANGED journal line per key, email to every SUPER_ADMIN. Never retroactive.", operationId: "updateSettings", requestBody: jsonBody("UpdateSettingsRequest"), responses: adminResponses({ "200": ok("SettingsWriteResponse", "Changed"), "400": r400, "409": jsonResponse("ErrorResponse", "Version conflict") }) }),
      },
      "/admin/settings/history": { get: admin("settings.read", { tags: ["admin"], summary: "Settings change history", operationId: "getSettingsHistory", parameters: [q("key", { type: "string" }, "Filter on one key"), cursorParam], responses: adminResponses({ "200": ok("SettingsHistoryResponse", "History") }) }) },
      "/admin/settings/reset": { post: admin("settings.read + per-key scope", { tags: ["admin"], summary: "Reset settings to the catalogue defaults (SETTINGS_RESET)", operationId: "resetSettings", requestBody: jsonBody("ResetSettingsRequest"), responses: adminResponses({ "200": ok("SettingsWriteResponse", "Reset"), "400": r400, "409": r409 }) }) },
      "/admin/status": { get: admin("status.read", { tags: ["admin"], summary: "Service status page (D64 5A) — not a monitoring tool", operationId: "getAdminStatus", responses: adminResponses({ "200": ok("AdminStatusResponse", "Status") }) }) },
      "/admin/maintenance": {
        get: admin("status.read", { tags: ["admin"], summary: "Planned maintenance state (D64 1A)", operationId: "getMaintenance", responses: adminResponses({ "200": ok("MaintenanceState", "State") }) }),
        put: admin("maintenance.write", { tags: ["admin"], summary: "Switch the read-only mode (journaled, SUPER_ADMINs emailed)", operationId: "updateMaintenance", requestBody: jsonBody("UpdateMaintenanceRequest"), responses: adminResponses({ "200": ok("MaintenanceState", "State"), "400": r400 }) }),
      },
      "/admin/admins": { get: admin("admins.manage", { tags: ["admin"], summary: "Admin accounts", operationId: "listAdmins", responses: adminResponses({ "200": inline("Admins", { type: "object", properties: { items: { type: "array", items: ref("AdminAccount") } }, required: ["items"] }) }) }) },
      "/admin/admins/invite": { post: admin("admins.manage", { tags: ["admin"], summary: "Invite an admin (D56) — email with a single-use token", operationId: "inviteAdmin", requestBody: jsonBody("InviteAdminRequest"), responses: adminResponses({ "200": ok("InviteAdminResponse", "Existing account: roles granted"), "201": ok("InviteAdminResponse", "Invited"), "400": r400 }) }) },
      "/admin/admins/{id}": {
        patch: admin("admins.manage", { tags: ["admin"], summary: "Change the profiles of an admin (D60 1A: union of permissions)", operationId: "updateAdminRole", parameters: [idParam("id", "User id")], requestBody: jsonBody("UpdateAdminRoleRequest"), responses: adminResponses({ "200": ok("UpdateAdminRoleResponse", "Updated"), "400": r400, "404": r404 }) }),
        delete: admin("admins.manage", { tags: ["admin"], summary: "Revoke the admin profiles (sessions revoked)", operationId: "revokeAdmin", parameters: [idParam("id", "User id")], responses: adminResponses({ "200": okOnly, "404": r404, "409": jsonResponse("ErrorResponse", "Last SUPER_ADMIN or yourself") }) }),
      },
      "/admin/users": { get: admin("users.read", { tags: ["admin"], summary: "Search members (D60 2A)", operationId: "searchAdminUsers", parameters: [q("q", { type: "string" }, "Name, email, phone"), q("role", { type: "string", enum: ["SHIPPER", "CARRIER", "ADMIN"] }, "Role"), q("accountStatus", ref("AccountStatus"), "Sanction status"), q("carrierStatus", { type: "string" }, "Carrier status"), q("stripeReady", { type: "string", enum: ["1", "0"] }, "Connect with payouts enabled"), q("createdFrom", { type: "string", format: "date-time" }, "Created after"), q("createdTo", { type: "string", format: "date-time" }, "Created before"), q("sort", { type: "string", enum: ["createdAt", "lastName"] }, "Sort"), q("dir", { type: "string", enum: ["asc", "desc"] }, "Direction"), cursorParam, q("limit", { type: "integer", minimum: 1, maximum: 100 }, "Page size (50)")], responses: adminResponses({ "200": ok("AdminUsersResponse", "Page"), "400": r400 }) }) },
      "/admin/users/export": { get: admin("exports.personal", { tags: ["admin"], summary: "CSV export of members (SUPER_ADMIN or PRIVACY, reason ≥ 20, journaled EXPORTED)", operationId: "exportAdminUsers", parameters: [q("reason", { type: "string", minLength: 20 }, "Why this export", true)], responses: adminResponses({ "200": { description: "text/csv (BOM, RFC 4180, formula prefixes neutralised)", content: { "text/csv": { schema: { type: "string" } } } }, "400": r400 }) }) },
      "/admin/users/{id}": { get: admin("users.read", { tags: ["admin"], summary: "Member file", operationId: "getAdminUserFile", parameters: [idParam("id", "User id")], responses: adminResponses({ "200": ok("AdminUserFile", "File"), "404": r404 }) }) },
      "/admin/users/{id}/suspension/propose": { post: admin("users.suspension.propose", { tags: ["admin"], summary: "Propose a sanction (SUPPORT / MEDIATOR)", operationId: "proposeSuspension", parameters: [idParam("id", "User id")], requestBody: jsonBody("ProposeSuspensionRequest"), responses: adminResponses({ "200": ok("SuspensionProposedResponse", "Proposed"), "400": r400, "404": r404 }) }) },
      "/admin/users/{id}/suspension": {
        post: admin("users.suspension.apply", { tags: ["admin"], summary: "Apply RESTRICTED or SUSPENDED (SUPER_ADMIN) — effective through reads only", operationId: "applySuspension", parameters: [idParam("id", "User id")], requestBody: jsonBody("ApplySuspensionRequest"), responses: adminResponses({ "200": ok("SuspensionAppliedResponse", "Applied"), "400": r400, "404": r404 }) }),
        delete: admin("users.suspension.apply", { tags: ["admin"], summary: "Lift the sanction", operationId: "liftSuspension", parameters: [idParam("id", "User id")], requestBody: { required: false, content: { "application/json": { schema: ref("LiftSuspensionRequest") } } }, responses: adminResponses({ "200": ok("SuspensionAppliedResponse", "Lifted (ACTIVE)"), "404": r404 }) }),
      },
      "/admin/users/{id}/email-suppression": { delete: admin("users.email.unsuppress", { tags: ["admin"], summary: "Lift an email suppression after a bounce / complaint (D35 4A, journaled)", operationId: "unsuppressEmail", parameters: [idParam("id", "User id")], responses: adminResponses({ "200": okOnly, "404": r404 }) }) },
      "/admin/users/{id}/erase": { post: admin("users.erase", { tags: ["admin"], summary: "GDPR — erase a member on request (D63 6A, PRIVACY)", operationId: "adminEraseUser", parameters: [idParam("id", "User id")], requestBody: jsonBody("AdminEraseUserRequest"), responses: adminResponses({ "200": ok("ErasedResponse", "Erased"), "400": r400, "404": r404, "409": ok("ErasureBlockedResponse", "Blocked by a live deal") }) }) },
      "/admin/privacy/requests": { get: admin("privacy.requests.read", { tags: ["admin"], summary: "GDPR requests register (exports, erasures) — journaled read", operationId: "listDataRequests", parameters: [cursorParam], responses: adminResponses({ "200": ok("DataRequestsResponse", "Requests") }) }) },
      "/admin/reports": { get: admin("reports.review", { tags: ["admin"], summary: "Reported trips and members (D68 3A) — priority from 3 open reports on a target", operationId: "listAdminReports", parameters: [q("status", ref("ReportStatus"), "Default OPEN")], responses: adminResponses({ "200": ok("AdminReportsResponse", "Queue"), "400": r400 }) }) },
      "/admin/reports/{id}": { patch: admin("reports.review", { tags: ["admin"], summary: "Decide on a report — REVIEWED / DISMISSED, journaled (no automatic sanction)", operationId: "reviewAdminReport", parameters: [idParam("id", "Report id")], requestBody: jsonBody("ReviewReportRequest"), responses: adminResponses({ "200": inline("Decided", { type: "object", properties: { id: ref("ObjectId"), status: ref("ReportStatus") }, required: ["id", "status"] }), "400": r400, "404": r404, "409": jsonResponse("ErrorResponse", "Already reviewed") }) }) },
    },
    components: {
      securitySchemes: {
        cookieAuth: { type: "apiKey", in: "cookie", name: "access_token", description: "Member session (JWT)" },
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Member access token (mobile, D36)" },
        adminCookieAuth: { type: "apiKey", in: "cookie", name: "admin_access_token", description: "ADMIN session (JWT, claims adm + amr pwd,totp — D54)" },
      },
      schemas: components,
    },
  };
}
