/**
 * member-auth.schema.ts — contrats de la surface membre d'auth-service (A145)
 * ============================================================================
 * Inscription / connexion / mot de passe / Google, compte, onboarding Voyageur, alertes de route,
 * profil public et abonnement. Ces schémas DOCUMENTENT des contrôleurs qui gardent leurs validateurs
 * historiques : ils sont la source de l'OpenAPI 3.1 (D3), pas encore la garde d'entrée (porte : les
 * brancher en safeParse au chantier mobile D36). Les réponses sont décrites au réel du code.
 */
import { z } from "zod";
import { ObjectIdSchema } from "../common";

const iso = z.string().datetime();
const okMessage = (id: string, description: string) => z.object({ success: z.boolean().optional(), message: z.string() }).meta({ id, description });

/* ── Inscription (OTP par email) ────────────────────────────────────────── */
export const MemberRegisterRequestSchema = z
  .object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    termsAccepted: z.literal(true),
    termsVersion: z.string().min(1),
    privacyVersion: z.string().min(1),
  })
  .meta({ id: "MemberRegisterRequest", description: "Consent is mandatory (ConsentLog written at verification)" });
export const RegistrationStartedResponseSchema = z.object({ message: z.string(), verificationToken: z.string() }).meta({ id: "RegistrationStartedResponse", description: "OTP sent; the token identifies the pending registration (Redis, 10 min)" });
export const VerificationTokenRequestSchema = z.object({ verificationToken: z.string() }).meta({ id: "VerificationTokenRequest" });
export const VerifyRegistrationRequestSchema = z.object({ verificationToken: z.string(), otp: z.string().length(6) }).meta({ id: "VerifyRegistrationRequest" });
export const SuccessMessageResponseSchema = okMessage("SuccessMessageResponse", "Generic { success, message } acknowledgement");

/* ── Connexion / session ────────────────────────────────────────────────── */
export const MemberLoginRequestSchema = z.object({ email: z.string().email(), password: z.string(), rememberMe: z.boolean().optional() }).meta({ id: "MemberLoginRequest", description: "rememberMe = 30-day refresh cookie (A62)" });
export const SessionUserSchema = z.object({ id: ObjectIdSchema, email: z.string(), firstName: z.string(), lastName: z.string(), roles: z.array(z.string()) }).meta({ id: "SessionUser" });
export const MemberLoginResponseSchema = z.object({ message: z.string(), user: SessionUserSchema }).meta({ id: "MemberLoginResponse", description: "Cookies access_token / refresh_token are set on the response" });
export const GoogleSignInRequestSchema = z
  .object({ credential: z.string().min(1), rememberMe: z.boolean().optional(), consent: z.object({ termsVersion: z.string(), privacyVersion: z.string() }).optional() })
  .meta({ id: "GoogleSignInRequest", description: "Google ID token (D47). A new account needs consent, otherwise CONSENT_REQUIRED" });
export const GoogleSignInResponseSchema = z
  .object({ status: z.enum(["LOGGED_IN", "CONSENT_REQUIRED"]), created: z.boolean().optional(), linked: z.boolean().optional(), user: SessionUserSchema.optional() })
  .meta({ id: "GoogleSignInResponse" });
export const MeResponseSchema = z
  .object({
    success: z.literal(true),
    user: z
      .object({
        id: ObjectIdSchema,
        email: z.string(),
        firstName: z.string(),
        lastName: z.string(),
        roles: z.array(z.string()),
        preferredLocale: z.string().nullable().optional(),
        phoneE164: z.string().nullable().optional(),
        publicSlug: z.string().nullable().optional(),
        accountStatus: z.string().optional(),
        carrierStatus: z.string().nullable().optional(),
        analyticsOptIn: z.boolean().nullable().optional(),
        profilePublic: z.boolean().optional(),
        showCity: z.boolean().optional(),
        createdAt: iso.optional(),
      })
      .loose(),
    roles: z.array(z.string()),
  })
  .meta({ id: "MeResponse", description: "The User record without passwordHash (additional fields allowed)" });
export const UpdateLocaleRequestSchema = z.object({ locale: z.string() }).meta({ id: "UpdateLocaleRequest", description: "One of SUPPORTED_LOCALES (D44)" });
export const UpdateLocaleResponseSchema = z.object({ success: z.literal(true), preferredLocale: z.string() }).meta({ id: "UpdateLocaleResponse" });

/* ── Mot de passe oublié ────────────────────────────────────────────────── */
export const PasswordForgotRequestSchema = z.object({ email: z.string().email() }).meta({ id: "PasswordForgotRequest", description: "Always 200: never reveals whether the account exists" });
export const PasswordVerifyRequestSchema = z.object({ email: z.string().email(), otp: z.string().length(6) }).meta({ id: "PasswordVerifyRequest" });
export const PasswordVerifyResponseSchema = z.object({ message: z.string(), passwordResetToken: z.string() }).meta({ id: "PasswordVerifyResponse" });
export const PasswordResetRequestSchema = z.object({ passwordResetToken: z.string(), newPassword: z.string().min(8) }).meta({ id: "PasswordResetRequest" });
export const MessageResponseSchema = z.object({ message: z.string() }).meta({ id: "MessageResponse" });

/* ── Compte (D63 / D65) — compléments aux schémas admin/* ───────────────── */
export const SudoWindowResponseSchema = z.object({ active: z.literal(true), expiresAt: iso }).meta({ id: "SudoWindowResponse", description: "Sudo window opened for this session (15 min, D65)" });
export const RevokeSessionResponseSchema = z.object({ ok: z.literal(true), current: z.boolean().optional(), revoked: z.number().int().optional() }).meta({ id: "RevokeSessionResponse" });
export const PasswordChangedResponseSchema = z.object({ ok: z.literal(true), revokedSessions: z.number().int(), hadPassword: z.boolean() }).meta({ id: "PasswordChangedResponse" });
export const EmailChangeRequestedResponseSchema = z.object({ ok: z.literal(true), pendingEmail: z.string(), expiresInMinutes: z.number().int() }).meta({ id: "EmailChangeRequestedResponse" });
export const EmailChangeConfirmedResponseSchema = z.object({ ok: z.literal(true), email: z.string(), revokedSessions: z.number().int() }).meta({ id: "EmailChangeConfirmedResponse" });
export const PreferencesResponseSchema = z
  .object({ success: z.literal(true), preferences: z.object({ messagingReminderEmails: z.boolean(), preferredLocale: z.string().nullable(), analyticsOptIn: z.boolean().nullable() }) })
  .meta({ id: "PreferencesResponse" });
export const ErasedResponseSchema = z.object({ success: z.literal(true), erased: z.literal(true) }).meta({ id: "ErasedResponse" });

/* ── Onboarding Voyageur + Stripe Connect ───────────────────────────────── */
export const CarrierProfileRequestSchema = z
  .object({
    name: z.string().min(1),
    bio: z.string().nullable().optional(),
    phoneE164: z.string().nullable().optional(),
    address: z.object({ formattedAddress: z.string(), placeId: z.string().optional(), city: z.string().nullable().optional(), country: z.string().nullable().optional(), countryCode: z.string().nullable().optional(), lat: z.number().nullable().optional(), lng: z.number().nullable().optional() }).loose().optional(),
  })
  .meta({ id: "CarrierProfileRequest", description: "Step PROFILE of the carrier onboarding" });
export const CarrierPageDtoSchema = z
  .object({ id: ObjectIdSchema, userId: ObjectIdSchema, name: z.string(), bio: z.string().nullable(), phoneE164: z.string().nullable(), onboardingStep: z.string(), stripeOnboardingComplete: z.boolean(), stripeChargesEnabled: z.boolean(), stripePayoutsEnabled: z.boolean(), isVerified: z.boolean(), isSuperCarrier: z.boolean() })
  .loose()
  .meta({ id: "CarrierPageDto" });
export const CarrierProfileResponseSchema = z.object({ success: z.literal(true), message: z.string(), carrierPage: CarrierPageDtoSchema }).meta({ id: "CarrierProfileResponse" });
export const StripeLinkResponseSchema = z.object({ success: z.literal(true), url: z.string().url() }).meta({ id: "StripeLinkResponse", description: "Single-use Stripe URL (onboarding or Express dashboard), never stored" });
export const StripeStatusResponseSchema = z
  .object({ success: z.literal(true), status: z.enum(["not_started", "pending", "complete"]), chargesEnabled: z.boolean(), payoutsEnabled: z.boolean(), detailsSubmitted: z.boolean().optional() })
  .meta({ id: "StripeStatusResponse" });

/* ── Alertes de route ───────────────────────────────────────────────────── */
export const SavedRouteRequestSchema = z
  .object({
    originCity: z.string().min(1), originCountry: z.string().min(1), originCountryCode: z.string().length(2), originCityCode: z.string().nullable().optional(), originRegion: z.string().nullable().optional(), originRegionCode: z.string().nullable().optional(), originPlaceId: z.string().nullable().optional(), originLat: z.number().nullable().optional(), originLng: z.number().nullable().optional(),
    destinationCity: z.string().min(1), destinationCountry: z.string().min(1), destinationCountryCode: z.string().length(2), destinationCityCode: z.string().nullable().optional(), destinationRegion: z.string().nullable().optional(), destinationRegionCode: z.string().nullable().optional(), destinationPlaceId: z.string().nullable().optional(), destinationLat: z.number().nullable().optional(), destinationLng: z.number().nullable().optional(),
    earliestDate: iso.nullable().optional(), latestDate: iso.nullable().optional(),
    emailEnabled: z.boolean().optional(), inAppEnabled: z.boolean().optional(), includeNearby: z.boolean().optional(),
  })
  .meta({ id: "SavedRouteRequest", description: "Origin and destination are Google Places snapshots; same city+country on both sides is refused. Max 20 alerts per member" });
export const SavedRouteDtoSchema = SavedRouteRequestSchema.extend({ id: ObjectIdSchema, userId: ObjectIdSchema, expiresAt: iso, isActive: z.boolean(), lastNotifiedAt: iso.nullable().optional(), createdAt: iso, updatedAt: iso }).meta({ id: "SavedRouteDto" });
export const SavedRouteResponseSchema = z.object({ success: z.literal(true), message: z.string().optional(), savedRoute: SavedRouteDtoSchema }).meta({ id: "SavedRouteResponse" });
export const SavedRoutesResponseSchema = z.object({ success: z.literal(true), savedRoutes: z.array(SavedRouteDtoSchema), count: z.number().int() }).meta({ id: "SavedRoutesResponse" });

/* ── Profil public + abonnement ─────────────────────────────────────────── */
export const PublicReviewSchema = z
  .object({ id: ObjectIdSchema, rating: z.number(), comment: z.string().nullable(), criteria: z.record(z.string(), z.enum(["UP", "DOWN"])).nullable().optional(), createdAt: iso, author: z.object({ firstName: z.string(), lastInitial: z.string(), avatarUrl: z.string().nullable() }) })
  .meta({ id: "PublicReview" });
export const PublicTripPreviewSchema = z
  .object({ id: ObjectIdSchema, transportMode: z.string().nullable(), originCity: z.string().nullable(), destinationCity: z.string().nullable(), departureAt: iso.nullable(), flightType: z.string().nullable(), trainTripType: z.string().nullable(), carTripFlexibility: z.string().nullable(), minPriceCents: z.number().int().nullable(), currencyCode: z.string() })
  .meta({ id: "PublicTripPreview" });
export const PublicReputationSchema = z.object({ level: z.enum(["NEW", "CONFIRMED", "TOP"]), ratingsAvg: z.number(), ratingsCount: z.number().int(), completedDealsCount: z.number().int(), lateCancellationsCount: z.number().int() }).meta({ id: "PublicReputation" });
export const PublicUserProfileSchema = z
  .object({
    publicSlug: z.string(), firstName: z.string(), lastInitial: z.string(), avatarUrl: z.string().nullable(), memberSince: iso,
    location: z.object({ city: z.string().nullable(), country: z.string().nullable(), countryCode: z.string().nullable() }),
    stats: z.object({ tripsPublishedCount: z.number().int(), parcelsCarriedCount: z.number().int(), parcelsSentCount: z.number().int() }),
    tripperRating: z.object({ average: z.number(), count: z.number().int() }).nullable(),
    shipperRating: z.object({ average: z.number(), count: z.number().int() }),
    reputation: z.object({ carrier: PublicReputationSchema.nullable(), shipper: PublicReputationSchema }).optional(),
    tripper: z.object({ bio: z.string().nullable(), badges: z.object({ isVerified: z.boolean(), isSuperCarrier: z.boolean() }), topRoutes: z.array(z.object({ originCity: z.string(), destinationCity: z.string(), count: z.number().int() })), availableTripsPreview: z.array(PublicTripPreviewSchema), availableTripsCount: z.number().int(), reviewsPreview: z.array(PublicReviewSchema), reviewsCount: z.number().int() }).nullable(),
    shipper: z.object({ reviewsPreview: z.array(PublicReviewSchema), reviewsCount: z.number().int() }),
    follow: z.object({ followersCount: z.number().int(), followingCount: z.number().int(), isFollowedByMe: z.boolean().nullable(), notifyNextTrip: z.boolean().nullable() }),
    isOwnProfile: z.boolean(),
    isMe: z.boolean().optional(),
    hidden: z.boolean().optional(),
  })
  .meta({ id: "PublicUserProfile", description: "D28 / D29 / D67: location nulled when showCity is off; 404 to others when profilePublic is off (owner sees hidden: true)" });
export const PublicUserResponseSchema = z.object({ success: z.literal(true), user: PublicUserProfileSchema }).meta({ id: "PublicUserResponse" });
export const PublicReviewsResponseSchema = z.object({ success: z.literal(true), reviews: z.array(PublicReviewSchema), nextCursor: z.string().nullable() }).meta({ id: "PublicReviewsResponse" });
export const PublicTripsResponseSchema = z.object({ success: z.literal(true), trips: z.array(PublicTripPreviewSchema), nextCursor: z.string().nullable() }).meta({ id: "PublicTripsResponse" });
export const FollowPreferencesRequestSchema = z.object({ notifyNextTrip: z.boolean() }).meta({ id: "FollowPreferencesRequest" });
export const FollowResponseSchema = z.object({ success: z.literal(true), message: z.string().optional(), follow: z.object({ notifyNextTrip: z.boolean() }) }).meta({ id: "FollowResponse" });
export const FollowingResponseSchema = z
  .object({ success: z.literal(true), count: z.number().int(), following: z.array(z.object({ user: z.object({ publicSlug: z.string(), firstName: z.string(), lastInitial: z.string(), avatarUrl: z.string().nullable(), carrierRatingAvg: z.number().nullable().optional(), carrierRatingCount: z.number().int(), totalTripsPublished: z.number().int(), nextUpcomingTrip: PublicTripPreviewSchema.nullable() }).loose(), followedAt: iso, notifyNextTrip: z.boolean() })) })
  .meta({ id: "FollowingResponse", description: "Members with an upcoming trip first" });

/* ── Admin : connexion à deux étapes (D54) et réponses sans schéma dédié ── */
export const AdminLoginRequestSchema = z.object({ email: z.string().email(), password: z.string() }).meta({ id: "AdminLoginRequest" });
export const AdminLoginResponseSchema = z.object({ next: z.enum(["TOTP", "SETUP"]) }).meta({ id: "AdminLoginResponse", description: "admin_preauth cookie set; then totp/verify (TOTP) or totp/setup + totp/enable (SETUP)" });
export const AdminTotpSetupResponseSchema = z.object({ secret: z.string(), otpauthUrl: z.string() }).meta({ id: "AdminTotpSetupResponse" });
export const AdminTotpCodeRequestSchema = z.object({ code: z.string() }).meta({ id: "AdminTotpCodeRequest", description: "6-digit TOTP or a backup code (verify)" });
export const AdminTotpEnableResponseSchema = z.object({ ok: z.literal(true), backupCodes: z.array(z.string()) }).meta({ id: "AdminTotpEnableResponse", description: "Backup codes shown ONCE" });
export const AdminTotpVerifyResponseSchema = z.object({ ok: z.literal(true), usedBackupCode: z.boolean(), remainingBackupCodes: z.number().int() }).meta({ id: "AdminTotpVerifyResponse", description: "admin_access_token / admin_refresh_token cookies set" });
export const OkResponseSchema = z.object({ ok: z.literal(true) }).meta({ id: "OkResponse" });
export const AdminMeResponseSchema = z.object({ id: ObjectIdSchema, email: z.string(), firstName: z.string(), lastName: z.string(), adminRole: z.string().nullable(), adminRoles: z.array(z.string()), remainingBackupCodes: z.number().int() }).meta({ id: "AdminMeResponse" });
export const AdminAuditItemSchema = z.object({ id: ObjectIdSchema, at: iso, admin: z.string(), action: z.string(), targetType: z.string(), targetId: z.string().nullable(), before: z.unknown().nullable(), after: z.unknown().nullable(), ip: z.string().nullable() }).meta({ id: "AdminAuditItem" });
export const AdminAuditResponseSchema = z.object({ items: z.array(AdminAuditItemSchema), nextCursor: ObjectIdSchema.nullable() }).meta({ id: "AdminAuditResponse" });
export const InviteAdminResponseSchema = z.object({ ok: z.literal(true), userId: ObjectIdSchema, existingAccount: z.boolean(), expiresInHours: z.number().int().optional() }).meta({ id: "InviteAdminResponse" });
export const UpdateAdminRoleResponseSchema = z.object({ ok: z.literal(true), adminRoles: z.array(z.string()), adminRole: z.string().nullable() }).meta({ id: "UpdateAdminRoleResponse" });
export const SettingsHistoryItemSchema = z.object({ id: ObjectIdSchema, at: iso, admin: z.string(), action: z.string(), key: z.string().nullable(), before: z.number().nullable(), after: z.number().nullable(), reason: z.string().nullable(), version: z.number().int().nullable() }).meta({ id: "SettingsHistoryItem" });
export const SettingsHistoryResponseSchema = z.object({ items: z.array(SettingsHistoryItemSchema), nextCursor: ObjectIdSchema.nullable() }).meta({ id: "SettingsHistoryResponse" });
export const SuspensionProposedResponseSchema = z.object({ ok: z.literal(true), proposedAt: iso }).meta({ id: "SuspensionProposedResponse" });
export const SuspensionAppliedResponseSchema = z.object({ ok: z.literal(true), accountStatus: z.string(), at: iso.optional() }).meta({ id: "SuspensionAppliedResponse" });
