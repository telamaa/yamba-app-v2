
## auth-service — port 6001

Comptes, sessions, profils, alertes de route, signalements, back-office. Document vivant : `http://localhost:6001/docs` (Scalar) et `apps/auth-service/openapi.json`. Via le gateway : `http://localhost:8080/api` (préfixes ci-dessous).


### auth-service › auth

Registration (email OTP), login, Google, refresh, logout, password reset


#### `POST /auth/register`

**Start a registration — OTP sent by email**  
`operationId` : `register` · Authentification : aucune (public)

Consent (terms + privacy versions) is mandatory. The pending registration lives in Redis for 10 minutes. An existing email answers 409.

Corps (requis) : `MemberRegisterRequest`

| Code | Réponse |
|---|---|
| 200 | RegistrationStartedResponse — OTP sent |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 409 | ErrorResponse — Conflict (ConflictError) |
| 429 | ErrorResponse — Too many attempts — OTP lock (RateLimitError, security-alert email after 10 failures) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/register/verify`

**Verify the OTP and create the account**  
`operationId` : `verifyRegistration` · Authentification : aucune (public)

10 wrong codes lock the token for 30 minutes and send a security-alert email. On success: User + ConsentLog, welcome email.

Corps (requis) : `VerifyRegistrationRequest`

| Code | Réponse |
|---|---|
| 201 | SuccessMessageResponse — Done |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | ErrorResponse — Wrong or expired OTP |
| 429 | ErrorResponse — Too many attempts — OTP lock (RateLimitError, security-alert email after 10 failures) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/register/resend`

**Send the OTP again (same token)**  
`operationId` : `resendRegistrationOtp` · Authentification : aucune (public)

Corps (requis) : `VerificationTokenRequest`

| Code | Réponse |
|---|---|
| 200 | RegistrationStartedResponse — OTP sent again |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 404 | ErrorResponse — Not found (NotFoundError) |
| 429 | ErrorResponse — Too many attempts — OTP lock (RateLimitError, security-alert email after 10 failures) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/register/cancel`

**Cancel a pending registration**  
`operationId` : `cancelRegistration` · Authentification : aucune (public)

Corps (requis) : `VerificationTokenRequest`

| Code | Réponse |
|---|---|
| 200 | SuccessMessageResponse — Done |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/login`

**Login with email + password**  
`operationId` : `login` · Authentification : aucune (public)

Sets access_token and refresh_token cookies; rememberMe = 30-day refresh (A62). A session record (device, ip, user agent) is written (D65). Suspended account → 401.

Corps (requis) : `MemberLoginRequest`

| Code | Réponse |
|---|---|
| 200 | MemberLoginResponse — Logged in |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — Invalid credentials or suspended account |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/google`

**Sign in with Google (D47)**  
`operationId` : `googleSignIn` · Authentification : aucune (public)

Verifies the Google ID token. Existing email → linked; new account → needs consent, otherwise status CONSENT_REQUIRED without creating anything.

Corps (requis) : `GoogleSignInRequest`

| Code | Réponse |
|---|---|
| 200 | GoogleSignInResponse — Logged in, or consent required |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — Invalid Google token |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/refresh`

**Rotate the session (refresh cookie)**  
`operationId` : `refreshTokens` · Authentification : aucune (public)

Reads refresh_token, checks the jti in Redis, issues a new pair. The front replays queued requests after a 401 (api-client circuit breaker).

| Code | Réponse |
|---|---|
| 200 | SuccessMessageResponse — Done |
| 401 | UnauthorizedResponse — Refresh token missing, revoked or expired |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/logout`

**Logout — revokes the refresh jti and clears cookies**  
`operationId` : `logout` · Authentification : aucune (public)

| Code | Réponse |
|---|---|
| 200 | SuccessMessageResponse — Done |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/password/forgot`

**Password reset — send an OTP**  
`operationId` : `requestPasswordReset` · Authentification : aucune (public)

Always 200, never reveals whether the account exists.

Corps (requis) : `PasswordForgotRequest`

| Code | Réponse |
|---|---|
| 200 | MessageResponse — Sent if the account exists |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 429 | ErrorResponse — Too many attempts — OTP lock (RateLimitError, security-alert email after 10 failures) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/password/verify`

**Verify the reset OTP**  
`operationId` : `verifyPasswordReset` · Authentification : aucune (public)

Corps (requis) : `PasswordVerifyRequest`

| Code | Réponse |
|---|---|
| 200 | PasswordVerifyResponse — Verified — reset token |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | ErrorResponse — Wrong or expired OTP |
| 429 | ErrorResponse — Too many attempts — OTP lock (RateLimitError, security-alert email after 10 failures) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/password/resend`

**Send the reset OTP again**  
`operationId` : `resendPasswordReset` · Authentification : aucune (public)

Corps (requis) : `PasswordForgotRequest`

| Code | Réponse |
|---|---|
| 200 | MessageResponse — Sent if the account exists |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 429 | ErrorResponse — Too many attempts — OTP lock (RateLimitError, security-alert email after 10 failures) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/password/reset`

**Set the new password with the reset token**  
`operationId` : `resetPassword` · Authentification : aucune (public)

Password rules (length, no email inside). Other sessions are revoked; a passwordChanged email is sent.

Corps (requis) : `PasswordResetRequest`

| Code | Réponse |
|---|---|
| 200 | MessageResponse — Reset |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | ErrorResponse — Reset token invalid or expired |
| 500 | UnhandledError — Unhandled server error |


### auth-service › me

The authenticated member: profile, preferences, sessions, sudo, GDPR


#### `GET /auth/me`

**The authenticated member**  
`operationId` : `getMe` · Authentification : cookieAuth, bearerAuth

The User record without passwordHash, plus the effective roles.

| Code | Réponse |
|---|---|
| 200 | MeResponse — Member |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 500 | UnhandledError — Unhandled server error |


#### `PATCH /auth/me/locale`

**Set the preferred locale (D44) — email language**  
`operationId` : `updateMyLocale` · Authentification : cookieAuth, bearerAuth

Corps (requis) : `UpdateLocaleRequest`

| Code | Réponse |
|---|---|
| 200 | UpdateLocaleResponse — Saved |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 500 | UnhandledError — Unhandled server error |


#### `PATCH /auth/me/preferences`

**Preferences: reminder emails, locale, analytics consent (D66)**  
`operationId` : `updateMyPreferences` · Authentification : cookieAuth, bearerAuth

A change of analyticsOptIn is traced in ConsentLog (COOKIES).

Corps (requis) : `UpdateMyPreferencesRequest`

| Code | Réponse |
|---|---|
| 200 | PreferencesResponse — Saved |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/me/sudo/request`

**Sudo — send the code by email (D65 1A)**  
`operationId` : `requestSudoCode` · Authentification : cookieAuth, bearerAuth

| Code | Réponse |
|---|---|
| 200 | SuccessMessageResponse — Done |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 429 | ErrorResponse — Too many attempts — OTP lock (RateLimitError, security-alert email after 10 failures) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/me/sudo/verify`

**Sudo — open the 15-minute window for THIS session**  
`operationId` : `verifySudo` · Authentification : cookieAuth, bearerAuth

The window is bound to the refresh jti: another session of the same member does not inherit it.

Corps (requis) : `SudoVerifyRequest`

| Code | Réponse |
|---|---|
| 200 | SudoWindowResponse — Window open |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | ErrorResponse — Wrong or expired code |
| 429 | ErrorResponse — Too many attempts — OTP lock (RateLimitError, security-alert email after 10 failures) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /auth/me/sudo`

**Sudo — is the window open, until when**  
`operationId` : `getSudoStatus` · Authentification : cookieAuth, bearerAuth

| Code | Réponse |
|---|---|
| 200 | SudoStatus — Status |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /auth/me/sessions`

**Connected devices (D65 2A)**  
`operationId` : `listMySessions` · Authentification : cookieAuth, bearerAuth

| Code | Réponse |
|---|---|
| 200 | MemberSessionsResponse — Sessions, current first |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 500 | UnhandledError — Unhandled server error |


#### `DELETE /auth/me/sessions`

**Revoke every OTHER session**  
`operationId` : `revokeMyOtherSessions` · Authentification : cookieAuth, bearerAuth

| Code | Réponse |
|---|---|
| 200 | RevokeSessionResponse — Revoked count |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 500 | UnhandledError — Unhandled server error |


#### `DELETE /auth/me/sessions/{jti}`

**Revoke one session (current allowed — cookies cleared)**  
`operationId` : `revokeMySession` · Authentification : cookieAuth, bearerAuth

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `jti` | path | oui | string | Session id (refresh token jti) |

| Code | Réponse |
|---|---|
| 200 | RevokeSessionResponse — Revoked |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 404 | ErrorResponse — Not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/me/password`

**Change the password (sudo)**  
`operationId` : `changeMyPassword` · Authentification : cookieAuth, bearerAuth

Requires the sudo window (403 SUDO_REQUIRED). Other sessions revoked, passwordChanged email. A Google-only account sets its first password.

Corps (requis) : `ChangePasswordRequest`

| Code | Réponse |
|---|---|
| 200 | PasswordChangedResponse — Changed |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 403 | ErrorResponse — Forbidden — details.code = SUDO_REQUIRED when the sudo window is closed (D65) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/me/email/request`

**Change the email — code sent to the NEW address (sudo)**  
`operationId` : `requestEmailChange` · Authentification : cookieAuth, bearerAuth

Corps (requis) : `RequestEmailChange`

| Code | Réponse |
|---|---|
| 200 | EmailChangeRequestedResponse — Code sent |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 403 | ErrorResponse — Forbidden — details.code = SUDO_REQUIRED when the sudo window is closed (D65) |
| 409 | ErrorResponse — Email already used |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/me/email/confirm`

**Confirm the new email with the code**  
`operationId` : `confirmEmailChange` · Authentification : cookieAuth, bearerAuth

The old address is warned (emailChanged), other sessions are revoked.

Corps (requis) : `ConfirmEmailChange`

| Code | Réponse |
|---|---|
| 200 | EmailChangeConfirmedResponse — Changed |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | ErrorResponse — Wrong or expired code |
| 409 | ErrorResponse — Conflict (ConflictError) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/me/data-export`

**GDPR — download my data as JSON (sudo, D63 2A)**  
`operationId` : `exportMyData` · Authentification : cookieAuth, bearerAuth

Content-Disposition attachment; a DataRequest EXPORT is written.

| Code | Réponse |
|---|---|
| 200 | DataExport — JSON export |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 403 | ErrorResponse — Forbidden — details.code = SUDO_REQUIRED when the sudo window is closed (D65) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /auth/me/erasure/blockers`

**GDPR — what prevents erasure right now (D63 3A)**  
`operationId` : `getMyErasureBlockers` · Authentification : cookieAuth, bearerAuth

| Code | Réponse |
|---|---|
| 200 | objet { blockers, counts } — Blockers (empty = erasable) |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/me/erasure`

**GDPR — erase my account now (sudo, D63 3A)**  
`operationId` : `eraseMyAccount` · Authentification : cookieAuth, bearerAuth

ONE transaction anonymising the User field by field; bookings, disputes, reviews and messages are kept. 409 ERASURE_BLOCKED with the closed list of blockers.

Corps (requis) : `EraseMyAccountRequest`

| Code | Réponse |
|---|---|
| 200 | ErasedResponse — Erased — session ended |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 403 | ErrorResponse — Forbidden — details.code = SUDO_REQUIRED when the sudo window is closed (D65) |
| 409 | ErasureBlockedResponse — Blocked by a live deal |
| 500 | UnhandledError — Unhandled server error |


#### `GET /auth/me/profile`

**My editable profile (D67)**  
`operationId` : `getMyProfile` · Authentification : cookieAuth, bearerAuth

| Code | Réponse |
|---|---|
| 200 | MyProfileResponse — Profile |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 500 | UnhandledError — Unhandled server error |


#### `PATCH /auth/me/profile`

**Update names, birth date, carrier display name / bio, visibilities (D67 1A)**  
`operationId` : `updateMyProfile` · Authentification : cookieAuth, bearerAuth

Errors per field in details.errors (INVALID_DATE, IN_THE_FUTURE, TOO_YOUNG, NO_CARRIER_PAGE). The public slug never changes.

Corps (requis) : `UpdateMyProfileRequest`

| Code | Réponse |
|---|---|
| 200 | MyProfileResponse — Saved |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/me/avatar`

**Declare the avatar uploaded to ImageKit (D67 2A)**  
`operationId` : `setMyAvatar` · Authentification : cookieAuth, bearerAuth

The URL must belong to IMAGEKIT_URL_ENDPOINT; the previous file is deleted.

Corps (requis) : `SetMyAvatarRequest`

| Code | Réponse |
|---|---|
| 200 | MyProfileResponse — Saved |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 500 | UnhandledError — Unhandled server error |


#### `DELETE /auth/me/avatar`

**Remove the avatar**  
`operationId` : `deleteMyAvatar` · Authentification : cookieAuth, bearerAuth

| Code | Réponse |
|---|---|
| 200 | MyProfileResponse — Removed |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 500 | UnhandledError — Unhandled server error |


### auth-service › reports

Report a trip or a member (D68)


#### `POST /reports`

**Report a trip or a member (D68 1A)**  
`operationId` : `createReport` · Authentification : cookieAuth, bearerAuth

targetRef = trip id or member public slug. 400 OWN_TARGET / REASON_NOT_ALLOWED, 404 invisible target (deleted trip, erased member, hidden page), 409 open duplicate. Acknowledgement email to the reporter; the target never learns who reported.

Corps (requis) : `CreateReportRequest`

| Code | Réponse |
|---|---|
| 201 | CreateReportResponse — Recorded |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 404 | ErrorResponse — Not found (NotFoundError) |
| 409 | ErrorResponse — Conflict (ConflictError) |
| 500 | UnhandledError — Unhandled server error |


### auth-service › carrier

Carrier onboarding and Stripe Connect


#### `POST /carrier/onboarding/profile`

**Carrier onboarding — step PROFILE**  
`operationId` : `saveCarrierProfile` · Authentification : cookieAuth, bearerAuth

Creates or updates the CarrierPage (name, bio, phone, primary address).

Corps (requis) : `CarrierProfileRequest`

| Code | Réponse |
|---|---|
| 200 | CarrierProfileResponse — Saved |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /carrier/onboarding/stripe`

**Carrier onboarding — Stripe Connect account link**  
`operationId` : `createStripeConnectLink` · Authentification : cookieAuth, bearerAuth

Creates the Express account on first call; returns a single-use onboarding URL.

| Code | Réponse |
|---|---|
| 200 | StripeLinkResponse — Onboarding URL |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /carrier/onboarding/stripe/status`

**Stripe account status (charges / payouts)**  
`operationId` : `getStripeStatus` · Authentification : cookieAuth, bearerAuth

| Code | Réponse |
|---|---|
| 200 | StripeStatusResponse — Status |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /carrier/onboarding/complete`

**Carrier onboarding — complete**  
`operationId` : `completeCarrierOnboarding` · Authentification : cookieAuth, bearerAuth

Grants the CARRIER role and sends the onboarding-complete email.

| Code | Réponse |
|---|---|
| 200 | SuccessMessageResponse — Done |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /carrier/stripe/dashboard-link`

**Stripe Express dashboard link (sudo, A84)**  
`operationId` : `createStripeDashboardLink` · Authentification : cookieAuth, bearerAuth

| Code | Réponse |
|---|---|
| 200 | StripeLinkResponse — Dashboard URL |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 403 | ErrorResponse — Forbidden — details.code = SUDO_REQUIRED when the sudo window is closed (D65) |
| 409 | ErrorResponse — No Stripe account yet |
| 500 | UnhandledError — Unhandled server error |


### auth-service › saved-routes

Route alerts (max 20 per member, 6-month expiry)


#### `POST /saved-routes`

**Create a route alert (6-month expiry)**  
`operationId` : `createSavedRoute` · Authentification : cookieAuth, bearerAuth

Corps (requis) : `SavedRouteRequest`

| Code | Réponse |
|---|---|
| 201 | SavedRouteResponse — Created |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 409 | ErrorResponse — Limit of 20 alerts reached |
| 500 | UnhandledError — Unhandled server error |


#### `GET /saved-routes`

**My route alerts**  
`operationId` : `listSavedRoutes` · Authentification : cookieAuth, bearerAuth

| Code | Réponse |
|---|---|
| 200 | SavedRoutesResponse — Alerts |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 500 | UnhandledError — Unhandled server error |


#### `PATCH /saved-routes/{id}`

**Update a route alert**  
`operationId` : `updateSavedRoute` · Authentification : cookieAuth, bearerAuth

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Saved route id |

Corps (requis) : `SavedRouteRequest`

| Code | Réponse |
|---|---|
| 200 | SavedRouteResponse — Updated |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 404 | ErrorResponse — Not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `DELETE /saved-routes/{id}`

**Delete a route alert**  
`operationId` : `deleteSavedRoute` · Authentification : cookieAuth, bearerAuth

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Saved route id |

| Code | Réponse |
|---|---|
| 200 | SuccessMessageResponse — Done |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 404 | ErrorResponse — Not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /saved-routes/{id}/extend`

**Extend a route alert by 6 months**  
`operationId` : `extendSavedRoute` · Authentification : cookieAuth, bearerAuth

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Saved route id |

| Code | Réponse |
|---|---|
| 200 | SavedRouteResponse — Extended |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 404 | ErrorResponse — Not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


### auth-service › users

Public profiles and follows


#### `GET /users/{slug}/public`

**Public profile (D28 / D29 / D67)**  
`operationId` : `getUserPublic` · Authentification : aucune (public)

Optional auth (follow state). 404 when the member is erased or has hidden the page — unless the caller is the owner (hidden: true).

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `slug` | path | oui | string | Member public slug (immutable, D28) |

| Code | Réponse |
|---|---|
| 200 | PublicUserResponse — Profile |
| 404 | ErrorResponse — Not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /users/{slug}/public/reviews`

**Revealed reviews of a member, paginated**  
`operationId` : `listUserPublicReviews` · Authentification : aucune (public)

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `slug` | path | oui | string | Member public slug (immutable, D28) |
| `kind` | query | non | string | Role reviewed |
| `limit` | query | non | integer | Page size |
| `cursor` | query | non | ObjectId | Id of the last item of the previous page |

| Code | Réponse |
|---|---|
| 200 | PublicReviewsResponse — Reviews |
| 404 | ErrorResponse — Not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /users/{slug}/public/trips`

**Upcoming published trips of a carrier, paginated**  
`operationId` : `listUserPublicTrips` · Authentification : aucune (public)

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `slug` | path | oui | string | Member public slug (immutable, D28) |
| `limit` | query | non | integer | Page size |
| `cursor` | query | non | ObjectId | Id of the last item of the previous page |

| Code | Réponse |
|---|---|
| 200 | PublicTripsResponse — Trips |
| 404 | ErrorResponse — Not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /users/{slug}/follow`

**Follow a member (D46)**  
`operationId` : `followUser` · Authentification : cookieAuth, bearerAuth

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `slug` | path | oui | string | Member public slug (immutable, D28) |

Corps (facultatif) : `FollowPreferencesRequest`

| Code | Réponse |
|---|---|
| 200 | FollowResponse — Followed |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 404 | ErrorResponse — Not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `DELETE /users/{slug}/follow`

**Unfollow**  
`operationId` : `unfollowUser` · Authentification : cookieAuth, bearerAuth

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `slug` | path | oui | string | Member public slug (immutable, D28) |

| Code | Réponse |
|---|---|
| 200 | SuccessMessageResponse — Done |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 404 | ErrorResponse — Not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `PATCH /users/{slug}/follow`

**Follow preferences — notify on next trip**  
`operationId` : `updateFollowPreferences` · Authentification : cookieAuth, bearerAuth

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `slug` | path | oui | string | Member public slug (immutable, D28) |

Corps (requis) : `FollowPreferencesRequest`

| Code | Réponse |
|---|---|
| 200 | FollowResponse — Saved |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 404 | ErrorResponse — Not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /me/following`

**Members I follow — those with an upcoming trip first**  
`operationId` : `listMyFollowing` · Authentification : cookieAuth, bearerAuth

| Code | Réponse |
|---|---|
| 200 | FollowingResponse — Following |
| 401 | UnauthorizedResponse — Missing, invalid or expired token; suspended account (isAuthenticated) |
| 500 | UnhandledError — Unhandled server error |


### auth-service › admin-auth

ADMIN two-step login (password + TOTP), sessions, invitations


#### `POST /auth/admin/login`

**ADMIN login step 1 — password**  
`operationId` : `adminLogin` · Authentification : aucune (public)

Requires User.adminRoles. Sets the admin_preauth cookie (5 min); next = TOTP or SETUP.

Corps (requis) : `AdminLoginRequest`

| Code | Réponse |
|---|---|
| 200 | AdminLoginResponse — Pre-authenticated |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — Invalid credentials or not an admin |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/admin/totp/setup`

**TOTP setup — secret and otpauth URL (pre-auth cookie)**  
`operationId` : `adminTotpSetup` · Authentification : aucune (public)

| Code | Réponse |
|---|---|
| 200 | AdminTotpSetupResponse — Secret |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/admin/totp/enable`

**TOTP enable — first code, returns the backup codes ONCE**  
`operationId` : `adminTotpEnable` · Authentification : aucune (public)

Corps (requis) : `AdminTotpCodeRequest`

| Code | Réponse |
|---|---|
| 200 | AdminTotpEnableResponse — Enabled |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/admin/totp/verify`

**ADMIN login step 2 — TOTP or backup code**  
`operationId` : `adminTotpVerify` · Authentification : aucune (public)

Opens the ADMIN session: admin_access_token / admin_refresh_token cookies (claims adm + amr pwd,totp).

Corps (requis) : `AdminTotpCodeRequest`

| Code | Réponse |
|---|---|
| 200 | AdminTotpVerifyResponse — Session open |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 429 | ErrorResponse — Too many attempts — OTP lock (RateLimitError, security-alert email after 10 failures) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/admin/refresh`

**Rotate the ADMIN session**  
`operationId` : `adminRefresh` · Authentification : aucune (public)

| Code | Réponse |
|---|---|
| 200 | OkResponse — Done |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/admin/logout`

**ADMIN logout**  
`operationId` : `adminLogout` · Authentification : aucune (public)

| Code | Réponse |
|---|---|
| 200 | OkResponse — Done |
| 500 | UnhandledError — Unhandled server error |


#### `POST /auth/admin/invite/accept`

**Accept an admin invitation (public token, D56)**  
`operationId` : `acceptAdminInvite` · Authentification : aucune (public)

Sets the password of the invited account; the token is single-use and expires.

Corps (requis) : `AcceptAdminInviteRequest`

| Code | Réponse |
|---|---|
| 200 | objet { ok, email } — Accepted |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 404 | ErrorResponse — Not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /admin/me`

**The ADMIN account and its profiles**  
`operationId` : `getAdminMe` · Authentification : adminCookieAuth · Permission admin : `(session)`

| Code | Réponse |
|---|---|
| 200 | AdminMeResponse — Admin |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /admin/me/sessions`

**ADMIN sessions**  
`operationId` : `listAdminSessions` · Authentification : adminCookieAuth · Permission admin : `(session)`

| Code | Réponse |
|---|---|
| 200 | objet { items } — Sessions |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 500 | UnhandledError — Unhandled server error |


#### `DELETE /admin/me/sessions/{jti}`

**Revoke one ADMIN session**  
`operationId` : `revokeAdminSession` · Authentification : adminCookieAuth · Permission admin : `(session)`

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `jti` | path | oui | string | Session id (refresh token jti) |

| Code | Réponse |
|---|---|
| 200 | OkResponse — Done |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 500 | UnhandledError — Unhandled server error |


### auth-service › admin

Back-office: KPIs, pilotage, audit, settings, status, maintenance, admins, users, privacy, reports


#### `GET /admin/kpis`

**Home counters (D57) — null = not visible to this profile**  
`operationId` : `getAdminKpis` · Authentification : adminCookieAuth · Permission admin : `kpi.read`

| Code | Réponse |
|---|---|
| 200 | AdminHomeKpis — KPIs |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /admin/pilotage/series`

**Pilotage series (D59, 60 s Redis cache)**  
`operationId` : `getPilotageSeries` · Authentification : adminCookieAuth · Permission admin : `pilotage.read`

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `granularity` | query | non | string | Default week |
| `months` | query | non | integer | Window (default 3 for week, 12 for month) |

| Code | Réponse |
|---|---|
| 200 | PilotageSeriesResponse — Series |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /admin/pilotage/corridors`

**Corridors — demand vs supply (D59)**  
`operationId` : `getPilotageCorridors` · Authentification : adminCookieAuth · Permission admin : `pilotage.read`

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `days` | query | non | integer | Window, default 30 |

| Code | Réponse |
|---|---|
| 200 | CorridorsResponse — Corridors |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /admin/pilotage/drilldown`

**Drilldown of one point of a series (D60 3A, journaled)**  
`operationId` : `getPilotageDrilldown` · Authentification : adminCookieAuth · Permission admin : `pilotage.read`

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `metric` | query | oui | PilotageMetric | Metric |
| `granularity` | query | non | string | Default week |
| `period` | query | oui | string | Period key of the series point |

| Code | Réponse |
|---|---|
| 200 | PilotageDrilldownResponse — Items |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /admin/audit`

**Admin journal, newest first**  
`operationId` : `listAdminAudit` · Authentification : adminCookieAuth · Permission admin : `audit.read`

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `cursor` | query | non | ObjectId | Id of the last item of the previous page |

| Code | Réponse |
|---|---|
| 200 | AdminAuditResponse — Journal page |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /admin/settings`

**Platform settings + catalogue (D62)**  
`operationId` : `getSettings` · Authentification : adminCookieAuth · Permission admin : `settings.read`

| Code | Réponse |
|---|---|
| 200 | AdminSettingsResponse — Settings |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 500 | UnhandledError — Unhandled server error |


#### `PATCH /admin/settings`

**Change settings (D62 5A)**  
`operationId` : `updateSettings` · Authentification : adminCookieAuth · Permission admin : `settings.read + per-key scope`

Reason ≥ 20 chars, optimistic version. Scope enforced per key in the service: BUSINESS = SUPER_ADMIN, OPERATIONS = OPS. One SETTING_CHANGED journal line per key, email to every SUPER_ADMIN. Never retroactive.

Corps (requis) : `UpdateSettingsRequest`

| Code | Réponse |
|---|---|
| 200 | SettingsWriteResponse — Changed |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 409 | ErrorResponse — Version conflict |
| 500 | UnhandledError — Unhandled server error |


#### `GET /admin/settings/history`

**Settings change history**  
`operationId` : `getSettingsHistory` · Authentification : adminCookieAuth · Permission admin : `settings.read`

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `key` | query | non | string | Filter on one key |
| `cursor` | query | non | ObjectId | Id of the last item of the previous page |

| Code | Réponse |
|---|---|
| 200 | SettingsHistoryResponse — History |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /admin/settings/reset`

**Reset settings to the catalogue defaults (SETTINGS_RESET)**  
`operationId` : `resetSettings` · Authentification : adminCookieAuth · Permission admin : `settings.read + per-key scope`

Corps (requis) : `ResetSettingsRequest`

| Code | Réponse |
|---|---|
| 200 | SettingsWriteResponse — Reset |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 409 | ErrorResponse — Conflict (ConflictError) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /admin/status`

**Service status page (D64 5A) — not a monitoring tool**  
`operationId` : `getAdminStatus` · Authentification : adminCookieAuth · Permission admin : `status.read`

| Code | Réponse |
|---|---|
| 200 | AdminStatusResponse — Status |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /admin/maintenance`

**Planned maintenance state (D64 1A)**  
`operationId` : `getMaintenance` · Authentification : adminCookieAuth · Permission admin : `status.read`

| Code | Réponse |
|---|---|
| 200 | MaintenanceState — State |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 500 | UnhandledError — Unhandled server error |


#### `PUT /admin/maintenance`

**Switch the read-only mode (journaled, SUPER_ADMINs emailed)**  
`operationId` : `updateMaintenance` · Authentification : adminCookieAuth · Permission admin : `maintenance.write`

Corps (requis) : `UpdateMaintenanceRequest`

| Code | Réponse |
|---|---|
| 200 | MaintenanceState — State |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /admin/admins`

**Admin accounts**  
`operationId` : `listAdmins` · Authentification : adminCookieAuth · Permission admin : `admins.manage`

| Code | Réponse |
|---|---|
| 200 | objet { items } — Admins |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /admin/admins/invite`

**Invite an admin (D56) — email with a single-use token**  
`operationId` : `inviteAdmin` · Authentification : adminCookieAuth · Permission admin : `admins.manage`

Corps (requis) : `InviteAdminRequest`

| Code | Réponse |
|---|---|
| 200 | InviteAdminResponse — Existing account: roles granted |
| 201 | InviteAdminResponse — Invited |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 500 | UnhandledError — Unhandled server error |


#### `PATCH /admin/admins/{id}`

**Change the profiles of an admin (D60 1A: union of permissions)**  
`operationId` : `updateAdminRole` · Authentification : adminCookieAuth · Permission admin : `admins.manage`

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | User id |

Corps (requis) : `UpdateAdminRoleRequest`

| Code | Réponse |
|---|---|
| 200 | UpdateAdminRoleResponse — Updated |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 404 | ErrorResponse — Not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `DELETE /admin/admins/{id}`

**Revoke the admin profiles (sessions revoked)**  
`operationId` : `revokeAdmin` · Authentification : adminCookieAuth · Permission admin : `admins.manage`

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | User id |

| Code | Réponse |
|---|---|
| 200 | OkResponse — Done |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 404 | ErrorResponse — Not found (NotFoundError) |
| 409 | ErrorResponse — Last SUPER_ADMIN or yourself |
| 500 | UnhandledError — Unhandled server error |


#### `GET /admin/users`

**Search members (D60 2A)**  
`operationId` : `searchAdminUsers` · Authentification : adminCookieAuth · Permission admin : `users.read`

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `q` | query | non | string | Name, email, phone |
| `role` | query | non | string | Role |
| `accountStatus` | query | non | AccountStatus | Sanction status |
| `carrierStatus` | query | non | string | Carrier status |
| `stripeReady` | query | non | string | Connect with payouts enabled |
| `createdFrom` | query | non | string | Created after |
| `createdTo` | query | non | string | Created before |
| `sort` | query | non | string | Sort |
| `dir` | query | non | string | Direction |
| `cursor` | query | non | ObjectId | Id of the last item of the previous page |
| `limit` | query | non | integer | Page size (50) |

| Code | Réponse |
|---|---|
| 200 | AdminUsersResponse — Page |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /admin/users/export`

**CSV export of members (SUPER_ADMIN or PRIVACY, reason ≥ 20, journaled EXPORTED)**  
`operationId` : `exportAdminUsers` · Authentification : adminCookieAuth · Permission admin : `exports.personal`

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `reason` | query | oui | string | Why this export |

| Code | Réponse |
|---|---|
| 200 | string — text/csv (BOM, RFC 4180, formula prefixes neutralised) |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /admin/users/{id}`

**Member file**  
`operationId` : `getAdminUserFile` · Authentification : adminCookieAuth · Permission admin : `users.read`

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | User id |

| Code | Réponse |
|---|---|
| 200 | AdminUserFile — File |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 404 | ErrorResponse — Not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /admin/users/{id}/suspension/propose`

**Propose a sanction (SUPPORT / MEDIATOR)**  
`operationId` : `proposeSuspension` · Authentification : adminCookieAuth · Permission admin : `users.suspension.propose`

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | User id |

Corps (requis) : `ProposeSuspensionRequest`

| Code | Réponse |
|---|---|
| 200 | SuspensionProposedResponse — Proposed |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 404 | ErrorResponse — Not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /admin/users/{id}/suspension`

**Apply RESTRICTED or SUSPENDED (SUPER_ADMIN) — effective through reads only**  
`operationId` : `applySuspension` · Authentification : adminCookieAuth · Permission admin : `users.suspension.apply`

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | User id |

Corps (requis) : `ApplySuspensionRequest`

| Code | Réponse |
|---|---|
| 200 | SuspensionAppliedResponse — Applied |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 404 | ErrorResponse — Not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `DELETE /admin/users/{id}/suspension`

**Lift the sanction**  
`operationId` : `liftSuspension` · Authentification : adminCookieAuth · Permission admin : `users.suspension.apply`

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | User id |

Corps (facultatif) : `LiftSuspensionRequest`

| Code | Réponse |
|---|---|
| 200 | SuspensionAppliedResponse — Lifted (ACTIVE) |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 404 | ErrorResponse — Not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `DELETE /admin/users/{id}/email-suppression`

**Lift an email suppression after a bounce / complaint (D35 4A, journaled)**  
`operationId` : `unsuppressEmail` · Authentification : adminCookieAuth · Permission admin : `users.email.unsuppress`

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | User id |

| Code | Réponse |
|---|---|
| 200 | OkResponse — Done |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 404 | ErrorResponse — Not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /admin/users/{id}/erase`

**GDPR — erase a member on request (D63 6A, PRIVACY)**  
`operationId` : `adminEraseUser` · Authentification : adminCookieAuth · Permission admin : `users.erase`

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | User id |

Corps (requis) : `AdminEraseUserRequest`

| Code | Réponse |
|---|---|
| 200 | ErasedResponse — Erased |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 404 | ErrorResponse — Not found (NotFoundError) |
| 409 | ErasureBlockedResponse — Blocked by a live deal |
| 500 | UnhandledError — Unhandled server error |


#### `GET /admin/privacy/requests`

**GDPR requests register (exports, erasures) — journaled read**  
`operationId` : `listDataRequests` · Authentification : adminCookieAuth · Permission admin : `privacy.requests.read`

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `cursor` | query | non | ObjectId | Id of the last item of the previous page |

| Code | Réponse |
|---|---|
| 200 | DataRequestsResponse — Requests |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /admin/reports`

**Reported trips and members (D68 3A) — priority from 3 open reports on a target**  
`operationId` : `listAdminReports` · Authentification : adminCookieAuth · Permission admin : `reports.review`

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `status` | query | non | ReportStatus | Default OPEN |

| Code | Réponse |
|---|---|
| 200 | AdminReportsResponse — Queue |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 500 | UnhandledError — Unhandled server error |


#### `PATCH /admin/reports/{id}`

**Decide on a report — REVIEWED / DISMISSED, journaled (no automatic sanction)**  
`operationId` : `reviewAdminReport` · Authentification : adminCookieAuth · Permission admin : `reports.review`

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Report id |

Corps (requis) : `ReviewReportRequest`

| Code | Réponse |
|---|---|
| 200 | objet { id, status } — Decided |
| 400 | ErrorResponse — Invalid request (ValidationError — details.errors per field when available) |
| 401 | UnauthorizedResponse — No ADMIN session: admin_access_token missing, expired or without amr pwd+totp (isAdminAuthenticated) |
| 403 | ErrorResponse — The ADMIN profile lacks the route permission (requireAdminPermission, ADMIN_PERMISSIONS matrix) |
| 404 | ErrorResponse — Not found (NotFoundError) |
| 409 | ErrorResponse — Already reviewed |
| 500 | UnhandledError — Unhandled server error |


### auth-service › schémas utilisés (129)


**`AcceptAdminInviteRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `token` | string | oui |  |
| `password` | string | oui |  |


**`AccountStatus`** — enum : `ACTIVE`, `RESTRICTED`, `SUSPENDED`


**`AdminAccount`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `firstName` | string | oui |  |
| `lastName` | string | oui |  |
| `email` | string | oui |  |
| `adminRole` | AdminRole | oui |  |
| `adminRoles` | array<AdminRole> | oui |  |
| `totpEnabled` | boolean | oui |  |
| `inviteAccepted` | boolean | oui | false while the invited account has no password yet |
| `createdAt` | string (date-time) | oui |  |


**`AdminAuditItem`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `at` | string (date-time) | oui |  |
| `admin` | string | oui |  |
| `action` | string | oui |  |
| `targetType` | string | oui |  |
| `targetId` | string \| null | oui |  |
| `before` | null \| null | oui |  |
| `after` | null \| null | oui |  |
| `ip` | string \| null | oui |  |


**`AdminAuditResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `items` | array<AdminAuditItem> | oui |  |
| `nextCursor` | ObjectId \| null | oui |  |


**`AdminEraseUserRequest`** — Erasure on behalf of a member (request received by email) — PRIVACY or SUPER_ADMIN, journaled

| Champ | Type | Requis | Description |
|---|---|---|---|
| `reason` | string | oui |  |


**`AdminHomeKpis`** — Operational counters; null = not visible to this profile (D57)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `disputesToDecide` | integer \| null | oui |  |
| `retentionsHeld` | integer \| null | oui |  |
| `ticketsToVerify` | integer \| null | oui |  |
| `hiddenTrips` | integer \| null | oui |  |
| `hideProposals` | integer \| null | oui |  |
| `suspensionProposals` | integer \| null | oui |  |
| `restrictedUsers` | integer \| null | oui |  |
| `suspendedUsers` | integer \| null | oui |  |
| `publishedTrips` | integer \| null | oui |  |
| `activeDeals` | integer \| null | oui |  |
| `payoutsFailed` | integer \| null | oui |  |
| `payoutsReversed` | integer \| null | oui |  |
| `manualRefundProposals` | integer \| null | oui |  |
| `pendingAdminInvites` | integer \| null | oui |  |
| `usersTotal` | integer \| null | oui |  |
| `completedDeals30d` | integer \| null | oui |  |
| `messageReportsOpen` | integer \| null | non |  |
| `reportsOpen` | integer \| null | non |  |
| `generatedAt` | string (date-time) | oui |  |


**`AdminLoginRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `email` | string (email) | oui |  |
| `password` | string | oui |  |


**`AdminLoginResponse`** — admin_preauth cookie set; then totp/verify (TOTP) or totp/setup + totp/enable (SETUP)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `next` | enum : TOTP, SETUP | oui |  |


**`AdminMeResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `email` | string | oui |  |
| `firstName` | string | oui |  |
| `lastName` | string | oui |  |
| `adminRole` | string \| null | oui |  |
| `adminRoles` | array<string> | oui |  |
| `remainingBackupCodes` | integer | oui |  |


**`AdminReportItem`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | string | oui |  |
| `targetType` | ReportTargetType | oui |  |
| `targetId` | string | oui |  |
| `targetLabel` | string | oui |  |
| `targetOwner` | object \| null | oui |  |
| `status` | ReportStatus | oui |  |
| `reason` | ReportReason | oui |  |
| `details` | string \| null | oui |  |
| `createdAt` | string (date-time) | oui |  |
| `reporter` | object | oui |  |
| `openCountOnTarget` | integer | oui |  |
| `priority` | boolean | oui |  |
| `targetTrustLevel` | TrustLevel \| null | oui |  |


**`AdminReportsResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `items` | array<AdminReportItem> | oui |  |
| `total` | integer | oui |  |


**`AdminRole`** — enum : `SUPER_ADMIN`, `MEDIATOR`, `SUPPORT`, `FINANCE`, `OPS`, `PRIVACY`


**`AdminRoles`** — array : Profils cumulés d'un compte admin (au moins un) — l'union des permissions ; normalisés côté serveur (ordre canonique, doublons ignorés)


**`AdminSessionItem`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `jti` | string | oui |  |
| `createdAt` | string (date-time) | oui |  |
| `lastActivityAt` | string (date-time) | oui |  |
| `current` | boolean | oui |  |


**`AdminSettingsResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `values` | PlatformSettingsValues | oui |  |
| `defaults` | PlatformSettingsValues | oui |  |
| `version` | integer | oui |  |
| `updatedAt` | string \| null | oui |  |
| `updatedBy` | object \| null | oui |  |
| `lastChange` | SettingsLastChange \| null | oui |  |
| `catalog` | array<SettingDefinition> | oui |  |
| `fixed` | array<objet { key, label, value, rule }> | oui |  |
| `planned` | array<objet { key, rule }> | oui |  |


**`AdminStatusResponse`** — Service status page (D64 5A) — not a monitoring tool

| Champ | Type | Requis | Description |
|---|---|---|---|
| `at` | string (date-time) | oui |  |
| `services` | array<ServiceStatus> | oui |  |
| `crons` | array<CronRun> | oui |  |
| `outbox` | object | oui |  |
| `emails` | object | oui |  |
| `maintenance` | MaintenanceState | oui |  |


**`AdminTotpCodeRequest`** — 6-digit TOTP or a backup code (verify)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `code` | string | oui |  |


**`AdminTotpEnableResponse`** — Backup codes shown ONCE

| Champ | Type | Requis | Description |
|---|---|---|---|
| `ok` | boolean | oui |  |
| `backupCodes` | array<string> | oui |  |


**`AdminTotpSetupResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `secret` | string | oui |  |
| `otpauthUrl` | string | oui |  |


**`AdminTotpVerifyResponse`** — admin_access_token / admin_refresh_token cookies set

| Champ | Type | Requis | Description |
|---|---|---|---|
| `ok` | boolean | oui |  |
| `usedBackupCode` | boolean | oui |  |
| `remainingBackupCodes` | integer | oui |  |


**`AdminUserFile`** — Everything an operator needs on a user — never a secret, never a delivery code

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `firstName` | string | oui |  |
| `lastName` | string | oui |  |
| `email` | string | oui |  |
| `phoneE164` | string \| null | oui |  |
| `preferredLocale` | string | oui |  |
| `emailSuppression` | object \| null | oui |  |
| `roles` | array<string> | oui |  |
| `adminRole` | AdminRole \| null | oui |  |
| `adminRoles` | array<AdminRole> | oui |  |
| `accountStatus` | AccountStatus | oui |  |
| `suspension` | object \| null | oui |  |
| `suspensionProposal` | object \| null | oui |  |
| `createdAt` | string (date-time) | oui |  |
| `isDeleted` | boolean | oui |  |
| `isMe` | boolean | oui | The admin reading the file IS this user (conflict of interest guard) |
| `carrier` | object \| null | oui |  |
| `shipper` | object | oui |  |
| `activity` | object | oui |  |
| `adminActions` | array<objet { id, at, admin, action, after }> | oui |  |
| `trust` | TrustAssessment \| null | oui |  |


**`AdminUserSummary`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `firstName` | string | oui |  |
| `lastName` | string | oui |  |
| `email` | string | oui |  |
| `phoneE164` | string \| null | oui |  |
| `roles` | array<string> | oui |  |
| `adminRole` | AdminRole \| null | oui |  |
| `adminRoles` | array<AdminRole> | oui |  |
| `accountStatus` | AccountStatus | oui |  |
| `carrierStatus` | string | oui |  |
| `createdAt` | string (date-time) | oui |  |
| `matchedOn` | string \| null | oui | What the search matched: email / name / phone / dealId / ticket |


**`AdminUsersResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `items` | array<AdminUserSummary> | oui |  |
| `total` | integer | oui |  |
| `nextCursor` | string \| null | non | C-PR7a — id du dernier élément ; absent = fin |


**`ApplySuspensionRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `level` | enum : RESTRICTED, SUSPENDED | oui |  |
| `reason` | string | oui |  |
| `until` | string (date-time) | non | Optional end; absent = until lifted |


**`CarrierPageDto`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `userId` | ObjectId | oui |  |
| `name` | string | oui |  |
| `bio` | string \| null | oui |  |
| `phoneE164` | string \| null | oui |  |
| `onboardingStep` | string | oui |  |
| `stripeOnboardingComplete` | boolean | oui |  |
| `stripeChargesEnabled` | boolean | oui |  |
| `stripePayoutsEnabled` | boolean | oui |  |
| `isVerified` | boolean | oui |  |
| `isSuperCarrier` | boolean | oui |  |


**`CarrierProfileRequest`** — Step PROFILE of the carrier onboarding

| Champ | Type | Requis | Description |
|---|---|---|---|
| `name` | string | oui |  |
| `bio` | string \| null | non |  |
| `phoneE164` | string \| null | non |  |
| `address` | object | non |  |


**`CarrierProfileResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `message` | string | oui |  |
| `carrierPage` | CarrierPageDto | oui |  |


**`ChangePasswordRequest`** — Under sudo (D65 3A); every other session is revoked

| Champ | Type | Requis | Description |
|---|---|---|---|
| `newPassword` | string | oui |  |


**`ConfirmEmailChange`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `code` | string | oui |  |


**`CorridorStat`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `key` | string | oui | ville>ville normalisées |
| `originCity` | string | oui |  |
| `originCountryCode` | string \| null | oui |  |
| `destinationCity` | string | oui |  |
| `destinationCountryCode` | string \| null | oui |  |
| `tripsPublished` | integer | oui |  |
| `requests` | integer | oui |  |
| `accepted` | integer | oui |  |
| `acceptanceRatePct` | number \| null | oui |  |
| `avgPricePerKgCents` | integer \| null | oui |  |
| `currencyCode` | string \| null | oui |  |
| `disputes` | integer | oui |  |
| `views` | integer | oui | Vues des pages de trajets du corridor sur la période (Redis) |
| `searches` | integer | oui | Recherches sur ce corridor (Redis) |
| `searchesNoResult` | integer | oui | Recherches sans aucun trajet (Redis) — demande sans offre |


**`CorridorsResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `periodDays` | integer | oui |  |
| `from` | string (date-time) | oui |  |
| `items` | array<CorridorStat> | oui |  |
| `generatedAt` | string (date-time) | oui |  |
| `cached` | boolean | oui |  |


**`CreateReportRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `targetType` | ReportTargetType | oui |  |
| `targetRef` | string | oui |  |
| `reason` | ReportReason | oui |  |
| `details` | string | non |  |


**`CreateReportResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `reportId` | string | oui |  |
| `createdAt` | string (date-time) | oui |  |


**`CronRun`** — Last heartbeat of a cron (Redis, 7 days) — D64 4A

| Champ | Type | Requis | Description |
|---|---|---|---|
| `service` | string | oui |  |
| `name` | string | oui |  |
| `ranAt` | string (date-time) | oui |  |
| `durationMs` | integer | oui |  |
| `ok` | boolean | oui |  |
| `summary` | string \| null | oui |  |
| `error` | string \| null | oui |  |
| `schedule` | string \| null | oui |  |


**`DataExport`** — What belongs to the member (D63 2A): never the counterpart's contact details, the delivery code, reports targeting the member, internal notes or mediation files

| Champ | Type | Requis | Description |
|---|---|---|---|
| `exportedAt` | string (date-time) | oui |  |
| `format` | string | oui |  |
| `profile` | object | oui |  |
| `preferences` | object | oui |  |
| `addresses` | array<objet {  }> | oui |  |
| `consents` | array<objet {  }> | oui |  |
| `carrierProfile` | object \| null | oui |  |
| `trips` | array<objet {  }> | oui |  |
| `bookings` | array<objet {  }> | oui |  |
| `reviewsGiven` | array<objet {  }> | oui |  |
| `reviewsReceived` | array<objet {  }> | oui |  |
| `messages` | array<objet {  }> | oui |  |
| `meetups` | array<objet {  }> | oui |  |
| `phoneReveals` | array<objet {  }> | oui |  |
| `savedRoutes` | array<objet {  }> | oui |  |
| `favorites` | array<objet {  }> | oui |  |
| `following` | array<objet {  }> | oui |  |
| `notifications` | array<objet {  }> | oui |  |
| `reportsMade` | array<objet {  }> | oui |  |
| `dataRequests` | array<objet {  }> | oui |  |


**`DataRequestItem`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | string | oui |  |
| `userId` | string | oui |  |
| `userLabel` | string | oui | First name + initial, or « Membre supprimé » |
| `type` | enum : EXPORT, ERASURE | oui |  |
| `channel` | enum : MEMBER, ADMIN | oui |  |
| `status` | enum : DONE, REFUSED | oui |  |
| `refusalReasons` | array<string> | oui |  |
| `requestedByAdmin` | string \| null | oui |  |
| `reason` | string \| null | oui |  |
| `requestedAt` | string (date-time) | oui |  |
| `completedAt` | string \| null | oui |  |


**`DataRequestsResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `items` | array<DataRequestItem> | oui |  |
| `nextCursor` | string \| null | oui |  |


**`EmailChangeConfirmedResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `ok` | boolean | oui |  |
| `email` | string | oui |  |
| `revokedSessions` | integer | oui |  |


**`EmailChangeRequestedResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `ok` | boolean | oui |  |
| `pendingEmail` | string | oui |  |
| `expiresInMinutes` | integer | oui |  |


**`EraseMyAccountRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `confirmation` | string | oui |  |


**`ErasedResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `erased` | boolean | oui |  |


**`ErasureBlockedResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `code` | string | oui |  |
| `blockers` | array<ErasureBlocker> | oui |  |
| `counts` | object | oui |  |


**`ErasureBlocker`** — enum : `ACTIVE_DEAL`, `PENDING_REQUEST`, `PAYOUT_PENDING`, `RETENTION_HELD`, `PUBLISHED_TRIP`, `ADMIN_ACCOUNT` — Why an account cannot be erased yet (D63 3A) — closed list, translated by the client


**`ErrorResponse`** — Enveloppe d'erreur standard (error-middleware, toute AppError)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `status` | string | oui |  |
| `message` | string | oui |  |
| `errors` | object | non | Erreurs par champ (formulaires) — exposé quand details.errors est présent |
| `details` |  | non | Contexte structuré 'safe' (ex: type=otp) — toujours exposé ; le reste hors prod uniquement |


**`FollowPreferencesRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `notifyNextTrip` | boolean | oui |  |


**`FollowResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `message` | string | non |  |
| `follow` | object | oui |  |


**`FollowingResponse`** — Members with an upcoming trip first

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `count` | integer | oui |  |
| `following` | array<objet { user, followedAt, notifyNextTrip }> | oui |  |


**`GoogleSignInRequest`** — Google ID token (D47). A new account needs consent, otherwise CONSENT_REQUIRED

| Champ | Type | Requis | Description |
|---|---|---|---|
| `credential` | string | oui |  |
| `rememberMe` | boolean | non |  |
| `consent` | object | non |  |


**`GoogleSignInResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `status` | enum : LOGGED_IN, CONSENT_REQUIRED | oui |  |
| `created` | boolean | non |  |
| `linked` | boolean | non |  |
| `user` | SessionUser | non |  |


**`HealthCheck`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `ok` | boolean | oui |  |
| `ms` | integer | oui |  |
| `error` | string \| null | oui |  |


**`HealthReport`** — Uniform /health of every service (D64 3A)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `status` | enum : ok, degraded | oui |  |
| `service` | string | oui |  |
| `version` | string | oui |  |
| `uptimeSeconds` | integer | oui |  |
| `checks` | object | oui |  |
| `at` | string (date-time) | oui |  |


**`InviteAdminRequest`** — SUPER_ADMIN only. New account: no client role, password set through the emailed link (48h).

| Champ | Type | Requis | Description |
|---|---|---|---|
| `email` | string (email) | oui |  |
| `firstName` | string | oui |  |
| `lastName` | string | oui |  |
| `adminRoles` | AdminRoles | oui |  |


**`InviteAdminResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `ok` | boolean | oui |  |
| `userId` | ObjectId | oui |  |
| `existingAccount` | boolean | oui |  |
| `expiresInHours` | integer | non |  |


**`LiftSuspensionRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `reason` | string | oui |  |


**`MaintenanceState`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `enabled` | boolean | oui |  |
| `messageFr` | string | oui |  |
| `messageEn` | string | oui |  |
| `scheduledAt` | string \| null | oui | Annonce affichée avant la coupure (bandeau), null = aucune |
| `updatedAt` | string \| null | oui |  |
| `updatedBy` | string \| null | oui |  |
| `version` | integer | oui |  |
| `envOverride` | boolean | non |  |


**`MeResponse`** — The User record without passwordHash (additional fields allowed)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `user` | object | oui |  |
| `roles` | array<string> | oui |  |


**`MemberLoginRequest`** — rememberMe = 30-day refresh cookie (A62)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `email` | string (email) | oui |  |
| `password` | string | oui |  |
| `rememberMe` | boolean | non |  |


**`MemberLoginResponse`** — Cookies access_token / refresh_token are set on the response

| Champ | Type | Requis | Description |
|---|---|---|---|
| `message` | string | oui |  |
| `user` | SessionUser | oui |  |


**`MemberRegisterRequest`** — Consent is mandatory (ConsentLog written at verification)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `firstName` | string | oui |  |
| `lastName` | string | oui |  |
| `email` | string (email) | oui |  |
| `password` | string | oui |  |
| `termsAccepted` | boolean | oui |  |
| `termsVersion` | string | oui |  |
| `privacyVersion` | string | oui |  |


**`MemberSessionItem`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `jti` | string | oui |  |
| `createdAt` | string (date-time) | oui |  |
| `lastActivityAt` | string (date-time) | oui |  |
| `rememberMe` | boolean | oui |  |
| `device` | string | oui | Browser + OS derived from the user agent, or « Appareil inconnu » |
| `ip` | string \| null | oui |  |
| `current` | boolean | oui |  |


**`MemberSessionsResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `items` | array<MemberSessionItem> | oui |  |


**`MessageResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `message` | string | oui |  |


**`MyProfileResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `firstName` | string | oui |  |
| `lastName` | string | oui |  |
| `publicSlug` | string \| null | oui |  |
| `avatarUrl` | string \| null | oui |  |
| `birthDate` | string \| null | oui |  |
| `profilePublic` | boolean | oui |  |
| `showCity` | boolean | oui |  |
| `carrier` | object \| null | oui |  |


**`ObjectId`** — string : Identifiant MongoDB (ObjectId sérialisé en hexadécimal)


**`OkResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `ok` | boolean | oui |  |


**`PasswordChangedResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `ok` | boolean | oui |  |
| `revokedSessions` | integer | oui |  |
| `hadPassword` | boolean | oui |  |


**`PasswordForgotRequest`** — Always 200: never reveals whether the account exists

| Champ | Type | Requis | Description |
|---|---|---|---|
| `email` | string (email) | oui |  |


**`PasswordResetRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `passwordResetToken` | string | oui |  |
| `newPassword` | string | oui |  |


**`PasswordVerifyRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `email` | string (email) | oui |  |
| `otp` | string | oui |  |


**`PasswordVerifyResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `message` | string | oui |  |
| `passwordResetToken` | string | oui |  |


**`PilotageDrilldownItem`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `kind` | enum : USER, TRIP, DEAL | oui |  |
| `id` | ObjectId | oui |  |
| `label` | string | oui | Prénom + initiale, ou corridor |
| `at` | string (date-time) | oui | La date du fait pour cette mesure |
| `status` | string \| null | oui |  |
| `amountCents` | integer \| null | oui |  |
| `currencyCode` | string \| null | oui |  |


**`PilotageDrilldownResponse`** — Consultation journalisée quand la mesure porte des personnes (inscriptions)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `metric` | PilotageMetric | oui |  |
| `granularity` | PilotageGranularity | oui |  |
| `period` | string | oui |  |
| `periodStart` | string (date-time) | oui |  |
| `periodEnd` | string (date-time) | oui |  |
| `items` | array<PilotageDrilldownItem> | oui |  |
| `total` | integer | oui |  |
| `truncated` | boolean | oui | true si plus de 200 éléments (liste bornée) |


**`PilotageGranularity`** — enum : `week`, `month` — Semaines ISO (lundi, UTC) ou mois UTC


**`PilotageMetric`** — enum : `signups`, `tripsPublished`, `requests`, `accepted`, `delivered`, `completed`, `cancelled`, `disputes`, `captured`, `refunded`, `paidOut`, `revenue`, `retention`


**`PilotageSeriesPoint`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `period` | string | oui | YYYY-MM (mois) ou YYYY-Www (semaine ISO) |
| `periodStart` | string (date-time) | oui |  |
| `signups` | integer | oui |  |
| `tripsPublished` | integer | oui |  |
| `requests` | integer | oui |  |
| `accepted` | integer | oui |  |
| `delivered` | integer | oui |  |
| `completed` | integer | oui |  |
| `cancelled` | integer | oui |  |
| `disputes` | integer | oui |  |
| `volume` | array<objet { currencyCode, capturedCents }> | oui | Encaissé (capture) par devise |
| `finance` | array<objet { currencyCode, capturedCents, refundedCents, paidOutCents, revenueCents, retentionCents }> | oui |  |


**`PilotageSeriesResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `granularity` | PilotageGranularity | oui |  |
| `from` | string (date-time) | oui |  |
| `to` | string (date-time) | oui |  |
| `points` | array<PilotageSeriesPoint> | oui | Du plus ancien au plus récent, périodes vides incluses |
| `totals` | object | oui |  |
| `generatedAt` | string (date-time) | oui |  |
| `cached` | boolean | oui |  |


**`PlatformSettingsValues`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `pricing.commissionPct` | number | oui | Commission Yamba (percent) — D16 · COM-01 |
| `pricing.commissionFloorCents` | number | oui | Plancher de commission (cents) — D16 · COM-02 |
| `pricing.minBillableKg` | number | oui | Poids facturable minimum (kg) — D32 · PRC-06 |
| `pricing.minTransportCents` | number | oui | Prix minimum par colis (cents) — D32 · PRC-06 |
| `pricing.referenceKg` | number | oui | Colis de référence (comparabilité) (kg) — D33 |
| `pricing.sizeCoefS` | number | oui | Coefficient taille S (coef) — PRC-03 |
| `pricing.sizeCoefM` | number | oui | Coefficient taille M (coef) — PRC-03 |
| `pricing.sizeCoefL` | number | oui | Coefficient taille L (coef) — PRC-03 |
| `protection.extendedPremiumCents` | number | oui | Prime Garantie étendue (cents) — D22 · GAR-06 |
| `protection.extendedCapCents` | number | oui | Plafond Garantie étendue (cents) — D22 · GAR-03 |
| `cancellation.fullRefundUntilHours` | number | oui | Remboursement intégral jusqu'à (hours) — ANN-01 · D21 |
| `cancellation.lateRetentionPct` | number | oui | Retenue d'annulation tardive (percent) — ANN-01 · D39 · D50 |
| `rating.windowDays` | number | oui | Fenêtre de notation (days) — D53 · RG-NOTE-01 |
| `dispute.responseDelayHours` | number | oui | Délai de réponse au litige (hours) — D55 1A · RG-MED-02 |
| `reputation.carrier.confirmedMinDeals` | number | oui | Voyageur confirmé : deals minimum (count) — D29① · REP-03 |
| `reputation.carrier.topMinDeals` | number | oui | Voyageur top : deals minimum (count) — REP-03 |
| `reputation.carrier.topMinRating` | number | oui | Voyageur top : note minimale (rating) — REP-03 |
| `reputation.carrier.topMaxLateCancellations` | number | oui | Voyageur top : annulations tolérées (count) — REP-03 |
| `reputation.shipper.confirmedMinDeals` | number | oui | Expéditeur fiable : deals minimum (count) — REP-03 |
| `reputation.shipper.topMinDeals` | number | oui | Expéditeur top : deals minimum (count) — REP-03 |
| `reputation.shipper.topMinRating` | number | oui | Expéditeur top : note minimale (rating) — REP-03 |
| `reputation.shipper.topMaxLateCancellations` | number | oui | Expéditeur top : annulations tardives tolérées (count) — REP-03 |
| `messaging.writeDaysAfterEnd` | number | oui | Fil ouvert après la fin du deal (days) — D61 2A · RG-FCH-07 |
| `messaging.phoneRevealLeadHours` | number | oui | Numéro révélé avant le rendez-vous (hours) — D61 4A |
| `messaging.retentionDays` | number | oui | Conservation des conversations (days) — D61 8A · RG-FCH-22 |
| `messaging.reminderDelayMinutes` | number | oui | Relance email après (minutes) — D61 6A · RG-FCH-17 |
| `messaging.reminderMinIntervalMinutes` | number | oui | Au plus une relance toutes les (minutes) — D61 6A · RG-FCH-17 |
| `alerts.payoutFailedHours` | number | oui | Versement en échec depuis (hours) — D59 3A |
| `alerts.disputeUndecidedHours` | number | oui | Litige décidable sans décision depuis (hours) — D59 3A · A131 |
| `alerts.retentionHeldDays` | number | oui | Retenue non arbitrée depuis (days) — D59 3A |
| `alerts.reversalOpenHours` | number | oui | Renversement ouvert depuis (hours) — D59 3A |
| `alerts.outboxParkedAttempts` | number | oui | Événement parqué après (count) — D59 3A |
| `alerts.outboxLagMinutes` | number | oui | Relais en retard depuis (minutes) — D59 3A |
| `alerts.emailsFailedWindowHours` | number | oui | Emails en échec : fenêtre (hours) — D59 3A |
| `alerts.noTripPublishedDays` | number | oui | Aucun trajet publié depuis (days) — D59 3A |
| `alerts.acceptanceRateWindowDays` | number | oui | Taux d'acceptation : fenêtre (days) — D59 3A |
| `alerts.acceptanceRateMinPct` | number | oui | Taux d'acceptation minimum (percent) — D59 3A |
| `alerts.acceptanceRateMinRequests` | number | oui | Taux d'acceptation : demandes minimum (count) — D59 3A |
| `documents.maxDocsPerTrip` | number | oui | Documents par trajet (count) — ex-SiteConfig |
| `documents.maxDocSizeMb` | number | oui | Taille maximale d'un document (mb) — ex-SiteConfig |
| `trust.newAccountDays` | number | oui | Compte neuf pendant (days) — D71 · CNF-06 · REP-04 |
| `trust.newAccount.maxDeclaredValueCents` | number | oui | Compte neuf : valeur déclarée max par colis (cents) — D71 · CNF-06 |
| `trust.newAccount.maxWeightKg` | number | oui | Compte neuf : poids max par colis (kg) — D71 · CNF-06 |
| `trust.newAccount.maxShipmentsPerMonth` | number | oui | Compte neuf : envois par mois civil (count) — D71 · CNF-06 |
| `privacy.recipientRetentionDays` | number | oui | Effacement du destinataire après (days) — D63 5A · RGP-02 |
| `retention.notificationsDays` | number | oui | Notifications in-app (days) — D64 6A · RGP-01 |
| `retention.emailDeliveriesDays` | number | oui | Traces d'envoi d'emails (days) — D64 6A · RGP-01 |
| `retention.consumedEventsDays` | number | oui | Registre des événements consommés (days) — D64 6A |
| `retention.outboxPublishedDays` | number | oui | Événements d'outbox publiés (days) — D64 6A |


**`PreferencesResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `preferences` | object | oui |  |


**`ProposeSuspensionRequest`** — SUPPORT proposes; MEDIATOR / SUPER_ADMIN executes (D56 3A)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `level` | enum : RESTRICTED, SUSPENDED | oui |  |
| `reason` | string | oui |  |


**`PublicReputation`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `level` | enum : NEW, CONFIRMED, TOP | oui |  |
| `ratingsAvg` | number | oui |  |
| `ratingsCount` | integer | oui |  |
| `completedDealsCount` | integer | oui |  |
| `lateCancellationsCount` | integer | oui |  |


**`PublicReview`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `rating` | number | oui |  |
| `comment` | string \| null | oui |  |
| `criteria` | object \| null | non |  |
| `createdAt` | string (date-time) | oui |  |
| `author` | object | oui |  |


**`PublicReviewsResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `reviews` | array<PublicReview> | oui |  |
| `nextCursor` | string \| null | oui |  |


**`PublicTripPreview`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `transportMode` | string \| null | oui |  |
| `originCity` | string \| null | oui |  |
| `destinationCity` | string \| null | oui |  |
| `departureAt` | string \| null | oui |  |
| `flightType` | string \| null | oui |  |
| `trainTripType` | string \| null | oui |  |
| `carTripFlexibility` | string \| null | oui |  |
| `minPriceCents` | integer \| null | oui |  |
| `currencyCode` | string | oui |  |


**`PublicTripsResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `trips` | array<PublicTripPreview> | oui |  |
| `nextCursor` | string \| null | oui |  |


**`PublicUserProfile`** — D28 / D29 / D67: location nulled when showCity is off; 404 to others when profilePublic is off (owner sees hidden: true)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `publicSlug` | string | oui |  |
| `firstName` | string | oui |  |
| `lastInitial` | string | oui |  |
| `avatarUrl` | string \| null | oui |  |
| `memberSince` | string (date-time) | oui |  |
| `location` | object | oui |  |
| `stats` | object | oui |  |
| `tripperRating` | object \| null | oui |  |
| `shipperRating` | object | oui |  |
| `reputation` | object | non |  |
| `tripper` | object \| null | oui |  |
| `shipper` | object | oui |  |
| `follow` | object | oui |  |
| `isOwnProfile` | boolean | oui |  |
| `isMe` | boolean | non |  |
| `hidden` | boolean | non |  |


**`PublicUserResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `user` | PublicUserProfile | oui |  |


**`RegistrationStartedResponse`** — OTP sent; the token identifies the pending registration (Redis, 10 min)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `message` | string | oui |  |
| `verificationToken` | string | oui |  |


**`ReportReason`** — enum : `ILLEGAL_CONTENT`, `SCAM`, `INAPPROPRIATE`, `IMPERSONATION`, `OTHER`


**`ReportStatus`** — enum : `OPEN`, `REVIEWED`, `DISMISSED`


**`ReportTargetType`** — enum : `TRIP`, `USER`


**`RequestEmailChange`** — Under sudo (D65 4A); a code is sent to the NEW address

| Champ | Type | Requis | Description |
|---|---|---|---|
| `newEmail` | string (email) | oui |  |


**`ResetSettingsRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `keys` | array<string> | non | Clés à remettre par défaut ; absent ou vide = toutes |
| `reason` | string | oui |  |
| `expectedVersion` | integer | oui |  |


**`ReviewReportRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `decision` | enum : REVIEWED, DISMISSED | oui |  |
| `note` | string | non |  |


**`RevokeSessionResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `ok` | boolean | oui |  |
| `current` | boolean | non |  |
| `revoked` | integer | non |  |


**`SavedRouteDto`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `originCity` | string | oui |  |
| `originCountry` | string | oui |  |
| `originCountryCode` | string | oui |  |
| `originCityCode` | string \| null | non |  |
| `originRegion` | string \| null | non |  |
| `originRegionCode` | string \| null | non |  |
| `originPlaceId` | string \| null | non |  |
| `originLat` | number \| null | non |  |
| `originLng` | number \| null | non |  |
| `destinationCity` | string | oui |  |
| `destinationCountry` | string | oui |  |
| `destinationCountryCode` | string | oui |  |
| `destinationCityCode` | string \| null | non |  |
| `destinationRegion` | string \| null | non |  |
| `destinationRegionCode` | string \| null | non |  |
| `destinationPlaceId` | string \| null | non |  |
| `destinationLat` | number \| null | non |  |
| `destinationLng` | number \| null | non |  |
| `earliestDate` | string \| null | non |  |
| `latestDate` | string \| null | non |  |
| `emailEnabled` | boolean | non |  |
| `inAppEnabled` | boolean | non |  |
| `includeNearby` | boolean | non |  |
| `id` | ObjectId | oui |  |
| `userId` | ObjectId | oui |  |
| `expiresAt` | string (date-time) | oui |  |
| `isActive` | boolean | oui |  |
| `lastNotifiedAt` | string \| null | non |  |
| `createdAt` | string (date-time) | oui |  |
| `updatedAt` | string (date-time) | oui |  |


**`SavedRouteRequest`** — Origin and destination are Google Places snapshots; same city+country on both sides is refused. Max 20 alerts per member

| Champ | Type | Requis | Description |
|---|---|---|---|
| `originCity` | string | oui |  |
| `originCountry` | string | oui |  |
| `originCountryCode` | string | oui |  |
| `originCityCode` | string \| null | non |  |
| `originRegion` | string \| null | non |  |
| `originRegionCode` | string \| null | non |  |
| `originPlaceId` | string \| null | non |  |
| `originLat` | number \| null | non |  |
| `originLng` | number \| null | non |  |
| `destinationCity` | string | oui |  |
| `destinationCountry` | string | oui |  |
| `destinationCountryCode` | string | oui |  |
| `destinationCityCode` | string \| null | non |  |
| `destinationRegion` | string \| null | non |  |
| `destinationRegionCode` | string \| null | non |  |
| `destinationPlaceId` | string \| null | non |  |
| `destinationLat` | number \| null | non |  |
| `destinationLng` | number \| null | non |  |
| `earliestDate` | string \| null | non |  |
| `latestDate` | string \| null | non |  |
| `emailEnabled` | boolean | non |  |
| `inAppEnabled` | boolean | non |  |
| `includeNearby` | boolean | non |  |


**`SavedRouteResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `message` | string | non |  |
| `savedRoute` | SavedRouteDto | oui |  |


**`SavedRoutesResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `savedRoutes` | array<SavedRouteDto> | oui |  |
| `count` | integer | oui |  |


**`ServiceStatus`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `name` | string | oui |  |
| `url` | string | oui |  |
| `reachable` | boolean | oui |  |
| `ms` | integer | oui |  |
| `report` | HealthReport \| null | oui |  |
| `error` | string \| null | oui |  |


**`SessionUser`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `email` | string | oui |  |
| `firstName` | string | oui |  |
| `lastName` | string | oui |  |
| `roles` | array<string> | oui |  |


**`SetMyAvatarRequest`** — After a signed ImageKit upload (folder /avatars); the URL must belong to IMAGEKIT_URL_ENDPOINT (D42)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `fileId` | string | oui |  |
| `url` | string (uri) | oui |  |


**`SettingDefinition`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `key` | string | oui |  |
| `group` | enum : pricing, protection, cancellation, rating, dispute, reputation, messaging, alerts, documents, privacy, retention, trust | oui |  |
| `label` | string | oui |  |
| `description` | string | oui |  |
| `rule` | string | oui |  |
| `unit` | enum : percent, cents, kg, coef, hours, days, minutes, count, rating, mb | oui |  |
| `default` | number | oui |  |
| `min` | number | oui |  |
| `max` | number | oui |  |
| `step` | number | oui |  |
| `scope` | enum : BUSINESS, OPERATIONS | oui |  |
| `contractual` | boolean | non |  |
| `consumers` | array<string> | oui |  |
| `example` | string | non |  |


**`SettingsHistoryItem`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `at` | string (date-time) | oui |  |
| `admin` | string | oui |  |
| `action` | string | oui |  |
| `key` | string \| null | oui |  |
| `before` | number \| null | oui |  |
| `after` | number \| null | oui |  |
| `reason` | string \| null | oui |  |
| `version` | integer \| null | oui |  |


**`SettingsHistoryResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `items` | array<SettingsHistoryItem> | oui |  |
| `nextCursor` | ObjectId \| null | oui |  |


**`SettingsLastChange`** — Dernière modification (7 jours) — affichée sur l'accueil admin (D62 5A)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `at` | string (date-time) | oui |  |
| `byName` | string | oui |  |
| `keys` | array<string> | oui |  |


**`SettingsWriteResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `version` | integer | oui |  |
| `changed` | array<objet { key, before, after }> | oui |  |


**`StripeLinkResponse`** — Single-use Stripe URL (onboarding or Express dashboard), never stored

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `url` | string (uri) | oui |  |


**`StripeStatusResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `status` | enum : not_started, pending, complete | oui |  |
| `chargesEnabled` | boolean | oui |  |
| `payoutsEnabled` | boolean | oui |  |
| `detailsSubmitted` | boolean | non |  |


**`SuccessMessageResponse`** — Generic { success, message } acknowledgement

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | non |  |
| `message` | string | oui |  |


**`SudoStatus`** — Sudo window bound to the current session (D65 1A)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `active` | boolean | oui |  |
| `expiresAt` | string \| null | oui |  |


**`SudoVerifyRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `code` | string | oui |  |


**`SudoWindowResponse`** — Sudo window opened for this session (15 min, D65)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `active` | boolean | oui |  |
| `expiresAt` | string (date-time) | oui |  |


**`SuspensionAppliedResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `ok` | boolean | oui |  |
| `accountStatus` | string | oui |  |
| `at` | string (date-time) | non |  |


**`SuspensionProposedResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `ok` | boolean | oui |  |
| `proposedAt` | string (date-time) | oui |  |


**`TrustAssessment`** — Internal risk score (D29 ②, REP-04): decision support and progressive caps only — never an automatic sanction, never shown to members

| Champ | Type | Requis | Description |
|---|---|---|---|
| `score` | integer | oui | 0 = no risk signal, 100 = maximum; higher is riskier |
| `level` | TrustLevel | oui |  |
| `factors` | array<objet { key, points, detail }> | oui |  |
| `caps` | object \| null | oui |  |
| `capsReason` | string \| null | oui |  |
| `signals` | object | oui |  |


**`TrustLevel`** — enum : `NEW`, `STANDARD`, `WATCH`, `HIGH_RISK`


**`UnauthorizedResponse`** — 401 du middleware isAuthenticated (token absent, invalide, expiré, ou compte introuvable) — hors error-middleware

| Champ | Type | Requis | Description |
|---|---|---|---|
| `message` | string | oui |  |


**`UnhandledError`** — 500 non géré (exception hors AppError) — champ `error`, pas `message`

| Champ | Type | Requis | Description |
|---|---|---|---|
| `status` | string | oui |  |
| `error` | string | oui |  |


**`UpdateAdminRoleRequest`** — C-PR3bis : la liste complète des profils (remplace)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `adminRoles` | AdminRoles | oui |  |


**`UpdateAdminRoleResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `ok` | boolean | oui |  |
| `adminRoles` | array<string> | oui |  |
| `adminRole` | string \| null | oui |  |


**`UpdateLocaleRequest`** — One of SUPPORTED_LOCALES (D44)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `locale` | string | oui |  |


**`UpdateLocaleResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `preferredLocale` | string | oui |  |


**`UpdateMaintenanceRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `enabled` | boolean | oui |  |
| `messageFr` | string | oui |  |
| `messageEn` | string | oui |  |
| `scheduledAt` | string \| null | oui |  |
| `reason` | string | oui |  |
| `expectedVersion` | integer | oui |  |


**`UpdateMyPreferencesRequest`** — Member preferences (D63 8A, D66 2A)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `messagingReminderEmails` | boolean | non |  |
| `analyticsOptIn` | boolean | non | D66 2A — audience measurement consent (written to ConsentLog COOKIES) |


**`UpdateMyProfileRequest`** — Member-editable profile (D67 1A); the public slug never changes

| Champ | Type | Requis | Description |
|---|---|---|---|
| `firstName` | string | non |  |
| `lastName` | string | non |  |
| `displayName` | string | non |  |
| `bio` | string \| null | non |  |
| `birthDate` | string \| null | non |  |
| `profilePublic` | boolean | non |  |
| `showCity` | boolean | non |  |


**`UpdateSettingsRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `changes` | object | oui | Clés du catalogue → nouvelle valeur (seules les clés modifiées) |
| `reason` | string | oui |  |
| `expectedVersion` | integer | oui | Verrou optimiste : la version lue ; 409 si elle a bougé |


**`VerificationTokenRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `verificationToken` | string | oui |  |


**`VerifyRegistrationRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `verificationToken` | string | oui |  |
| `otp` | string | oui |  |


## trip-service — port 6002

Trajets, recherche, prix, documents, uploads. Document vivant : `http://localhost:6002/docs` (Scalar) et `apps/trip-service/openapi.json`. Via le gateway : `http://localhost:8080/api` (préfixes ci-dessous).


### trip-service › —




#### `GET /openapi.json`

**Ce document OpenAPI 3.1**  
`operationId` : `getOpenApiDocument` · Authentification : aucune (public)

| Code | Réponse |
|---|---|
| 200 | objet {  } — Document OpenAPI 3.1 (généré depuis Zod) |


### trip-service › trips-search

Recherche publique (aucune auth)


#### `GET /trips/pricing/params`

**Paramètres de prix de la plateforme (public)**  
`operationId` : `getPricingParams` · Authentification : aucune (public)

Commission, planchers, coefficients de taille, Garantie étendue, kilo de référence : les valeurs en vigueur, réglées par l'admin (D62). Le wizard calcule le devis avec le moteur unique (D34) et ces valeurs ; le serveur refait le calcul à la création. `version` change à chaque modification.

| Code | Réponse |
|---|---|
| 200 | PricingParamsResponse — Paramètres de prix en vigueur |


#### `GET /trips/search`

**Rechercher des trips publiés**  
`operationId` : `searchTrips` · Authentification : aucune (public)

Recherche publique paginée (cursor-based). Hard filters non-négociables : status=PUBLISHED et départ futur. Les trips malformés sont exclus silencieusement du mapping. ⚠️ Enveloppe SANS champ success (fidèle au réel).

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `mode` | query | non | TransportModeFilter | Filtre mode de transport (défaut : all) |
| `from` | query | non | string | Ville ou pays d'origine (match partiel, insensible à la casse) |
| `to` | query | non | string | Ville ou pays de destination (match partiel, insensible à la casse) |
| `dateFrom` | query | non | string | Borne basse ISO 8601. Ignorée si dans le passé : la recherche ne renvoie jamais de trips déjà partis (borne effective = max(now, dateFrom)) |
| `dateTo` | query | non | string | Borne haute ISO 8601 sur la date de départ |
| `categories` | query | non | string | CSV de UiParcelCategory (ex: "clothes,shoes,documents"). Sémantique hasSome : au moins une catégorie acceptée doit matcher. Les valeurs invalides sont filtrées silencieusement |
| `departureBuckets` | query | non | string | CSV de DepartureBucket (ex: "morning,evening"). OR des tranches horaires (heure locale de départ). Valeurs invalides filtrées silencieusement |
| `locale` | query | non | SearchLocale | Locale de formatage serveur des dates (défaut : fr) |
| `sort` | query | non | SortOption | Tri (défaut : earliest). lowestPrice exclut les trips sans minPriceCents |
| `superTripper` | query | non | string | Uniquement les Super Trippers — booléen en query string : tout sauf "true" vaut false |
| `profileVerified` | query | non | string | Uniquement les profils vérifiés — booléen en query string : tout sauf "true" vaut false |
| `instantBooking` | query | non | string | Uniquement les trips à réservation instantanée — booléen en query string : tout sauf "true" vaut false |
| `verifiedTicket` | query | non | string | Uniquement les billets vérifiés — booléen en query string : tout sauf "true" vaut false |
| `cursor` | query | non | string | Curseur de pagination : le nextCursor de la page précédente |
| `limit` | query | non | integer | Taille de page |

| Code | Réponse |
|---|---|
| 200 | SearchTripsResponse — Page de résultats + nextCursor + totalCount |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 500 | UnhandledError — Erreur serveur non gérée |


#### `GET /trips/search/facets`

**Counts pour les filtres de recherche**  
`operationId` : `searchTripsFacets` · Authentification : aucune (public)

9 counts en parallèle. Les counts par mode sont calculés SANS le filtre mode courant ; les counts des soft toggles AVEC. Mêmes hard filters que la recherche. ⚠️ Enveloppe SANS champ success (fidèle au réel).

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `mode` | query | non | TransportModeFilter | Filtre mode de transport (défaut : all) |
| `from` | query | non | string | Ville ou pays d'origine (match partiel, insensible à la casse) |
| `to` | query | non | string | Ville ou pays de destination (match partiel, insensible à la casse) |
| `dateFrom` | query | non | string | Borne basse ISO 8601. Ignorée si dans le passé : la recherche ne renvoie jamais de trips déjà partis (borne effective = max(now, dateFrom)) |
| `dateTo` | query | non | string | Borne haute ISO 8601 sur la date de départ |
| `categories` | query | non | string | CSV de UiParcelCategory (ex: "clothes,shoes,documents"). Sémantique hasSome : au moins une catégorie acceptée doit matcher. Les valeurs invalides sont filtrées silencieusement |
| `departureBuckets` | query | non | string | CSV de DepartureBucket (ex: "morning,evening"). OR des tranches horaires (heure locale de départ). Valeurs invalides filtrées silencieusement |
| `locale` | query | non | SearchLocale | Locale de formatage serveur des dates (défaut : fr) |

| Code | Réponse |
|---|---|
| 200 | SearchFacetsResponse — Counts par mode et par toggle |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 500 | UnhandledError — Erreur serveur non gérée |


### trip-service › trips-favorites




#### `GET /trips/favorites`

**Mes trajets favoris**  
`operationId` : `listMyFavoriteTrips` · Authentification : cookieAuth, bearerAuth

Cartes de recherche (YambaTripResult, isFavorite = true) des trajets mis en favori, du plus récent au plus ancien ; les trajets passés restent listés. Auth requise.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `locale` | query | non | SearchLocale | Locale des libellés (sinon x-locale, sinon fr) |

| Code | Réponse |
|---|---|
| 200 | FavoriteTripsResponse — Liste { trips, totalCount } |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 500 | UnhandledError — Erreur serveur non gérée |


#### `POST /trips/{id}/favorite`

**Mettre un trajet en favori (idempotent)**  
`operationId` : `addTripFavorite` · Authentification : cookieAuth, bearerAuth

Signet privé : jamais notifié au Voyageur. 404 si le trajet n'existe pas (jamais 403 : ne pas révéler), 403 OWN_TRIP sur son propre trajet, 409 TRIP_NOT_FAVORITABLE si le trajet n'est pas PUBLISHED. Rejouer l'action renvoie le même état.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Identifiant du trip |

| Code | Réponse |
|---|---|
| 200 | TripFavoriteState — { tripId, isFavorite: true } |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 403 | ErrorResponse — OWN_TRIP — details.type = favorite |
| 404 | ErrorResponse — Trajet introuvable ou supprimé |
| 409 | ErrorResponse — TRIP_NOT_FAVORITABLE — trajet non publié |
| 500 | UnhandledError — Erreur serveur non gérée |


#### `DELETE /trips/{id}/favorite`

**Retirer un trajet des favoris (idempotent)**  
`operationId` : `removeTripFavorite` · Authentification : cookieAuth, bearerAuth

Toujours possible, même sur un trajet passé. 404 si le trajet n'existe pas.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Identifiant du trip |

| Code | Réponse |
|---|---|
| 200 | TripFavoriteState — { tripId, isFavorite: false } |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 404 | ErrorResponse — Trajet introuvable ou supprimé |
| 500 | UnhandledError — Erreur serveur non gérée |


### trip-service › trips-public

Vue publique d'un trip (aucune auth)


#### `GET /trips/{id}/public`

**Vue publique d'un trip publié**  
`operationId` : `getPublicTrip` · Authentification : aucune (public)

DTO structuré (origin/destination/dates/tripper imbriqués), filtré privacy (initiale du nom). 404 si inexistant, soft-deleted ou non-PUBLISHED — au format PublicNotFound (renvoyé hors error-middleware). 400 (ErrorResponse) si l'id n'est pas un ObjectId valide.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Identifiant du trip |

| Code | Réponse |
|---|---|
| 200 | PublicTripResponse — Vue publique du trip |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 404 | PublicNotFound — Trip inexistant, supprimé ou non publié |
| 500 | UnhandledError — Erreur serveur non gérée |


### trip-service › trips

CRUD owner (auth requise)


#### `POST /trips`

**Créer un trip (brouillon ou publication directe)**  
`operationId` : `createTrip` · Authentification : cookieAuth, bearerAuth

publish=true crée directement en PUBLISHED si les gates onboarding/Stripe passent (sinon 400). Un brouillon peut être incomplet (villes, dates nullish). minPriceCents et departureHourLocal sont recalculés côté serveur. Auth requise.

Corps (requis) : `CreateTripBody`

| Code | Réponse |
|---|---|
| 201 | TripMutationResponse — Trip créé (avec documents, sans allowedActions) |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 500 | UnhandledError — Erreur serveur non gérée |


#### `GET /trips/my`

**Mes trips**  
`operationId` : `getMyTrips` · Authentification : cookieAuth, bearerAuth

Tous les trips de l'utilisateur (hors soft-deleted), triés par createdAt desc. Chaque trip embarque allowedActions (state machine) et un select partiel des documents {id, type, status, url}. Auth requise.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `status` | query | non | TripStatus | Filtrer par statut (insensible à la casse : toUpperCase() serveur) |

| Code | Réponse |
|---|---|
| 200 | TripsListResponse — Liste { success, trips, count } |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 500 | UnhandledError — Erreur serveur non gérée |


#### `GET /trips/{id}`

**Détail owner d'un trip**  
`operationId` : `getTrip` · Authentification : cookieAuth, bearerAuth

Vue complète (documents, user, carrierPage) + allowedActions IMBRIQUÉ dans trip. Ownership requis : le trip d'autrui renvoie 400 "Unauthorized." (voir note sémantique). Auth requise.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Identifiant du trip |

| Code | Réponse |
|---|---|
| 200 | TripResponse — { success, trip: { ...trip, allowedActions } } |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 500 | UnhandledError — Erreur serveur non gérée |


#### `PUT /trips/{id}`

**Modifier un trip**  
`operationId` : `updateTrip` · Authentification : cookieAuth, bearerAuth

Body partiel (seuls les champs envoyés sont écrits). publish=true sur un DRAFT déclenche les gates de publication (onboarding, Stripe, locations). Édition refusée par la machine (COMPLETED/ARCHIVED/CANCELLED…) → 400. Auth requise.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Identifiant du trip |

Corps (requis) : `UpdateTripBody`

| Code | Réponse |
|---|---|
| 200 | TripMutationResponse — Trip mis à jour (sans allowedActions) |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 500 | UnhandledError — Erreur serveur non gérée |


#### `DELETE /trips/{id}`

**Supprimer (brouillon) ou annuler (alias)**  
`operationId` : `deleteTrip` · Authentification : cookieAuth, bearerAuth

?hard=true → soft delete d'un brouillon (isDeleted, invisible partout). Sans ?hard → alias backward-compat de cancel. Auth requise.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Identifiant du trip |
| `hard` | query | non | string | true = soft delete du brouillon · absent = alias de cancel |

| Code | Réponse |
|---|---|
| 200 | ActionResponse — "Draft deleted." ou "Trip cancelled." |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 500 | UnhandledError — Erreur serveur non gérée |


### trip-service › trips-lifecycle

Transitions de la state machine (auth requise, owner)


#### `POST /trips/{id}/publish`

**Publier un brouillon**  
`operationId` : `publishTrip` · Authentification : cookieAuth, bearerAuth

DRAFT → PUBLISHED. Gates : onboarding carrier, Stripe (charges enabled), champs requis (mode, villes, départ futur, ≥1 catégorie), ≥1 pickup + ≥1 delivery location. Transition refusée → 400 avec le message machine de canPerform. Auth requise (owner uniquement).

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Identifiant du trip |

| Code | Réponse |
|---|---|
| 200 | ActionResponse — Transition publish effectuée |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 500 | UnhandledError — Erreur serveur non gérée |


#### `POST /trips/{id}/unpublish`

**Repasser en brouillon**  
`operationId` : `unpublishTrip` · Authentification : cookieAuth, bearerAuth

PUBLISHED/PAUSED → DRAFT. Interdit avec réservations actives (guard prêt pour le chantier Booking). Décrémente les stats carrier. Transition refusée → 400 avec le message machine de canPerform. Auth requise (owner uniquement).

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Identifiant du trip |

| Code | Réponse |
|---|---|
| 200 | ActionResponse — Transition unpublish effectuée |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 500 | UnhandledError — Erreur serveur non gérée |


#### `POST /trips/{id}/pause`

**Mettre en pause**  
`operationId` : `pauseTrip` · Authentification : cookieAuth, bearerAuth

PUBLISHED → PAUSED. Le trip reste dans le pool public. Transition refusée → 400 avec le message machine de canPerform. Auth requise (owner uniquement).

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Identifiant du trip |

| Code | Réponse |
|---|---|
| 200 | ActionResponse — Transition pause effectuée |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 500 | UnhandledError — Erreur serveur non gérée |


#### `POST /trips/{id}/resume`

**Reprendre**  
`operationId` : `resumeTrip` · Authentification : cookieAuth, bearerAuth

PAUSED → PUBLISHED. Date de départ non passée requise. Transition refusée → 400 avec le message machine de canPerform. Auth requise (owner uniquement).

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Identifiant du trip |

| Code | Réponse |
|---|---|
| 200 | ActionResponse — Transition resume effectuée |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 500 | UnhandledError — Erreur serveur non gérée |


#### `POST /trips/{id}/cancel`

**Annuler**  
`operationId` : `cancelTrip` · Authentification : cookieAuth, bearerAuth

→ CANCELLED (cancelledAt posé). Décrémente les stats carrier, y compris depuis PAUSED. Transition refusée → 400 avec le message machine de canPerform. Auth requise (owner uniquement).

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Identifiant du trip |

| Code | Réponse |
|---|---|
| 200 | ActionResponse — Transition cancel effectuée |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 500 | UnhandledError — Erreur serveur non gérée |


#### `POST /trips/{id}/restore`

**Restaurer en brouillon**  
`operationId` : `restoreTrip` · Authentification : cookieAuth, bearerAuth

CANCELLED → DRAFT (cancelledAt effacé). Date de départ non passée requise. Transition refusée → 400 avec le message machine de canPerform. Auth requise (owner uniquement).

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Identifiant du trip |

| Code | Réponse |
|---|---|
| 200 | ActionResponse — Transition restore effectuée |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 500 | UnhandledError — Erreur serveur non gérée |


#### `POST /trips/{id}/archive`

**Archiver**  
`operationId` : `archiveTrip` · Authentification : cookieAuth, bearerAuth

COMPLETED/CANCELLED → ARCHIVED (one-way, pas de désarchivage MVP). Transition refusée → 400 avec le message machine de canPerform. Auth requise (owner uniquement).

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Identifiant du trip |

| Code | Réponse |
|---|---|
| 200 | ActionResponse — Transition archive effectuée |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 500 | UnhandledError — Erreur serveur non gérée |


### trip-service › trips-documents

Justificatifs du trip (auth requise, owner)


#### `POST /trips/{id}/documents`

**Ajouter des justificatifs**  
`operationId` : `addTripDocuments` · Authentification : cookieAuth, bearerAuth

Déduplication par fileId (les doublons sont ignorés ; si aucun nouveau → 200 "No new documents to add."). Limites serveur : siteConfig.maxDocsPerTrip (défaut 5), maxDocSizeMb (défaut 5 Mo). Un TICKET_PROOF fait passer ticketVerificationStatus NOT_SUBMITTED → PENDING. Auth requise (owner).

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Identifiant du trip |

Corps (requis) : `AddDocumentsBody`

| Code | Réponse |
|---|---|
| 200 | TripMutationResponse — Aucun nouveau document (tous dédupliqués) |
| 201 | TripMutationResponse — Documents ajoutés — trip complet renvoyé |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 500 | UnhandledError — Erreur serveur non gérée |


#### `DELETE /trips/{id}/documents/{documentId}`

**Supprimer un justificatif**  
`operationId` : `removeTripDocument` · Authentification : cookieAuth, bearerAuth

Supprime le document (et le fichier ImageKit, best-effort). Si c'était le dernier TICKET_PROOF, ticketVerificationStatus repasse à NOT_SUBMITTED. Auth requise (owner).

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Identifiant du trip |
| `documentId` | path | oui | ObjectId | Identifiant du document |

| Code | Réponse |
|---|---|
| 200 | ActionResponse — Document supprimé |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 500 | UnhandledError — Erreur serveur non gérée |


### trip-service › uploads

Upload direct navigateur → ImageKit (auth requise)


#### `GET /uploads/imagekit-auth`

**Paramètres d'authentification ImageKit**  
`operationId` : `getImageKitAuthParams` · Authentification : cookieAuth, bearerAuth

Pour l'upload direct navigateur → ImageKit (token/expire/signature, ~30 min). publicKey et urlEndpoint absents si l'env n'est pas configuré. Auth requise.

| Code | Réponse |
|---|---|
| 200 | ImageKitAuthResponse — Paramètres d'upload |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 500 | UnhandledError — Erreur serveur non gérée |


#### `DELETE /uploads/imagekit/{fileId}`

**Supprimer un fichier ImageKit**  
`operationId` : `deleteImageKitFile` · Authentification : cookieAuth, bearerAuth

Idempotent : un fichier déjà supprimé renvoie 200 "File was already deleted.". Auth requise.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `fileId` | path | oui | string | Identifiant ImageKit du fichier |

| Code | Réponse |
|---|---|
| 200 | ActionResponse — Fichier supprimé (ou déjà absent) |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 500 | UnhandledError — Erreur serveur non gérée |


### trip-service › admin

Back-office (chantier C, D57) — session ADMIN avec TOTP, permission par profil


#### `GET /admin/trips`

**Trajets — liste filtrable (D57 5A)**  
`operationId` : `adminListTrips` · Authentification : adminCookieAuth

Permission trips.read. Filtres : q (ville ou ObjectId), status, hidden=1 (masqués par Yamba), ticketPending=1, carrierId, from (ISO). 100 plus récents par départ, avec le nombre de réservations actives par trajet.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `q` | query | non | string | Ville (origine / destination) ou identifiant du trajet |
| `status` | query | non | TripStatus |  |
| `hidden` | query | non | string | 1 = masqués par Yamba seulement — booléen en query string : tout sauf "true" vaut false |
| `ticketPending` | query | non | string | 1 = billet en attente de vérification — booléen en query string : tout sauf "true" vaut false |
| `carrierId` | query | non | string | Trajets d'un Voyageur |
| `from` | query | non | string | Départ à partir de |

| Code | Réponse |
|---|---|
| 200 | AdminTripsResponse — Liste |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 403 | ErrorResponse — Profil admin sans la permission requise, ou conflit d'intérêts (son propre trajet) |
| 500 | UnhandledError — Erreur serveur non gérée |


#### `GET /admin/trips/{id}`

**Fiche trajet admin (D57 4A) — Voyageur, réservations, documents, journal**  
`operationId` : `adminGetTripFile` · Authentification : adminCookieAuth

Permission trips.read. La consultation est journalisée (AdminAction TRIP_VIEWED). Jamais de code de livraison.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Identifiant du trip |

| Code | Réponse |
|---|---|
| 200 | AdminTripFile — Fiche |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 403 | ErrorResponse — Profil admin sans la permission requise, ou conflit d'intérêts (son propre trajet) |
| 404 | ErrorResponse — Trajet ou document introuvable (ou supprimé) |
| 500 | UnhandledError — Erreur serveur non gérée |


#### `POST /admin/trips/{id}/hide/propose`

**Proposer un masquage (D57 6A) — SUPPORT**  
`operationId` : `adminProposeHideTrip` · Authentification : adminCookieAuth

Permission trips.hide.propose. Motif ≥ 20 caractères. Aucun effet sur la visibilité ; journal TRIP_HIDE_PROPOSED.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Identifiant du trip |

Corps (requis) : `HideTripRequest`

| Code | Réponse |
|---|---|
| 200 | ActionResponse — Proposition enregistrée |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 403 | ErrorResponse — Profil admin sans la permission requise, ou conflit d'intérêts (son propre trajet) |
| 404 | ErrorResponse — Trajet ou document introuvable (ou supprimé) |
| 500 | UnhandledError — Erreur serveur non gérée |


#### `POST /admin/trips/{id}/hide`

**Masquer un trajet (D57 3A) — MEDIATOR / SUPER_ADMIN**  
`operationId` : `adminHideTrip` · Authentification : adminCookieAuth

Permission trips.hide.apply. Pose Trip.hiddenByAdminAt + motif (≥ 20) dans la même transaction que le journal TRIP_HIDDEN ; invisible en recherche, page publique 404, non réservable ; réservations en cours préservées ; email au Voyageur. Yamba n'annule jamais un trajet.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Identifiant du trip |

Corps (requis) : `HideTripRequest`

| Code | Réponse |
|---|---|
| 200 | ActionResponse — Trajet masqué |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 403 | ErrorResponse — Profil admin sans la permission requise, ou conflit d'intérêts (son propre trajet) |
| 404 | ErrorResponse — Trajet ou document introuvable (ou supprimé) |
| 500 | UnhandledError — Erreur serveur non gérée |


#### `DELETE /admin/trips/{id}/hide`

**Rétablir un trajet masqué (D57 3A)**  
`operationId` : `adminUnhideTrip` · Authentification : adminCookieAuth

Permission trips.hide.apply. Motif ≥ 20 caractères, journal TRIP_UNHIDDEN, email au Voyageur.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Identifiant du trip |

Corps (requis) : `HideTripRequest`

| Code | Réponse |
|---|---|
| 200 | ActionResponse — Trajet rétabli |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 403 | ErrorResponse — Profil admin sans la permission requise, ou conflit d'intérêts (son propre trajet) |
| 404 | ErrorResponse — Trajet ou document introuvable (ou supprimé) |
| 500 | UnhandledError — Erreur serveur non gérée |


#### `GET /admin/tickets`

**File « billets à vérifier » (D57 1A) — trajets à venir, plus anciens d'abord**  
`operationId` : `adminListTicketQueue` · Authentification : adminCookieAuth

Permission tickets.review. Documents TICKET_PROOF en PENDING. Les billets de trajets déjà partis passent EXPIRED à la lecture (8A) — expiredNow les compte.

| Code | Réponse |
|---|---|
| 200 | TicketQueueResponse — File |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 403 | ErrorResponse — Profil admin sans la permission requise, ou conflit d'intérêts (son propre trajet) |
| 500 | UnhandledError — Erreur serveur non gérée |


#### `GET /admin/tickets/{documentId}`

**Ouvrir un billet (D57 7A) — consultation journalisée**  
`operationId` : `adminViewTicket` · Authentification : adminCookieAuth

Permission tickets.review. Renvoie l'URL ImageKit du document ; chaque ouverture écrit un AdminAction DOCUMENT_VIEWED.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `documentId` | path | oui | string | Identifiant du TripDocument (ObjectId) |

| Code | Réponse |
|---|---|
| 200 | objet {  } — Document |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 403 | ErrorResponse — Profil admin sans la permission requise, ou conflit d'intérêts (son propre trajet) |
| 404 | ErrorResponse — Trajet ou document introuvable (ou supprimé) |
| 500 | UnhandledError — Erreur serveur non gérée |


#### `POST /admin/tickets/{documentId}/review`

**Valider ou rejeter un billet (D57 1A) — motif fermé au rejet**  
`operationId` : `adminReviewTicket` · Authentification : adminCookieAuth

Permission tickets.review. decision VERIFY | REJECT (+ reason ILLEGIBLE | DATES_MISMATCH | NAME_MISMATCH | SUSPICIOUS). Document et Trip.ticketVerificationStatus mis à jour dans la même transaction que le journal ; email au Voyageur ; un billet rejeté peut être redéposé. Un billet déjà traité → 400 ; son propre billet → 403.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `documentId` | path | oui | string | Identifiant du TripDocument (ObjectId) |

Corps (requis) : `ReviewTicketRequest`

| Code | Réponse |
|---|---|
| 200 | ActionResponse — Décision enregistrée |
| 400 | ErrorResponse — Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique) |
| 401 | UnauthorizedResponse — Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated) |
| 403 | ErrorResponse — Profil admin sans la permission requise, ou conflit d'intérêts (son propre trajet) |
| 404 | ErrorResponse — Trajet ou document introuvable (ou supprimé) |
| 500 | UnhandledError — Erreur serveur non gérée |


### trip-service › schémas utilisés (62)


**`ActionResponse`** — Réponse minimale des actions (transitions, deletes) — aucun trip renvoyé

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `message` | string | oui |  |


**`AddDocumentsBody`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `documents` | array<objet { type, fileId, url, originalName, mimeType, sizeBytes, title, description }> | oui | Maximum côté serveur : paramètre documents.maxDocsPerTrip (défaut 5) · taille max par doc : documents.maxDocSizeMb (défaut 5 Mo) — D62 |


**`AdminTripFile`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `status` | string | oui |  |
| `originCity` | string | oui |  |
| `destinationCity` | string | oui |  |
| `departureAt` | string \| null | oui |  |
| `arrivalAt` | string \| null | oui |  |
| `transportMode` | string \| null | oui |  |
| `capacityKg` | number \| null | oui |  |
| `reservedKg` | number \| null | oui |  |
| `pricing` | null \| null | oui |  |
| `createdAt` | string (date-time) | oui |  |
| `publishedAt` | string \| null | oui |  |
| `cancelledAt` | string \| null | oui |  |
| `carrier` | object | oui |  |
| `ticketVerificationStatus` | string | oui |  |
| `hidden` | object \| null | oui |  |
| `hideProposal` | object \| null | oui |  |
| `documents` | array<objet { id, type, status, originalName, createdAt, reviewedAt, rejectionReason }> | oui |  |
| `bookings` | array<objet { id, status, shipperFirstName, weightKg, totalShipperCents, transportCents, currencyCode, disputeTicket, requestedAt }> | oui |  |
| `adminActions` | array<objet { id, at, admin, action, after }> | oui |  |


**`AdminTripSummary`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `status` | string | oui |  |
| `originCity` | string | oui |  |
| `destinationCity` | string | oui |  |
| `departureAt` | string \| null | oui |  |
| `transportMode` | string \| null | oui |  |
| `carrier` | object | oui |  |
| `ticketVerificationStatus` | string | oui |  |
| `hidden` | boolean | oui |  |
| `hideProposed` | boolean | oui |  |
| `activeBookingsCount` | integer | oui |  |
| `publishedAt` | string \| null | oui |  |


**`AdminTripsResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `items` | array<AdminTripSummary> | oui |  |
| `total` | integer | oui |  |
| `nextCursor` | string \| null | non | C-PR7a — id du dernier élément ; absent = fin |


**`AllowedActions`** — array


**`CarTripFlexibility`** — enum : `DIRECT`, `DETOUR_BY_AGREEMENT`


**`CategoryCondition`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `category` | ParcelCategory | oui |  |
| `priceAmountCents` | integer | oui | Prix en centimes (DEV-01 : jamais de float) |


**`CreateTripBody`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `transportMode` | TransportMode | oui |  |
| `tripType` | TripType | oui |  |
| `originLabel` | string | oui |  |
| `originPlaceId` | string \| null | non |  |
| `originCity` | string \| null | non |  |
| `originCityCode` | string \| null | non |  |
| `originRegion` | string \| null | non |  |
| `originRegionCode` | string \| null | non |  |
| `originCountry` | string \| null | non |  |
| `originCountryCode` | string \| null | non |  |
| `originLat` | number \| null | non |  |
| `originLng` | number \| null | non |  |
| `originTimezone` | string \| null | non |  |
| `destinationLabel` | string | oui |  |
| `destinationPlaceId` | string \| null | non |  |
| `destinationCity` | string \| null | non |  |
| `destinationCityCode` | string \| null | non |  |
| `destinationRegion` | string \| null | non |  |
| `destinationRegionCode` | string \| null | non |  |
| `destinationCountry` | string \| null | non |  |
| `destinationCountryCode` | string \| null | non |  |
| `destinationLat` | number \| null | non |  |
| `destinationLng` | number \| null | non |  |
| `destinationTimezone` | string \| null | non |  |
| `departureDateLocal` | string \| null | non |  |
| `departureTimeLocal` | string \| null | non |  |
| `arrivalDateLocal` | string \| null | non |  |
| `arrivalTimeLocal` | string \| null | non |  |
| `departureAt` | string \| null | non |  |
| `arrivalAt` | string \| null | non |  |
| `returnDepartureAt` | string \| null | non |  |
| `returnArrivalAt` | string \| null | non |  |
| `flightType` | FlightType \| null | non |  |
| `flightLayoverCities` | array \| null | non |  |
| `trainTripType` | TrainTripType \| null | non |  |
| `trainStopCities` | array \| null | non |  |
| `carTripFlexibility` | CarTripFlexibility \| null | non |  |
| `travelReference` | string \| null | non |  |
| `acceptedCategories` | array<ParcelCategory> | oui |  |
| `categoryConditions` | array \| null | non |  |
| `pricePerKgCents` | integer \| null | non | D13 — carrier's single price per kg, in cents. Null = legacy PER_CATEGORY trip |
| `checkedBag23PriceCents` | integer \| null | non | PRC-04 — full 23kg checked bag flat rate (consumes 23kg of capacity). Null = not offered |
| `cabinBag12PriceCents` | integer \| null | non | PRC-04 — full 12kg cabin bag flat rate. Null = not offered |
| `capacityKg` | number \| null | non | CAP-01/D19 — carrier declared capacity in kg (immutable after publication). Required alongside pricePerKgCents to publish PER_KG (gate A28) |
| `familyConditions` | array \| null | non | D14 — per-family stance (NEW engine). Null/empty = all families accepted |
| `pickupLocations` | array \| null | non |  |
| `deliveryLocations` | array \| null | non |  |
| `handDeliveryOnly` | boolean | oui |  |
| `instantBooking` | boolean | oui |  |
| `currencyCode` | string | oui |  |
| `maxSlots` | integer \| null | non |  |
| `notes` | string \| null | non |  |
| `publish` | boolean | oui | true = créer directement en PUBLISHED (si gates onboarding/Stripe/locations OK) |


**`ErrorResponse`** — Enveloppe d'erreur standard (error-middleware, toute AppError)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `status` | string | oui |  |
| `message` | string | oui |  |
| `errors` | object | non | Erreurs par champ (formulaires) — exposé quand details.errors est présent |
| `details` |  | non | Contexte structuré 'safe' (ex: type=otp) — toujours exposé ; le reste hors prod uniquement |


**`FamilyConditionMode`** — enum : `ACCEPT`, `SURCHARGE`, `REFUSE` — Carrier stance on a family: accept, surcharge (%), or refuse


**`FavoriteTripsResponse`** — Mes favoris — du plus récent au plus ancien, trajets passés inclus

| Champ | Type | Requis | Description |
|---|---|---|---|
| `trips` | array<YambaTripResult> | oui |  |
| `totalCount` | integer | oui |  |


**`FlightType`** — enum : `DIRECT`, `WITH_LAYOVER`


**`HideTripRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `reason` | string | oui |  |


**`ImageKitAuthResponse`** — Paramètres d'authentification pour upload direct navigateur → ImageKit

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `token` | string | oui |  |
| `expire` | number | oui | Timestamp Unix d'expiration (~30 min) |
| `signature` | string | oui |  |
| `publicKey` | string | non | IMAGEKIT_PUBLIC_KEY (absent si env non configuré) |
| `urlEndpoint` | string | non | IMAGEKIT_URL_ENDPOINT (absent si env non configuré) |


**`LocationFlexibility`** — enum : `EXACT`, `RADIUS`, `CITY_WIDE`


**`LocationKind`** — enum : `AIRPORT`, `TRAIN_STATION`, `CITY_AREA`


**`ObjectId`** — string : Identifiant MongoDB (ObjectId sérialisé en hexadécimal)


**`ParcelCategory`** — enum : `CLOTHES`, `SHOES`, `FASHION_ACCESSORIES`, `OTHER_ACCESSORIES`, `BOOKS`, `DOCUMENTS`, `SMALL_TOYS`, `PHONE`, `COMPUTER`, `OTHER_ELECTRONICS`, `CHECKED_BAG_23KG`, `CABIN_BAG_12KG` — Enum actuel (pré-D14). La migration vers les 8 familles de risque CAT-02 fera l'objet d'une PR dédiée (mapping conservé).


**`ParcelFamily`** — enum : `DOCUMENTS_PAPERS`, `CLOTHES_TEXTILE`, `FOOD_DRY_SEALED`, `ELECTRONICS_DEVICES`, `COSMETICS_CARE`, `PARTS_TOOLS`, `TOYS_CHILDCARE`, `MISC_ACCESSORIES` — D14/CAT-02 — the 8 risk families (conformity/risk/protection, never price)


**`PricingParamsResponse`** — Server pricing parameters (D62 7A) — the wizard quotes with the single engine and these values

| Champ | Type | Requis | Description |
|---|---|---|---|
| `sizeCoef` | object | oui |  |
| `minBillableKg` | number | oui |  |
| `minTransportCents` | integer | oui |  |
| `commissionPct` | number | oui |  |
| `commissionFloorCents` | integer | oui |  |
| `protectionExtendedPremiumCents` | integer | oui |  |
| `protectionExtendedCapCents` | integer | oui |  |
| `weightTolerancePct` | number | oui |  |
| `referenceKg` | number | oui |  |
| `version` | integer | oui |  |


**`PublicCarrier`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `name` | string \| null | non |  |
| `bio` | string \| null | non |  |
| `isVerified` | boolean | oui |  |
| `isSuperCarrier` | boolean | oui |  |
| `ratingsAvg` | number \| null | non |  |
| `ratingsCount` | integer | oui |  |
| `totalTripsPublished` | integer | oui |  |
| `totalParcelsCarried` | integer | oui |  |


**`PublicNotFound`** — 404 de la route publique (court-circuite le middleware d'erreurs)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `message` | string | oui |  |


**`PublicPlace`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `label` | string \| null | non |  |
| `placeId` | string \| null | non |  |
| `city` | string | oui | Non-null : requis par le gate de publication |
| `cityCode` | string \| null | non |  |
| `region` | string \| null | non |  |
| `regionCode` | string \| null | non |  |
| `country` | string \| null | non |  |
| `countryCode` | string \| null | non |  |
| `lat` | number \| null | non |  |
| `lng` | number \| null | non |  |
| `timezone` | string \| null | non |  |


**`PublicTrip`** — Vue publique filtrée d'un trip PUBLISHED

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `status` | string | oui | Seuls les trips PUBLISHED sont servis (404 sinon) |
| `transportMode` | TransportMode | oui |  |
| `tripType` | TripType \| null | non |  |
| `origin` | PublicPlace | oui |  |
| `destination` | PublicPlace | oui |  |
| `dates` | PublicTripDates | oui |  |
| `flightType` | FlightType \| null | non |  |
| `trainTripType` | TrainTripType \| null | non |  |
| `carTripFlexibility` | CarTripFlexibility \| null | non |  |
| `flightLayoverCities` | array<string> | oui |  |
| `trainStopCities` | array<string> | oui |  |
| `travelReference` | string \| null | non |  |
| `acceptedCategories` | array<ParcelCategory> | oui |  |
| `categoryConditions` | array<CategoryCondition> | oui |  |
| `pricePerKgCents` | integer \| null | non | D13 — carrier's single price per kg, in cents. Null = legacy PER_CATEGORY trip |
| `checkedBag23PriceCents` | integer \| null | non | PRC-04 — full 23kg checked bag flat rate (consumes 23kg of capacity). Null = not offered |
| `cabinBag12PriceCents` | integer \| null | non | PRC-04 — full 12kg cabin bag flat rate. Null = not offered |
| `capacityKg` | number \| null | non | CAP-01/D19 — carrier declared capacity in kg (immutable after publication). Required alongside pricePerKgCents to publish PER_KG (gate A28) |
| `familyConditions` | array \| null | non | D14 — per-family stance (NEW engine). Null/empty = all families accepted |
| `reservedKg` | number \| null | non | CAP-02 — lets shippers derive remaining capacity client-side |
| `pickupLocations` | array<TripLocationPoint> | oui |  |
| `deliveryLocations` | array<TripLocationPoint> | oui |  |
| `handDeliveryOnly` | boolean | oui |  |
| `instantBooking` | boolean | oui |  |
| `currencyCode` | string | oui |  |
| `notes` | string \| null | non |  |
| `maxSlots` | integer \| null | oui |  |
| `bookedSlots` | integer | oui |  |
| `remainingSlots` | integer \| null | oui | max(0, maxSlots - bookedSlots) — null si capacité illimitée |
| `minPriceCents` | integer \| null | oui |  |
| `ticketVerified` | boolean | oui | true ssi ticketVerificationStatus = VERIFIED |
| `tripper` | PublicTripper | oui |  |
| `publishedAt` | string \| null | non |  |
| `isFavorite` | boolean | non | D46 — true si l'utilisateur connecté a mis ce trajet en favori (isOptionallyAuthenticated) |
| `viewsCount` | integer | non | D5 / C-PR6 — vues dédoublonnées par visiteur et par jour (Redis), cette vue comprise ; absent si Redis indisponible |


**`PublicTripDates`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `departureAt` | string (date-time) | oui | Non-null : requis par le gate de publication |
| `arrivalAt` | string \| null | non |  |
| `returnDepartureAt` | string \| null | non |  |
| `returnArrivalAt` | string \| null | non |  |
| `departureDateLocal` | string \| null | non |  |
| `arrivalDateLocal` | string \| null | non |  |
| `departureTimeLocal` | string \| null | non |  |
| `arrivalTimeLocal` | string \| null | non |  |


**`PublicTripResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `trip` | PublicTrip | oui |  |


**`PublicTripper`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `publicSlug` | string \| null | non |  |
| `firstName` | string \| null | non |  |
| `lastInitial` | string | oui | Initiale du nom, '' si absent (privacy) |
| `avatarUrl` | string \| null | oui |  |
| `memberSince` | string (date-time) | oui |  |
| `carrier` | PublicCarrier \| null | oui |  |


**`ReviewTicketRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `decision` | enum : VERIFY, REJECT | oui |  |
| `reason` | TicketRejectionReason | non | Required when REJECT |


**`SearchFacetsResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `totalCount` | integer | oui | Count avec le filtre mode appliqué |
| `modeCount` | object | oui | Counts par mode, calculés SANS le filtre mode courant |
| `superTripperCount` | integer | oui |  |
| `profileVerifiedCount` | integer | oui |  |
| `instantBookingCount` | integer | oui |  |
| `verifiedTicketCount` | integer | oui |  |
| `familyCounts` | object | non | D33 — par ParcelFamily : trips qui NE refusent PAS la famille (base sans filtre famille) |


**`SearchLocale`** — enum : `fr`, `en` — Locale de formatage serveur des dates (défaut fr)


**`SearchTripsResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `trips` | array<YambaTripResult> | oui |  |
| `nextCursor` | string \| null | oui | id du dernier trip de la page — null si dernière page (pagination cursor-based) |
| `totalCount` | integer | oui |  |


**`SortOption`** — enum : `earliest`, `lowestPrice`, `bestRated` — Tri des résultats. lowestPrice trie sur comparablePriceCents (D33 : colis de référence 2 kg) et exclut les trips sans valeur.


**`TicketQueueItem`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `documentId` | ObjectId | oui |  |
| `tripId` | ObjectId | oui |  |
| `originCity` | string | oui |  |
| `destinationCity` | string | oui |  |
| `departureAt` | string \| null | oui |  |
| `transportMode` | string \| null | oui |  |
| `carrier` | object | oui |  |
| `originalName` | string \| null | oui |  |
| `mimeType` | string \| null | oui |  |
| `submittedAt` | string (date-time) | oui |  |


**`TicketQueueResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `items` | array<TicketQueueItem> | oui |  |
| `expiredNow` | integer | oui |  |


**`TicketRejectionReason`** — enum : `ILLEGIBLE`, `DATES_MISMATCH`, `NAME_MISMATCH`, `SUSPICIOUS`


**`TicketVerificationStatus`** — enum : `NOT_SUBMITTED`, `PENDING`, `VERIFIED`, `REJECTED`


**`TrainTripType`** — enum : `DIRECT`, `WITH_CONNECTION`


**`TransportMode`** — enum : `PLANE`, `TRAIN`, `CAR`


**`TransportModeFilter`** — enum : `all`, `plane`, `train`, `car` — Filtre mode de la recherche (all = tous)


**`Trip`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `userId` | ObjectId | oui |  |
| `carrierPageId` | ObjectId \| null | non |  |
| `status` | TripStatus | oui |  |
| `currentStep` | integer \| null | non | Étape du wizard (1-3) |
| `transportMode` | TransportMode \| null | non |  |
| `tripType` | TripType \| null | non |  |
| `originLabel` | string \| null | non |  |
| `originPlaceId` | string \| null | non |  |
| `originCity` | string \| null | non |  |
| `originCityCode` | string \| null | non |  |
| `originRegion` | string \| null | non |  |
| `originRegionCode` | string \| null | non |  |
| `originCountry` | string \| null | non |  |
| `originCountryCode` | string \| null | non |  |
| `originLat` | number \| null | non |  |
| `originLng` | number \| null | non |  |
| `originTimezone` | string \| null | non |  |
| `destinationLabel` | string \| null | non |  |
| `destinationPlaceId` | string \| null | non |  |
| `destinationCity` | string \| null | non |  |
| `destinationCityCode` | string \| null | non |  |
| `destinationRegion` | string \| null | non |  |
| `destinationRegionCode` | string \| null | non |  |
| `destinationCountry` | string \| null | non |  |
| `destinationCountryCode` | string \| null | non |  |
| `destinationLat` | number \| null | non |  |
| `destinationLng` | number \| null | non |  |
| `destinationTimezone` | string \| null | non |  |
| `departureDateLocal` | string \| null | non |  |
| `departureTimeLocal` | string \| null | non |  |
| `arrivalDateLocal` | string \| null | non |  |
| `arrivalTimeLocal` | string \| null | non |  |
| `departureAt` | string \| null | non |  |
| `arrivalAt` | string \| null | non |  |
| `returnDepartureAt` | string \| null | non |  |
| `returnArrivalAt` | string \| null | non |  |
| `flightType` | FlightType \| null | non |  |
| `flightLayoverCities` | array \| null | non |  |
| `trainTripType` | TrainTripType \| null | non |  |
| `trainStopCities` | array \| null | non |  |
| `carTripFlexibility` | CarTripFlexibility \| null | non |  |
| `travelReference` | string \| null | non |  |
| `ticketVerificationStatus` | TicketVerificationStatus \| null | non |  |
| `acceptedCategories` | array<ParcelCategory> | oui |  |
| `categoryConditions` | array \| null | non |  |
| `pricePerKgCents` | integer \| null | non | D13 — carrier's single price per kg, in cents. Null = legacy PER_CATEGORY trip |
| `checkedBag23PriceCents` | integer \| null | non | PRC-04 — full 23kg checked bag flat rate (consumes 23kg of capacity). Null = not offered |
| `cabinBag12PriceCents` | integer \| null | non | PRC-04 — full 12kg cabin bag flat rate. Null = not offered |
| `capacityKg` | number \| null | non | CAP-01/D19 — carrier declared capacity in kg (immutable after publication). Required alongside pricePerKgCents to publish PER_KG (gate A28) |
| `familyConditions` | array \| null | non | D14 — per-family stance (NEW engine). Null/empty = all families accepted |
| `reservedKg` | number \| null | non | CAP-02 — atomic server counter. remainingKg = capacityKg - reservedKg (derived, never stored) |
| `pickupLocations` | array \| null | non |  |
| `deliveryLocations` | array \| null | non |  |
| `handDeliveryOnly` | boolean | oui |  |
| `instantBooking` | boolean | oui | D20 : sans effet sur la machine d'états v1 (badge) |
| `currencyCode` | string | oui |  |
| `maxSlots` | integer \| null | non | null = capacité illimitée |
| `bookedSlots` | integer | oui | Slots réservés (chantier Booking) |
| `notes` | string \| null | non |  |
| `minPriceCents` | integer \| null | non | min(categoryConditions.priceAmountCents) — null si aucune condition ; les trips PER_KG restent null (moteurs incomparables, exclus du tri lowestPrice — A28) |
| `departureHourLocal` | integer \| null | non | Heure locale de départ (0-23), pour les buckets de recherche |
| `carrierRatingSnapshot` | number \| null | non | Note carrier figée à la publication (tri bestRated) |
| `documents` | array \| null | non |  |
| `user` | TripUserSummary \| null | non |  |
| `carrierPage` | TripCarrierSummary \| null | non |  |
| `publishedAt` | string \| null | non |  |
| `cancelledAt` | string \| null | non |  |
| `archivedAt` | string \| null | non |  |
| `isDeleted` | boolean | non |  |
| `deletedAt` | string \| null | non |  |
| `createdAt` | string (date-time) | oui |  |
| `updatedAt` | string (date-time) | oui |  |


**`TripAction`** — enum : `edit`, `publish`, `unpublish`, `pause`, `resume`, `cancel`, `restore`, `archive`, `delete` — Actions de la state machine trip (canPerform/getAllowedActions). Renvoyées dans allowedActions pour piloter les CTAs front.


**`TripCarrierSummary`** — Select partiel de la carrierPage (vue détail owner)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `name` | string \| null | non |  |
| `ratingsAvg` | number \| null | non |  |
| `ratingsCount` | integer | oui |  |
| `isVerified` | boolean | oui |  |


**`TripDocument`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `type` | TripDocumentType | oui |  |
| `status` | TripDocumentStatus | oui |  |
| `url` | string | oui | URL ImageKit du document |
| `fileId` | string | non | Identifiant ImageKit (pour suppression) |
| `tripId` | ObjectId | non |  |
| `uploadedByUserId` | ObjectId \| null | non |  |
| `originalName` | string \| null | non |  |
| `mimeType` | string \| null | non |  |
| `sizeBytes` | integer \| null | non |  |
| `title` | string \| null | non |  |
| `description` | string \| null | non |  |
| `verifiedAt` | string \| null | non |  |
| `rejectedAt` | string \| null | non |  |
| `rejectionReason` | string \| null | non |  |
| `createdAt` | string (date-time) | non |  |
| `updatedAt` | string (date-time) | non |  |


**`TripDocumentStatus`** — enum : `PENDING`, `VERIFIED`, `REJECTED`, `EXPIRED` — Statut de modération du document. EXPIRED (C-PR4, D57 8A) : billet resté en attente sur un trajet déjà parti.


**`TripDocumentType`** — enum : `TICKET_PROOF`, `ITINERARY_PROOF`, `VEHICLE_PROOF`, `IDENTITY_PROOF`, `OTHER` — Type de justificatif. TICKET_PROOF pilote ticketVerificationStatus (NOT_SUBMITTED → PENDING à l'ajout, retour à NOT_SUBMITTED si dernier ticket supprimé).


**`TripFamilyCondition`** — NEW engine family condition (D14) — coexists with legacy CategoryCondition until cleanup

| Champ | Type | Requis | Description |
|---|---|---|---|
| `familyKey` | ParcelFamily | oui |  |
| `mode` | FamilyConditionMode | oui |  |
| `surchargePct` | integer \| null | non | Required when mode=SURCHARGE (e.g. electronics +20%) |


**`TripFavoriteState`** — État du favori après l'action (idempotent)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `tripId` | ObjectId | oui |  |
| `isFavorite` | boolean | oui |  |


**`TripLocationPoint`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `kind` | LocationKind | oui |  |
| `details` | string \| null | non |  |
| `flexibility` | LocationFlexibility | oui |  |
| `radiusKm` | number \| null | non | Requis si flexibility=RADIUS |


**`TripMutationResponse`** — Réponse des mutations renvoyant le trip (sans allowedActions)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `message` | string | oui |  |
| `trip` | Trip | oui |  |


**`TripResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `trip` | TripWithActions | oui |  |


**`TripStatus`** — enum : `DRAFT`, `PUBLISHED`, `PAUSED`, `COMPLETED`, `CANCELLED`, `ARCHIVED`


**`TripType`** — enum : `ONE_WAY`, `ROUND_TRIP`


**`TripUserSummary`** — Select partiel du user (vue détail owner)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `firstName` | string \| null | non |  |
| `lastName` | string \| null | non |  |
| `avatar` | object \| null | non |  |


**`TripWithActions`** — Trip + allowedActions (getAllowedActions) — pilote les CTAs front

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `userId` | ObjectId | oui |  |
| `carrierPageId` | ObjectId \| null | non |  |
| `status` | TripStatus | oui |  |
| `currentStep` | integer \| null | non | Étape du wizard (1-3) |
| `transportMode` | TransportMode \| null | non |  |
| `tripType` | TripType \| null | non |  |
| `originLabel` | string \| null | non |  |
| `originPlaceId` | string \| null | non |  |
| `originCity` | string \| null | non |  |
| `originCityCode` | string \| null | non |  |
| `originRegion` | string \| null | non |  |
| `originRegionCode` | string \| null | non |  |
| `originCountry` | string \| null | non |  |
| `originCountryCode` | string \| null | non |  |
| `originLat` | number \| null | non |  |
| `originLng` | number \| null | non |  |
| `originTimezone` | string \| null | non |  |
| `destinationLabel` | string \| null | non |  |
| `destinationPlaceId` | string \| null | non |  |
| `destinationCity` | string \| null | non |  |
| `destinationCityCode` | string \| null | non |  |
| `destinationRegion` | string \| null | non |  |
| `destinationRegionCode` | string \| null | non |  |
| `destinationCountry` | string \| null | non |  |
| `destinationCountryCode` | string \| null | non |  |
| `destinationLat` | number \| null | non |  |
| `destinationLng` | number \| null | non |  |
| `destinationTimezone` | string \| null | non |  |
| `departureDateLocal` | string \| null | non |  |
| `departureTimeLocal` | string \| null | non |  |
| `arrivalDateLocal` | string \| null | non |  |
| `arrivalTimeLocal` | string \| null | non |  |
| `departureAt` | string \| null | non |  |
| `arrivalAt` | string \| null | non |  |
| `returnDepartureAt` | string \| null | non |  |
| `returnArrivalAt` | string \| null | non |  |
| `flightType` | FlightType \| null | non |  |
| `flightLayoverCities` | array \| null | non |  |
| `trainTripType` | TrainTripType \| null | non |  |
| `trainStopCities` | array \| null | non |  |
| `carTripFlexibility` | CarTripFlexibility \| null | non |  |
| `travelReference` | string \| null | non |  |
| `ticketVerificationStatus` | TicketVerificationStatus \| null | non |  |
| `acceptedCategories` | array<ParcelCategory> | oui |  |
| `categoryConditions` | array \| null | non |  |
| `pricePerKgCents` | integer \| null | non | D13 — carrier's single price per kg, in cents. Null = legacy PER_CATEGORY trip |
| `checkedBag23PriceCents` | integer \| null | non | PRC-04 — full 23kg checked bag flat rate (consumes 23kg of capacity). Null = not offered |
| `cabinBag12PriceCents` | integer \| null | non | PRC-04 — full 12kg cabin bag flat rate. Null = not offered |
| `capacityKg` | number \| null | non | CAP-01/D19 — carrier declared capacity in kg (immutable after publication). Required alongside pricePerKgCents to publish PER_KG (gate A28) |
| `familyConditions` | array \| null | non | D14 — per-family stance (NEW engine). Null/empty = all families accepted |
| `reservedKg` | number \| null | non | CAP-02 — atomic server counter. remainingKg = capacityKg - reservedKg (derived, never stored) |
| `pickupLocations` | array \| null | non |  |
| `deliveryLocations` | array \| null | non |  |
| `handDeliveryOnly` | boolean | oui |  |
| `instantBooking` | boolean | oui | D20 : sans effet sur la machine d'états v1 (badge) |
| `currencyCode` | string | oui |  |
| `maxSlots` | integer \| null | non | null = capacité illimitée |
| `bookedSlots` | integer | oui | Slots réservés (chantier Booking) |
| `notes` | string \| null | non |  |
| `minPriceCents` | integer \| null | non | min(categoryConditions.priceAmountCents) — null si aucune condition ; les trips PER_KG restent null (moteurs incomparables, exclus du tri lowestPrice — A28) |
| `departureHourLocal` | integer \| null | non | Heure locale de départ (0-23), pour les buckets de recherche |
| `carrierRatingSnapshot` | number \| null | non | Note carrier figée à la publication (tri bestRated) |
| `documents` | array \| null | non |  |
| `user` | TripUserSummary \| null | non |  |
| `carrierPage` | TripCarrierSummary \| null | non |  |
| `publishedAt` | string \| null | non |  |
| `cancelledAt` | string \| null | non |  |
| `archivedAt` | string \| null | non |  |
| `isDeleted` | boolean | non |  |
| `deletedAt` | string \| null | non |  |
| `createdAt` | string (date-time) | oui |  |
| `updatedAt` | string (date-time) | oui |  |
| `allowedActions` | AllowedActions | oui |  |


**`TripsListResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `trips` | array<TripWithActions> | oui |  |
| `count` | integer | oui |  |


**`UiParcelCategory`** — enum : `clothes`, `shoes`, `fashion-accessories`, `other-accessories`, `books`, `documents`, `small-toys`, `phone`, `computer`, `other-electronics`, `checked-bag-23kg`, `cabin-bag-12kg` — Catégorie colis en convention UI (kebab-case)


**`UiTransportMode`** — enum : `plane`, `train`, `car` — Mode de transport en convention UI (≠ enum Prisma)


**`UnauthorizedResponse`** — 401 du middleware isAuthenticated (token absent, invalide, expiré, ou compte introuvable) — hors error-middleware

| Champ | Type | Requis | Description |
|---|---|---|---|
| `message` | string | oui |  |


**`UnhandledError`** — 500 non géré (exception hors AppError) — champ `error`, pas `message`

| Champ | Type | Requis | Description |
|---|---|---|---|
| `status` | string | oui |  |
| `error` | string | oui |  |


**`UpdateTripBody`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `transportMode` | TransportMode | non |  |
| `tripType` | TripType | non |  |
| `originLabel` | string | non |  |
| `originPlaceId` | string \| null | non |  |
| `originCity` | string \| null | non |  |
| `originCityCode` | string \| null | non |  |
| `originRegion` | string \| null | non |  |
| `originRegionCode` | string \| null | non |  |
| `originCountry` | string \| null | non |  |
| `originCountryCode` | string \| null | non |  |
| `originLat` | number \| null | non |  |
| `originLng` | number \| null | non |  |
| `originTimezone` | string \| null | non |  |
| `destinationLabel` | string | non |  |
| `destinationPlaceId` | string \| null | non |  |
| `destinationCity` | string \| null | non |  |
| `destinationCityCode` | string \| null | non |  |
| `destinationRegion` | string \| null | non |  |
| `destinationRegionCode` | string \| null | non |  |
| `destinationCountry` | string \| null | non |  |
| `destinationCountryCode` | string \| null | non |  |
| `destinationLat` | number \| null | non |  |
| `destinationLng` | number \| null | non |  |
| `destinationTimezone` | string \| null | non |  |
| `departureDateLocal` | string \| null | non |  |
| `departureTimeLocal` | string \| null | non |  |
| `arrivalDateLocal` | string \| null | non |  |
| `arrivalTimeLocal` | string \| null | non |  |
| `departureAt` | string \| null | non |  |
| `arrivalAt` | string \| null | non |  |
| `returnDepartureAt` | string \| null | non |  |
| `returnArrivalAt` | string \| null | non |  |
| `flightType` | FlightType \| null | non |  |
| `flightLayoverCities` | array \| null | non |  |
| `trainTripType` | TrainTripType \| null | non |  |
| `trainStopCities` | array \| null | non |  |
| `carTripFlexibility` | CarTripFlexibility \| null | non |  |
| `travelReference` | string \| null | non |  |
| `acceptedCategories` | array<ParcelCategory> | non |  |
| `categoryConditions` | array \| null | non |  |
| `pricePerKgCents` | integer \| null | non | D13 — carrier's single price per kg, in cents. Null = legacy PER_CATEGORY trip |
| `checkedBag23PriceCents` | integer \| null | non | PRC-04 — full 23kg checked bag flat rate (consumes 23kg of capacity). Null = not offered |
| `cabinBag12PriceCents` | integer \| null | non | PRC-04 — full 12kg cabin bag flat rate. Null = not offered |
| `capacityKg` | number \| null | non | CAP-01/D19 — carrier declared capacity in kg (immutable after publication). Required alongside pricePerKgCents to publish PER_KG (gate A28) |
| `familyConditions` | array \| null | non | D14 — per-family stance (NEW engine). Null/empty = all families accepted |
| `pickupLocations` | array \| null | non |  |
| `deliveryLocations` | array \| null | non |  |
| `handDeliveryOnly` | boolean | non |  |
| `instantBooking` | boolean | non |  |
| `currencyCode` | string | non |  |
| `maxSlots` | integer \| null | non |  |
| `notes` | string \| null | non |  |
| `publish` | boolean | non | true = créer directement en PUBLISHED (si gates onboarding/Stripe/locations OK) |


**`YambaTripResult`** — Carte résultat de recherche (DTO UI)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `fromCity` | string | oui |  |
| `fromCityCode` | string | non |  |
| `fromCountry` | string | non |  |
| `toCity` | string | oui |  |
| `toCityCode` | string | non |  |
| `toCountry` | string | non |  |
| `travelDate` | string | oui | Formaté serveur selon locale |
| `departureTime` | string | oui |  |
| `arrivalTime` | string | oui |  |
| `nextDay` | boolean | non | Arrivée le lendemain (absent si false) |
| `durationMinutes` | integer | non |  |
| `stopovers` | integer | non |  |
| `stopoverCity` | string | non | Présent uniquement si exactement 1 escale |
| `minPrice` | number | oui | En unités (euros), PAS en centimes — déjà divisé par 100. 0 pour un trip PER_KG (voir pricePerKg) |
| `pricePerKg` | number \| null | non | D13 — moteur PER_KG : prix au kilo en unités (euros). Null = trip legacy PER_CATEGORY |
| `remainingKg` | number \| null | non | CAP-02 — capacityKg − reservedKg, dérivé. Null si legacy |
| `weightKg` | number | non | D33 V2 — écho du poids saisi par l'Expéditeur (kg) ; absent sinon |
| `transportForWeight` | number \| null | non | D33 V2 — transport (net Voyageur) pour ce poids, en euros. Null = aucun moteur |
| `totalForWeight` | number \| null | non | D33 V2 — total Expéditeur (transport + service D16) pour ce poids, en euros |
| `familyConditions` | array<objet { familyKey, mode, surchargePct }> | non | D14 — positions ≠ ACCEPT du Voyageur (compact). Absent/vide = tout accepté |
| `pricesByCategory` | object | oui | Clés = UiParcelCategory, valeurs en unités (euros) |
| `currency` | string | oui | Symbole, pas le code ISO |
| `transportMode` | UiTransportMode | oui |  |
| `allowedCategories` | array<UiParcelCategory> | oui |  |
| `remainingSlots` | integer | non | Absent si capacité illimitée (maxSlots null) |
| `superTripper` | boolean | oui |  |
| `profileVerified` | boolean | oui |  |
| `instantBooking` | boolean | oui |  |
| `verifiedTicket` | boolean | oui |  |
| `rating` | number | non | Absent si ratingsCount = 0 (jamais de 0,0) |
| `reviewCount` | integer | non |  |
| `travelerFirstName` | string | non |  |
| `travelerLastName` | string | non | Initiale uniquement (privacy) |
| `travelerAvatarUrl` | string | non |  |
| `isFavorite` | boolean | non | D46 — true si l'utilisateur connecté a mis ce trajet en favori (absent/false pour un visiteur) |
| `viewsCount` | integer | non | D5 / C-PR6 — vues de la page publique, dédoublonnées par visiteur et par jour (Redis) ; absent si Redis indisponible |


## deal-service — port 6003

Réservations (deals), paiement, transport, litiges, versements, notation, suivi destinataire. Document vivant : `http://localhost:6003/docs` (Scalar) et `apps/deal-service/openapi.json`. Via le gateway : `http://localhost:8080/api` (préfixes ci-dessous).


### deal-service › system

Health & meta


#### `GET /openapi.json`

**This OpenAPI 3.1 document**  
`operationId` : `getOpenApiDocument` · Authentification : aucune (public)

| Code | Réponse |
|---|---|
| 200 | objet {  } — OpenAPI 3.1 document (generated from Zod) |


#### `GET /health`

**Health check**  
`operationId` : `getHealth` · Authentification : aucune (public)

| Code | Réponse |
|---|---|
| 200 | objet { status, service } — Service is up (no DB dependency) |


### deal-service › deals

Deal read views, role-based (auth required)


#### `GET /deals`

**Deals of one of my trips (carrier view)**  
`operationId` : `listTripDeals` · Authentification : cookieAuth, bearerAuth

Returns the deals attached to a trip OWNED by the caller (A12: ownership checked by direct read-only Trip lookup). Carrier view: no delivery code, no code hash, no shipper totals — earnings only.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `tripId` | query | oui | ObjectId | Trip whose deals are requested — must belong to the caller |
| `status` | query | non | BookingStatus | Filter by booking status (exact match) |

| Code | Réponse |
|---|---|
| 200 | TripDealsResponse — Deals of the trip (CarrierBookingView[]) |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /deals`

**Create a deal request (PENDING) — step 2 (D37)**  
`operationId` : `createBooking` · Authentification : cookieAuth, bearerAuth

Re-validates everything server-side (trip bookable, quote identical — D17, payment authorized and matching), then in ONE Mongo transaction: conditional reservedKg increment (CAP-01), Booking with 5 frozen snapshots, and 2 outbox events (booking.requested, booking.payment_authorized). The carrier is notified by the relay; the 24h acceptance window starts (DEA-01).

Corps (requis) : `CreateBookingRequest`

| Code | Réponse |
|---|---|
| 201 | CreateBookingResponse — Deal created (PENDING) |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 409 | ErrorResponse — Business conflict — details.code ∈ QUOTE_DIVERGENCE / CAPACITY_EXCEEDED / FAMILY_REFUSED / TRIP_NOT_BOOKABLE / OWN_TRIP / PAYMENT_NOT_AUTHORIZED / PAYMENT_MISMATCH / PAYMENT_ALREADY_USED / NEW_ACCOUNT_CAP (D71: details.cap ∈ DECLARED_VALUE / WEIGHT / SHIPMENTS_PER_MONTH, limit, value) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /deals/payment-intents`

**Authorize the shipper's payment for a quote (step 1 of a request — D37)**  
`operationId` : `createPaymentIntent` · Authentification : cookieAuth, bearerAuth

The server recomputes the quote with the single pricing engine (@packages/pricing, D34) and authorizes the total with the PaymentProvider (D11, manual capture — captured at acceptance, D31). Nothing is persisted: an abandoned intent simply expires. 409 with details.code when the total the shipper saw differs (QUOTE_DIVERGENCE), the family is refused, or the trip is not bookable.

Corps (requis) : `CreatePaymentIntentRequest`

| Code | Réponse |
|---|---|
| 201 | CreatePaymentIntentResponse — Authorization created (clientSecret null for FAKE) |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 409 | ErrorResponse — Business conflict — details.code ∈ QUOTE_DIVERGENCE / CAPACITY_EXCEEDED / FAMILY_REFUSED / TRIP_NOT_BOOKABLE / OWN_TRIP / PAYMENT_NOT_AUTHORIZED / PAYMENT_MISMATCH / PAYMENT_ALREADY_USED / NEW_ACCOUNT_CAP (D71: details.cap ∈ DECLARED_VALUE / WEIGHT / SHIPMENTS_PER_MONTH, limit, value) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /deals/{id}/accept`

**Accept a deal request (carrier) — capture at acceptance (D39)**  
`operationId` : `acceptDeal` · Authentification : cookieAuth, bearerAuth

Carrier only, charter checkbox required. The D31 gate (completed profile + Stripe onboarding) is enforced HERE — no longer at trip publication. The shipper's authorization is CAPTURED (money moves now — an authorization expires in ~7 days, capturing at D-1 would break early acceptances), then in ONE Mongo transaction: conditional PENDING→ACCEPTED, acceptedAt/capturedAt, outbox booking.accepted.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

Corps (requis) : `AcceptDealRequest`

| Code | Réponse |
|---|---|
| 200 | DealTransitionResponse — Deal accepted (refundAmountCents null) |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 409 | ErrorResponse — Business conflict — details.code ∈ TRANSITION_NOT_ALLOWED (the state machine refused: status, role or guard — details carry its reason) / CARRIER_ONBOARDING_REQUIRED (D31 gate: profile or Stripe onboarding incomplete) / PAYMENT_STATE_CONFLICT (the provider-side payment state forbids the operation) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /deals/{id}/decline`

**Decline a deal request (carrier)**  
`operationId` : `declineDeal` · Authentification : cookieAuth, bearerAuth

Carrier only, optional reason among 5 (spec É2). The authorization is released (never captured), then in ONE Mongo transaction: conditional PENDING→DECLINED, reserved kg released (CAP-02), outbox booking.declined + booking.refund_issued (full amount).

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

Corps (facultatif) : `DeclineDealRequest`

| Code | Réponse |
|---|---|
| 200 | DealTransitionResponse — Deal declined, full amount returned to the shipper |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 409 | ErrorResponse — Business conflict — details.code ∈ TRANSITION_NOT_ALLOWED (the state machine refused: status, role or guard — details carry its reason) / CARRIER_ONBOARDING_REQUIRED (D31 gate: profile or Stripe onboarding incomplete) / PAYMENT_STATE_CONFLICT (the provider-side payment state forbids the operation) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /deals/{id}/cancel`

**Cancel a deal (shipper) — ANN-01 policy**  
`operationId` : `cancelDeal` · Authentification : cookieAuth, bearerAuth

Shipper only. PENDING: the authorization is released in full. ACCEPTED (payment captured — D39): a real refund per ANN-01 — 100% until 48h before departure, then a 50% retention (CANCEL_LATE_RETENTION_PCT, owed to the carrier — paid out with the B4 payout infrastructure). After PICKED_UP cancellation is impossible (dispute is the only path). One Mongo transaction: conditional transition, kg released (CAP-02), outbox booking.cancelled + booking.refund_issued.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

Corps (facultatif) : `CancelDealRequest`

| Code | Réponse |
|---|---|
| 200 | DealTransitionResponse — Deal cancelled, refundAmountCents per ANN-01 |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 409 | ErrorResponse — Business conflict — details.code ∈ TRANSITION_NOT_ALLOWED (the state machine refused: status, role or guard — details carry its reason) / CARRIER_ONBOARDING_REQUIRED (D31 gate: profile or Stripe onboarding incomplete) / PAYMENT_STATE_CONFLICT (the provider-side payment state forbids the operation) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /deals/{id}/pickup`

**Confirm the parcel pickup (carrier) — generates the delivery code**  
`operationId` : `confirmPickup` · Authentification : cookieAuth, bearerAuth

Carrier only. Requires ALL 5 inspection items (CNF-04) and 1 to 5 photo URLs already uploaded to ImageKit by the browser (D42 — no bytes go through this API). ACCEPTED→PICKED_UP in ONE Mongo transaction with the server-generated 6-digit delivery code stored twice (bcrypt for validation, AES-256-GCM for shipper re-display — D43), the frozen checklist and photos, outbox booking.picked_up. The code is revealed to the SHIPPER on GET /deals/:id only — never in this response, never to the carrier.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

Corps (requis) : `ConfirmPickupRequest`

| Code | Réponse |
|---|---|
| 200 | DealTransitionResponse — Parcel picked up (status PICKED_UP, refundAmountCents null) |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 409 | ErrorResponse — Business conflict — details.code ∈ TRANSITION_NOT_ALLOWED (state machine refused, or a concurrent write won) / PAYMENT_STATE_CONFLICT (refund impossible) / DELIVERY_CODE_INVALID (details.attemptsLeft) / DELIVERY_LOCKED (details.lockedUntil — 3 failures, 15 min) / DELIVERY_CODE_UNAVAILABLE (pre-B3 record without a code) / TRACKING_STEP_NOT_ALLOWED (strict sequence, duplicate or wrong status) / CODE_REGENERATION_LIMIT (5 reached, or not in transit) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /deals/{id}/pickup/refuse`

**Refuse the parcel at pickup (carrier) — full refund, no penalty**  
`operationId` : `refusePickup` · Authentification : cookieAuth, bearerAuth

Carrier only, optional reason among 5 (A40). The captured payment is REFUNDED in full at the provider (money first), then ACCEPTED→CANCELLED (closedBy CARRIER, pickupRefusalReason), reserved kg released (CAP-02), outbox booking.pickup_refused + booking.refund_issued. No reputation penalty (CNF-07).

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

Corps (facultatif) : `RefusePickupRequest`

| Code | Réponse |
|---|---|
| 200 | DealTransitionResponse — Deal cancelled, full amount returned to the shipper |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 409 | ErrorResponse — Business conflict — details.code ∈ TRANSITION_NOT_ALLOWED (state machine refused, or a concurrent write won) / PAYMENT_STATE_CONFLICT (refund impossible) / DELIVERY_CODE_INVALID (details.attemptsLeft) / DELIVERY_LOCKED (details.lockedUntil — 3 failures, 15 min) / DELIVERY_CODE_UNAVAILABLE (pre-B3 record without a code) / TRACKING_STEP_NOT_ALLOWED (strict sequence, duplicate or wrong status) / CODE_REGENERATION_LIMIT (5 reached, or not in transit) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /deals/{id}/events`

**Confirm an optional tracking milestone (carrier)**  
`operationId` : `confirmTrackingStep` · Authentification : cookieAuth, bearerAuth

Carrier only, while PICKED_UP. Strict sequence AT_AIRPORT → FLIGHT_DEPARTED → FLIGHT_ARRIVED, no skip, no duplicate (409 TRACKING_STEP_NOT_ALLOWED). No status transition: the milestone is pushed in ONE transaction guarded by its absence, outbox booking.tracking_event (shipper in-app only, no email). The 5-second undo is client-side (A39): call this endpoint AFTER the undo window — there is no server undo.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

Corps (requis) : `ConfirmTrackingStepRequest`

| Code | Réponse |
|---|---|
| 200 | TrackingStepResponse — Milestone confirmed — full sequence returned |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 409 | ErrorResponse — Business conflict — details.code ∈ TRANSITION_NOT_ALLOWED (state machine refused, or a concurrent write won) / PAYMENT_STATE_CONFLICT (refund impossible) / DELIVERY_CODE_INVALID (details.attemptsLeft) / DELIVERY_LOCKED (details.lockedUntil — 3 failures, 15 min) / DELIVERY_CODE_UNAVAILABLE (pre-B3 record without a code) / TRACKING_STEP_NOT_ALLOWED (strict sequence, duplicate or wrong status) / CODE_REGENERATION_LIMIT (5 reached, or not in transit) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /deals/{id}/code/regenerate`

**Regenerate the delivery code (shipper) — max 5**  
`operationId` : `regenerateDeliveryCode` · Authentification : cookieAuth, bearerAuth

Shipper only, while PICKED_UP, at most MAX_CODE_REGENERATIONS (5). A new code replaces the previous one (old hash invalid immediately), delivery attempts and lock are reset, outbox booking.code_regenerated (count only — the code never travels in events or emails). The NEW code is returned here and on GET /deals/:id (shipper view). Optimistic guard on the regeneration counter (two clicks = one regeneration).

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

| Code | Réponse |
|---|---|
| 200 | RegenerateCodeResponse — New 6-digit code and remaining regenerations |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 409 | ErrorResponse — Business conflict — details.code ∈ TRANSITION_NOT_ALLOWED (state machine refused, or a concurrent write won) / PAYMENT_STATE_CONFLICT (refund impossible) / DELIVERY_CODE_INVALID (details.attemptsLeft) / DELIVERY_LOCKED (details.lockedUntil — 3 failures, 15 min) / DELIVERY_CODE_UNAVAILABLE (pre-B3 record without a code) / TRACKING_STEP_NOT_ALLOWED (strict sequence, duplicate or wrong status) / CODE_REGENERATION_LIMIT (5 reached, or not in transit) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /deals/{id}/deliver`

**Validate the delivery code (carrier) — PICKED_UP → DELIVERED**  
`operationId` : `deliverDeal` · Authentification : cookieAuth, bearerAuth

Carrier only. The 6-digit code given by the recipient is compared with bcrypt server-side. Wrong code: attempts +1 (conditional write on the counter read — A38) → 409 DELIVERY_CODE_INVALID with attemptsLeft; 3rd failure → 15-minute lock AND counter reset → 409 DELIVERY_LOCKED with lockedUntil; an active lock is refused by the state machine before any comparison. Valid code: PICKED_UP→DELIVERED in ONE transaction, payoutDueAt = deliveredAt + 4 days (shipper verification window, B4), outbox booking.delivered.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

Corps (requis) : `DeliverDealRequest`

| Code | Réponse |
|---|---|
| 200 | DeliverDealResponse — Delivered — verification window started |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 409 | ErrorResponse — Business conflict — details.code ∈ TRANSITION_NOT_ALLOWED (state machine refused, or a concurrent write won) / PAYMENT_STATE_CONFLICT (refund impossible) / DELIVERY_CODE_INVALID (details.attemptsLeft) / DELIVERY_LOCKED (details.lockedUntil — 3 failures, 15 min) / DELIVERY_CODE_UNAVAILABLE (pre-B3 record without a code) / TRACKING_STEP_NOT_ALLOWED (strict sequence, duplicate or wrong status) / CODE_REGENERATION_LIMIT (5 reached, or not in transit) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /deals/{id}/confirm`

**Confirm the delivery early (shipper) — DELIVERED → COMPLETED, payout released (INV-3: final)**  
`operationId` : `confirmDeal` · Authentification : cookieAuth, bearerAuth

Shipper only, while DELIVERED. ONE conditional transaction: COMPLETED, completedBy=SHIPPER, payoutStatus=PENDING, outbox booking.completed (D49). Then the carrier payout is executed INLINE (A67): PaymentProvider.transfer of pricing.transportCents (carrier net, D50) to the carrier's Connect account, idempotency key = booking id, source_transaction = capture charge (A69). Success → payoutStatus SENT + outbox booking.payout_sent; provider refusal → FAILED (retried by the payout cron every 5 min, up to 10 attempts). Irreversible: the right to dispute is gone.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

| Code | Réponse |
|---|---|
| 200 | ConfirmDealResponse — Completed — payoutStatus tells whether the transfer went through |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 409 | ErrorResponse — Business conflict — details.code ∈ TRANSITION_NOT_ALLOWED (state machine refused: not DELIVERED, verification window over, parcel in transit for less than 48h after departure, or a concurrent write won — details carry its reason) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /deals/{id}/dispute`

**Open a dispute (shipper) — DELIVERED (before D+4) or PICKED_UP (not delivered, 48h after departure) → DISPUTED**  
`operationId` : `disputeDeal` · Authentification : cookieAuth, bearerAuth

Shipper only. From DELIVERED before payoutDueAt (INV-4), or from PICKED_UP once the trip departure is 48h past (category MUST be NOT_DELIVERED — 400 otherwise). Body: category, description ≥ 50 chars, pledgeAccepted=true, up to 5 ImageKit photo URLs (D42), optional desiredOutcome. ONE transaction: DISPUTED, ticket YAM-XXXX (CSPRNG, unique — redrawn on collision), payoutStatus=FROZEN when a payout was scheduled (INV-5), Dispute document created (D51), outbox booking.disputed. Terminal in v1 — resolution belongs to the admin (chantier C).

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

Corps (requis) : `DisputeDealRequest`

| Code | Réponse |
|---|---|
| 200 | DisputeDealResponse — Dispute opened — payout frozen, ticket issued |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 409 | ErrorResponse — Business conflict — details.code ∈ TRANSITION_NOT_ALLOWED (state machine refused: not DELIVERED, verification window over, parcel in transit for less than 48h after departure, or a concurrent write won — details carry its reason) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /deals/{id}/tracking-link`

**Recipient tracking link (D69) — shipper only, one per deal, created on demand**  
`operationId` : `issueTrackingLink` · Authentification : cookieAuth, bearerAuth

Returns the public tracking token and path (/track/{token}) plus the recipient contact the shipper entered. 403 for the carrier, 409 TRACKING_NOT_AVAILABLE before acceptance or after a closure without delivery.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

| Code | Réponse |
|---|---|
| 200 | TrackingLinkResponse — Tracking link |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 409 | ErrorResponse — Business conflict — details.code ∈ QUOTE_DIVERGENCE / CAPACITY_EXCEEDED / FAMILY_REFUSED / TRIP_NOT_BOOKABLE / OWN_TRIP / PAYMENT_NOT_AUTHORIZED / PAYMENT_MISMATCH / PAYMENT_ALREADY_USED / NEW_ACCOUNT_CAP (D71: details.cap ∈ DECLARED_VALUE / WEIGHT / SHIPMENTS_PER_MONTH, limit, value) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /track/{token}`

**Recipient tracking page (D69) — public, minimal content**  
`operationId` : `getPublicTracking` · Authentification : aucune (public)

No session. Milestones (accepted → picked up → in transit → arrived → delivered, or closed), first names, corridor and dates. Never an address, a phone number, the delivery code, photos or amounts. 404 once the recipient snapshot is redacted (D63 5A), the link revoked or the deal deleted.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `token` | path | oui | string |  |

| Code | Réponse |
|---|---|
| 200 | PublicTrackingResponse — Tracking view |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /deals/{id}/rating`

**Rating context (B5, D53) — who I rate, my rating, whether the other rated, reveal**  
`operationId` : `getDealRatingContext` · Authentification : cookieAuth, bearerAuth

Either party. Double-blind: counterpartRating is null until both rated or the 14-day window elapsed. canRate is the state machine verdict (COMPLETED, window open, not rated yet by this role).

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

| Code | Réponse |
|---|---|
| 200 | RatingContextResponse — Rating context |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /deals/{id}/rating`

**Rate the other party (B5, D53) — once per role, COMPLETED, within 14 days**  
`operationId` : `submitDealRating` · Authentification : cookieAuth, bearerAuth

ONE transaction: Review (revealedAt null) + booking mark (optimistic lock on updatedAt). If the counterpart had already rated, both reviews are revealed now and outbox booking.rating_revealed (BOTH_RATED) is written; otherwise the cron reveals at the end of the window (WINDOW_ELAPSED). Only revealed reviews feed the public reputation (D29①). Criteria outside the rated role are dropped.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

Corps (requis) : `SubmitRatingRequest`

| Code | Réponse |
|---|---|
| 201 | SubmitRatingResponse — Rating recorded |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 409 | ErrorResponse — Business conflict — details.code ∈ TRANSITION_NOT_ALLOWED (state machine refused: not DELIVERED, verification window over, parcel in transit for less than 48h after departure, or a concurrent write won — details carry its reason) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /deals/{id}/dispute/statement`

**Carrier's statement on an open dispute (C-PR2, D55) — once, ≥ 50 chars, ≤ 5 photos**  
`operationId` : `submitCarrierDisputeStatement` · Authentification : cookieAuth, bearerAuth

Carrier only, status DISPUTED, dispute OPEN. Writes the statement + outbox booking.dispute_carrier_responded in one transaction. The admin may decide as soon as the statement is in, or 72h after the dispute was filed.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

Corps (requis) : `CarrierDisputeStatementRequest`

| Code | Réponse |
|---|---|
| 201 | CarrierDisputeStatementResponse — Statement recorded |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 409 | ErrorResponse — Business conflict — details.code ∈ TRANSITION_NOT_ALLOWED (state machine refused: not DELIVERED, verification window over, parcel in transit for less than 48h after departure, or a concurrent write won — details carry its reason) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /deals/{id}`

**One deal, role-based view**  
`operationId` : `getDeal` · Authentification : cookieAuth, bearerAuth

The DTO shape depends on the authenticated caller's role in the deal: ShipperBookingView (full pricing, delivery code surface) or CarrierBookingView (earnings only — the delivery code NEVER appears in any carrier payload). allowedActions = getAllowedActions(booking, role): the frontend reflects, never decides.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

| Code | Réponse |
|---|---|
| 200 | DealResponse — The deal, shaped by viewerRole |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


### deal-service › admin

Back-office (chantier C, D54) — ADMIN session with TOTP only


#### `GET /admin/disputes`

**Arbitration queue (chantier C, D54) — open disputes + retentions held for mediation**  
`operationId` : `adminListArbitrationQueue` · Authentification : cookieAuth, bearerAuth

ADMIN session only (admin_access_token cookie carrying amr totp). One queue, two kinds: DISPUTE (DISPUTED + Dispute OPEN) and RETENTION (CANCELLED after departure without pickup, retentionDisposition HELD_FOR_MEDIATION, A81). Oldest first.

| Code | Réponse |
|---|---|
| 200 | ArbitrationQueueResponse — Queue |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /admin/disputes/{id}`

**Mediation file (chantier C, D54) — both parties' evidence, money state, never the delivery code**  
`operationId` : `adminGetDisputeFile` · Authentification : cookieAuth, bearerAuth

ADMIN session only. Declaration photos, pickup checklist + photos, tracking events, delivery photos, dispute file (description, photos, desired outcome), money snapshot and payout/refund state. Reading a file is journaled (AdminAction DISPUTE_VIEWED). 404 when the deal is not awaiting arbitration.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

| Code | Réponse |
|---|---|
| 200 | AdminDisputeFile — File |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /admin/disputes/{id}/resolve`

**Decide a dispute (C-PR2, D55) — REJECTED / PARTIAL_REFUND / FULL_REFUND, reason ≥ 50 chars, irreversible**  
`operationId` : `adminResolveDispute` · Authentification : cookieAuth, bearerAuth

ADMIN session only. Refund FIRST (provider), then ONE transaction: DISPUTED → COMPLETED (rejected/partial) or → CANCELLED (full), dispute resolution, internal 'disputes lost' counter, AdminAction DISPUTE_RESOLVED, outbox booking.dispute_resolved. Then the carrier transfer through the payout executor (D49, retried by the cron on failure). 409 while the carrier still has time to answer.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

Corps (requis) : `AdminResolveDisputeRequest`

| Code | Réponse |
|---|---|
| 200 | AdminResolutionResponse — Decided |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 409 | ErrorResponse — Business conflict — details.code ∈ TRANSITION_NOT_ALLOWED (state machine refused: not DELIVERED, verification window over, parcel in transit for less than 48h after departure, or a concurrent write won — details carry its reason) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /admin/disputes/{id}/retention`

**Arbitrate a held retention (C-PR2, D55 3A) — COMPENSATE_CARRIER (pro-rata A79) or RESTITUTE_SHIPPER**  
`operationId` : `adminResolveRetention` · Authentification : cookieAuth, bearerAuth

ADMIN session only. CANCELLED + retentionDisposition HELD_FOR_MEDIATION. Amounts are server-computed. Journaled (RETENTION_ARBITRATED).

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

Corps (requis) : `AdminResolveRetentionRequest`

| Code | Réponse |
|---|---|
| 200 | AdminResolutionResponse — Arbitrated |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 409 | ErrorResponse — Business conflict — details.code ∈ TRANSITION_NOT_ALLOWED (state machine refused: not DELIVERED, verification window over, parcel in transit for less than 48h after departure, or a concurrent write won — details carry its reason) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /admin/finances/queue`

**Exception queues (D58 2A) — failed payouts, reversed transfers, retentions held**  
`operationId` : `adminListFinanceQueue` · Authentification : adminCookieAuth

Permission finances.read. FAILED = payoutStatus FAILED on COMPLETED / CANCELLED deals (reason kind, attempts, next retry — A111); REVERSED = transfer.reversed not yet resolved by an admin; HELD = retention HELD_FOR_MEDIATION. Amounts come from the booking, never recomputed.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `kind` | query | non | FinanceQueueKind | FAILED (défaut) · REVERSED · HELD |

| Code | Réponse |
|---|---|
| 200 | FinanceQueueResponse — Queue |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /admin/deals/{id}/money`

**Money file of any deal (D58 4A) — snapshot, payment, payout, retention, timeline, journal**  
`operationId` : `adminGetDealMoneyFile` · Authentification : adminCookieAuth

Permission finances.read. Provider identifiers in clear (finance needs them). Reading is journaled (AdminAction DEAL_MONEY_VIEWED). allowedActions reflects state AND conflict of interest.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

| Code | Réponse |
|---|---|
| 200 | AdminDealMoneyFile — File |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /admin/deals/{id}/money/reconcile`

**Reconcile with the payment provider (D58 4A, A112) — read-only, journaled**  
`operationId` : `adminReconcileDeal` · Authentification : adminCookieAuth

Permission finances.read. Calls PaymentProvider.inspect (intent, refunds, transfer) and lists divergences with the database (REFUND_NOT_RECORDED = a refund left the provider without a database write, D39). Never modifies the deal. Journal DEAL_RECONCILED.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

| Code | Réponse |
|---|---|
| 200 | PaymentReconciliation — Reconciliation |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /admin/deals/{id}/payout/retry`

**Retry a payout now (D58 3A) — same executor, idempotent**  
`operationId` : `adminRetryPayout` · Authentification : adminCookieAuth

Permission payouts.retry. Deal COMPLETED or CANCELLED with payoutStatus FAILED or PENDING; 403 when the admin is a party. Runs the unique payout executor (A65) without waiting for the retry schedule. Journal PAYOUT_RETRIED.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

| Code | Réponse |
|---|---|
| 200 | RetryPayoutResponse — Outcome |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /admin/deals/{id}/payout/reversal`

**Resolve a reversed transfer (D58 3A) — RESENT or WRITTEN_OFF, reason ≥ 20**  
`operationId` : `adminResolvePayoutReversal` · Authentification : adminCookieAuth

Permission payouts.resolve. Only on payoutStatus REVERSED not yet resolved (optimistic guard). RESENT: PENDING + a NEW idempotency key, then the executor sends a new transfer; WRITTEN_OFF: closed, nothing is sent. Resolution + journal PAYOUT_REVERSAL_RESOLVED in one transaction.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

Corps (requis) : `ResolveReversalRequest`

| Code | Réponse |
|---|---|
| 200 | ResolveReversalResponse — Outcome |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /admin/finances/report`

**Monthly finance report per currency (D58 5A) — computed from bookings, no ledger**  
`operationId` : `adminGetFinanceReport` · Authentification : adminCookieAuth

Permission finances.read. months = 1..24 (default 12, UTC months). Each money fact counts in ITS month: capture → capturedAt, refund → refundedAt, payout → payoutSentAt, revenue (commission + premium of COMPLETED deals) → completedAt, retention → closedAt. snapshot = today's liabilities (pending / frozen payouts, open reversals, retentions held, proposed refunds). Provider fees are not stored: reconcile with the Stripe export.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `months` | query | non | integer |  |

| Code | Réponse |
|---|---|
| 200 | FinanceReport — Report |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /admin/finances/export`

**CSV export per deal (D58 5A) — journaled, FINANCE only**  
`operationId` : `adminExportFinanceCsv` · Authentification : adminCookieAuth

Permission finances.export. from / to ISO date-times, at most 366 days. One line per deal with a money fact in the period: frozen amounts, refund (+ refundId), payout (+ transferId), retention, dates, dispute ticket, paymentIntentId, chargeId. Formula-looking cells are neutralised. Journal FINANCE_EXPORTED (period, row count).

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `from` | query | oui | string |  |
| `to` | query | oui | string |  |

| Code | Réponse |
|---|---|
| 200 | string — CSV (UTF-8 with BOM), Content-Disposition attachment, X-Row-Count |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /admin/deals/{id}/refund/propose`

**Propose a commercial refund (D58 3A-c) — FINANCE / SUPPORT**  
`operationId` : `adminProposeManualRefund` · Authentification : adminCookieAuth

Permission refunds.manual.propose. Closed deal (COMPLETED / CANCELLED) with a captured payment; amount ≤ total paid − already refunded; reason ≥ 50. No money moves. Journal REFUND_MANUAL_PROPOSED. 403 when the admin is a party.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

Corps (requis) : `ManualRefundRequest`

| Code | Réponse |
|---|---|
| 200 | objet { ok, proposedAt } — Proposed |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /admin/deals/{id}/refund`

**Apply a commercial refund (D58 3A-c) — SUPER_ADMIN only, money first**  
`operationId` : `adminApplyManualRefund` · Authentification : adminCookieAuth

Permission refunds.manual.apply (SUPER_ADMIN). Same bounds as the proposal. D39: provider.refund FIRST, then ONE conditional transaction (optimistic lock on the refunded total — two admins never refund twice): refundAmountCents cumulated, refundId, manual refund fields, proposal cleared, outbox booking.refund_issued (actor ADMIN → the shipper receives the standard refund email), journal REFUND_MANUAL_APPLIED. The carrier's payout is untouched: Yamba bears the gesture. A refund issued without a database write shows up in the reconciliation.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

Corps (requis) : `ManualRefundRequest`

| Code | Réponse |
|---|---|
| 200 | ManualRefundResponse — Refunded |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 409 | ErrorResponse — Business conflict — details.code ∈ QUOTE_DIVERGENCE / CAPACITY_EXCEEDED / FAMILY_REFUSED / TRIP_NOT_BOOKABLE / OWN_TRIP / PAYMENT_NOT_AUTHORIZED / PAYMENT_MISMATCH / PAYMENT_ALREADY_USED / NEW_ACCOUNT_CAP (D71: details.cap ∈ DECLARED_VALUE / WEIGHT / SHIPMENTS_PER_MONTH, limit, value) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /admin/alerts`

**Threshold alerts (D59 3A / 4A) — computed on read, no state**  
`operationId` : `adminListOpsAlerts` · Authentification : adminCookieAuth

Permission kpi.read. Rules with versioned thresholds: failed payouts > 48h, decidable disputes undecided > 72h, retentions held > 7d, open reversals > 48h, parked outbox events, relay lag > 15 min, failed emails (24h), no trip published for 7d, acceptance rate < 30% over 7d (≥ 5 requests). The hourly cron emails support once per rule and per day (Redis dedup); this endpoint always recomputes.

| Code | Réponse |
|---|---|
| 200 | OpsAlertsResponse — Alerts |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /admin/deals/{id}/history`

**Everything that happened to this deal (D59 5A) — outbox, admin journal, notifications, emails**  
`operationId` : `adminGetDealHistory` · Authentification : adminCookieAuth

Permission deals.history.read (MEDIATOR, SUPPORT, FINANCE). Read-only merge of the outbox (with relay state: published / pending / parked), the admin journal, in-app notifications and email deliveries, sorted by time. Outbox payloads are reduced to a whitelist — never a delivery code, a photo or an address. Reading is journaled (DEAL_HISTORY_VIEWED).

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Deal (booking) identifier |

| Code | Réponse |
|---|---|
| 200 | DealHistoryResponse — History |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError) |
| 404 | ErrorResponse — Deal or trip not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


### deal-service › me

Authenticated user's own resources


#### `GET /me/wallet`

**Finances — carrier payouts and shipper payments, totals computed server-side (A83)**  
`operationId` : `getMyWallet` · Authentification : cookieAuth, bearerAuth

Both roles of the caller in one payload. Carrier: UPCOMING (delivered, verification running) · PENDING · BLOCKED (Stripe account not ready) · FROZEN (dispute) · SENT · HELD (late cancellation after departure). Shipper: AUTHORIZED · HELD · RELEASED · RELEASED_NO_CHARGE · REFUNDED · PARTIALLY_REFUNDED. Amounts are integer cents; the frontend never recomputes.

| Code | Réponse |
|---|---|
| 200 | WalletResponse — Wallet for both roles |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /me/deals`

**My received deals (carrier view, all my trips)**  
`operationId` : `listMyDeals` · Authentification : cookieAuth, bearerAuth

All deals where the caller is the carrier, across all trips, newest first. CarrierBookingView (earnings only, no delivery code). One read for the trips list, the dashboard inbox and the sidebar badge.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `status` | query | non | BookingStatus | Filter by booking status (exact match) |

| Code | Réponse |
|---|---|
| 200 | MyDealsResponse — My received deals (CarrierBookingView[]) |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /me/bookings`

**My shipments (shipper view)**  
`operationId` : `listMyBookings` · Authentification : cookieAuth, bearerAuth

All deals where the caller is the shipper, newest first ('Mes envois').

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `status` | query | non | BookingStatus | Filter by booking status (exact match) |

| Code | Réponse |
|---|---|
| 200 | MyBookingsResponse — My shipments (ShipperBookingView[]) |
| 400 | ErrorResponse — Malformed request: invalid ObjectId or unknown status value (ValidationError) |
| 401 | UnauthorizedResponse — Token missing, invalid, expired, or account not found (isAuthenticated middleware) |
| 500 | UnhandledError — Unhandled server error |


### deal-service › schémas utilisés (114)


**`AcceptDealRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `charterAccepted` | boolean | oui | Carrier charter (verification, forbidden items, punctuality) — must be true (RGP-03) |


**`AdminDealMoneyFile`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `status` | string | oui |  |
| `disputeTicket` | string \| null | oui |  |
| `corridor` | object | oui |  |
| `shipper` | object | oui |  |
| `carrier` | object | oui |  |
| `pricing` | object | oui |  |
| `payment` | object | oui |  |
| `payout` | object | oui |  |
| `retention` | object \| null | oui |  |
| `dates` | object | oui |  |
| `timeline` | array<MoneyTimelineEvent> | oui |  |
| `adminActions` | array<objet { id, at, admin, action, after }> | oui |  |
| `manualRefund` | object | oui |  |
| `allowedActions` | object | oui |  |


**`AdminDisputeFile`** — Full mediation file for an admin — never the delivery code (D43)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `bookingId` | ObjectId | oui |  |
| `kind` | ArbitrationKind | oui |  |
| `status` | string | oui |  |
| `timeline` | object | oui |  |
| `corridor` | object | oui |  |
| `parcel` | object | oui |  |
| `recipient` | object | oui |  |
| `money` | object | oui |  |
| `shipper` | object | oui |  |
| `carrier` | object | oui |  |
| `pickup` | object \| null | oui |  |
| `trackingEvents` | array<objet { step, confirmedAt }> | oui |  |
| `deliveryPhotoUrls` | array<string> | oui |  |
| `dispute` | object \| null | oui |  |
| `retentionDecision` | object \| null | oui |  |
| `canDecide` | boolean | oui | A decision is possible now (responded, or 72h elapsed, or RETENTION) and none was taken yet |
| `decidableAt` | string \| null | oui |  |
| `proposedAmounts` | object | oui | Server-computed amounts shown in the admin recap (D55 2A/3A) |


**`AdminResolutionResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `bookingId` | ObjectId | oui |  |
| `kind` | ArbitrationKind | oui |  |
| `finalStatus` | enum : COMPLETED, CANCELLED | oui |  |
| `outcome` | string | oui |  |
| `refundCents` | integer | oui |  |
| `carrierPayoutCents` | integer | oui |  |
| `payoutStatus` | string \| null | oui | SENT / FAILED (retried by the cron) / null when nothing is owed to the carrier |
| `resolvedAt` | string (date-time) | oui |  |


**`AdminResolveDisputeRequest`** — Irreversible. Refund first, then the carrier transfer through the payout executor (D49).

| Champ | Type | Requis | Description |
|---|---|---|---|
| `outcome` | DisputeResolutionOutcome | oui |  |
| `refundCents` | integer | non | PARTIAL_REFUND only: 1 ≤ amount ≤ totalShipperCents − 1 |
| `reason` | string | oui |  |


**`AdminResolveRetentionRequest`** — Amounts are computed server-side (pro-rata A79 or the retained amount)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `outcome` | RetentionArbitrationOutcome | oui |  |
| `reason` | string | oui |  |


**`ArbitrationKind`** — enum : `DISPUTE`, `RETENTION`


**`ArbitrationQueueItem`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `bookingId` | ObjectId | oui |  |
| `kind` | ArbitrationKind | oui |  |
| `ticketNumber` | string \| null | oui |  |
| `category` | DisputeCategory \| null | oui |  |
| `openedAt` | string (date-time) | oui |  |
| `originCity` | string | oui |  |
| `destinationCity` | string | oui |  |
| `amountCents` | integer | oui | Total paid by the shipper (DISPUTE) or retained amount (RETENTION) |
| `currencyCode` | string | oui |  |
| `shipperFirstName` | string | oui |  |
| `carrierFirstName` | string | oui |  |
| `carrierResponded` | boolean | oui | DISPUTE: the carrier gave their side |
| `decidableAt` | string (date-time) | oui | When a decision becomes possible: now if responded / RETENTION, else disputedAt + 72h |


**`ArbitrationQueueResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `items` | array<ArbitrationQueueItem> | oui |  |
| `counts` | object | oui |  |


**`BookingActor`** — enum : `SHIPPER`, `CARRIER`, `SYSTEM`, `ADMIN`


**`BookingCounterpart`** — Minimal profile of the other party (explicit join — Booking has no Prisma relations)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `firstName` | string \| null | non |  |
| `lastInitial` | string | oui | Last-name initial, '' if absent (privacy) |
| `avatarUrl` | string \| null | oui |  |
| `publicSlug` | string \| null | oui | Public profile slug (/u/[slug]) — null for accounts without one (A45) |


**`BookingParcelSnapshot`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `category` | ParcelCategory | oui |  |
| `categoryFamily` | string \| null | non | D14 risk-family mapping, frozen at creation |
| `description` | string | oui |  |
| `declaredValueCents` | integer | oui |  |
| `photoUrls` | array<string> | oui | Shipper declaration photos (R2, timestamped) |


**`BookingPickupInfo`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `confirmedAt` | string (date-time) | oui |  |
| `photoUrls` | array<string> | oui | Carrier pickup photos (ImageKit URLs — D42, 1..5, server-timestamped) |
| `notes` | string \| null | non |  |
| `checklist` | array<string> | oui | The 5 inspection items ticked at pickup (CNF-04 attestation, frozen — B3). Empty on pre-B3 records. |


**`BookingPlaceInput`** — Chosen among the trip's pickup/delivery points

| Champ | Type | Requis | Description |
|---|---|---|---|
| `kind` | LocationKind | oui |  |
| `details` | string \| null | non |  |


**`BookingPlaceSnapshot`** — Meeting point chosen at booking (frozen)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `kind` | LocationKind | oui |  |
| `details` | string \| null | non |  |


**`BookingRatingState`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `windowEndsAt` | string \| null | oui | completedAt + 14 days |
| `ratedByMe` | boolean | oui |  |
| `counterpartHasRated` | boolean | oui |  |
| `revealedAt` | string \| null | oui |  |
| `canRate` | boolean | oui | COMPLETED, window open, not rated by me — the state machine verdict (canRate) |


**`BookingRecipientSnapshot`** — Recipient contact — visible to both roles (the carrier needs it to deliver)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `firstName` | string | oui |  |
| `lastName` | string | oui |  |
| `phoneE164` | string | oui |  |
| `email` | string \| null | oui | Optional at request time |


**`BookingStatus`** — enum : `PENDING`, `ACCEPTED`, `PICKED_UP`, `DELIVERED`, `COMPLETED`, `DECLINED`, `EXPIRED`, `CANCELLED`, `DISPUTED`


**`BookingTrackingEvent`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `step` | TrackingStep | oui |  |
| `confirmedAt` | string (date-time) | oui |  |


**`BookingTransitionAction`** — enum : `accept`, `decline`, `expire`, `cancel`, `pickup`, `refusePickup`, `deliver`, `confirmEarly`, `autoComplete`, `resolveDisputeKeep`, `resolveDisputeRefund`, `dispute` — Actions of the booking state machine (canPerform/getAllowedActions). Returned in allowedActions to drive frontend CTAs — the frontend reflects, never decides.


**`BookingTripSnapshot`** — Trip facts frozen at booking creation — the deal stays readable even if the trip changes

| Champ | Type | Requis | Description |
|---|---|---|---|
| `originCity` | string | oui |  |
| `originCountryCode` | string \| null | non |  |
| `originTimezone` | string \| null | non |  |
| `destinationCity` | string | oui |  |
| `destinationCountryCode` | string \| null | non |  |
| `destinationTimezone` | string \| null | non |  |
| `departureAt` | string (date-time) | oui | UTC — local rendering uses the two IANA timezones (D24) |
| `transportMode` | string \| null | non |  |


**`BookingViewerRole`** — enum : `SHIPPER`, `CARRIER` — Role of the authenticated viewer for a deal (drives the DTO shape)


**`CancelDealRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `reason` | string \| null | non |  |


**`CancellationPreview`** — Server-computed ANN-01 preview shown before the shipper confirms a cancellation. Informative snapshot at read time — the refund is recomputed at the actual cancel.

| Champ | Type | Requis | Description |
|---|---|---|---|
| `refundCents` | integer | oui | Amount returned to the shipper if they cancel NOW (full total while PENDING; ANN-01 scale once ACCEPTED) |
| `retentionCents` | integer | oui | totalShipperCents - refundCents (0 while full refund applies) |
| `retentionPct` | number | oui | Retention percentage applied after the full-refund deadline (server parameter §13) |
| `fullRefundUntil` | string (date-time) | oui | departureAt - 48h — cancelling before this instant refunds 100% (ANN-01/D39) |
| `currencyCode` | string | oui |  |


**`CarrierBookingView`** — Deal as seen by the carrier — no delivery code, no code hash, no regeneration counter, no shipper total

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `tripId` | ObjectId | oui |  |
| `shipperId` | ObjectId | oui |  |
| `status` | BookingStatus | oui |  |
| `trip` | BookingTripSnapshot | oui |  |
| `pricing` | CarrierPricing | oui |  |
| `parcel` | BookingParcelSnapshot | oui |  |
| `recipient` | BookingRecipientSnapshot | oui |  |
| `pickupPlace` | BookingPlaceSnapshot \| null | non |  |
| `deliveryPlace` | BookingPlaceSnapshot \| null | non |  |
| `shipper` | BookingCounterpart | oui |  |
| `requestedAt` | string (date-time) | oui |  |
| `expiresAt` | string (date-time) | oui | requestedAt + 24h acceptance deadline |
| `acceptedAt` | string \| null | non |  |
| `pickedUpAt` | string \| null | non |  |
| `deliveredAt` | string \| null | non |  |
| `payoutDueAt` | string \| null | non | deliveredAt + D+4 (verification window end) |
| `completedAt` | string \| null | non |  |
| `closedAt` | string \| null | non | Set on DECLINED / EXPIRED / CANCELLED |
| `closedBy` | BookingActor \| null | non |  |
| `declineReason` | string \| null | non |  |
| `pickupRefusalReason` | string \| null | non | Set when the carrier refused the parcel at pickup (PickupRefusalReason — B3/A40) |
| `disputeTicket` | string \| null | non |  |
| `disputedAt` | string \| null | non |  |
| `payoutStatus` | PayoutStatus \| null | non | Carrier payout state (B4/A68) — both roles read it; the transfer id is served to nobody |
| `payoutSentAt` | string \| null | non |  |
| `deliveryPhotoUrls` | array<string> | oui | Optional handover photos taken by the carrier at delivery (B4-PR3/A76) — served to both parties |
| `createdAt` | string (date-time) | oui |  |
| `updatedAt` | string (date-time) | oui |  |
| `deliveryAttemptsLeft` | integer | oui | MAX_DELIVERY_ATTEMPTS (3) minus attempts used — the code itself is NEVER exposed here |
| `deliveryLockedUntil` | string \| null | non | Anti brute-force lock (15 min after 3 failed attempts, server-side) |
| `pickup` | BookingPickupInfo \| null | non |  |
| `trackingEvents` | array<BookingTrackingEvent> | oui |  |
| `disputeCategory` | DisputeCategory \| null | non | Why the shipper disputed (status DISPUTED) — the carrier sees the category, never the file (A68) |
| `dispute` | CarrierDisputeView \| null | non | C-PR2 (D55): the carrier's view of the dispute — statement state, deadline, decision. Served while DISPUTED and after the decision. |
| `retentionDecision` | RetentionDecisionView \| null | non | C-PR2 (D55 3A): how a held retention was arbitrated |
| `payoutAmountCents` | integer \| null | non | Amount paid out to the carrier: the net at COMPLETED, the ANN-01 compensation at late CANCELLED (D50/A82) |
| `retentionDisposition` | string \| null | non | Late cancellation only: the retention went to the carrier (compensation), back to the shipper (mediation, C-PR2) or is held for mediation (cancelled after departure, A81) |
| `rating` | BookingRatingState \| null | oui | null unless COMPLETED (B5) |
| `payoutBlocker` | string \| null | oui | Coarse cause when payoutStatus = FAILED (A75): ACCOUNT_NOT_READY → finish the Stripe onboarding (CTA) · RETRYING → provider-side error, retried automatically, nothing to do. Never the raw provider message. null otherwise. |
| `allowedActions` | array<BookingTransitionAction> | oui | getAllowedActions(booking, 'CARRIER') — drives the frontend CTAs |


**`CarrierDisputeStatementRequest`** — The carrier's side of the story — once, while the dispute is open (D55 1A)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `statement` | string | oui |  |
| `photoUrls` | array<string> | oui |  |


**`CarrierDisputeStatementResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `bookingId` | ObjectId | oui |  |
| `ticketNumber` | string | oui |  |
| `respondedAt` | string (date-time) | oui |  |


**`CarrierDisputeView`** — What the carrier sees of a dispute: ticket, category, its own statement state, the decision — never the shipper's file (A68)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `ticketNumber` | string | oui |  |
| `category` | DisputeCategory | oui |  |
| `disputedAt` | string (date-time) | oui |  |
| `canRespond` | boolean | oui | DISPUTED, no statement yet — the front reflects, never decides |
| `responseDeadlineAt` | string (date-time) | oui | disputedAt + 72h: after that the admin may decide without the carrier's statement |
| `respondedAt` | string \| null | oui |  |
| `resolution` | DisputeResolutionView \| null | oui |  |


**`CarrierPricing`** — Earnings-only pricing view — commission and shipper total are never exposed to the carrier

| Champ | Type | Requis | Description |
|---|---|---|---|
| `pricingModel` | PricingModel | oui |  |
| `weightKg` | number | oui |  |
| `categoryPriceCents` | integer \| null | non |  |
| `pricePerKgCents` | integer \| null | non |  |
| `sizeClass` | string \| null | non |  |
| `transportCents` | integer | oui | Carrier net earnings for this deal (COM-03) |
| `currencyCode` | string | oui |  |


**`CarrierWallet`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `upcomingCents` | integer | oui | Σ UPCOMING |
| `pendingCents` | integer | oui | Σ PENDING + BLOCKED + FROZEN |
| `blockedCents` | integer | oui | Σ BLOCKED — drives the 'finish your Stripe account' banner |
| `sentCents` | integer | oui | Σ SENT, all time |
| `sentThisMonthCents` | integer | oui | Σ SENT with payoutSentAt in the current calendar month (UTC) |
| `currencyCode` | string | oui |  |
| `items` | array<WalletPayoutItem> | oui | Most recent first |


**`ConfirmDealResponse`** — Early confirmation done — payout released (INV-3: final)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `bookingId` | ObjectId | oui |  |
| `status` | string | oui |  |
| `completedAt` | string (date-time) | oui |  |
| `payoutStatus` | PayoutStatus | oui | SENT if the transfer succeeded inline, FAILED if the provider refused (retried by the cron — A67) |
| `payoutAmountCents` | integer | oui | = pricing.transportCents (carrier net, D50) |
| `currencyCode` | string | oui |  |


**`ConfirmPickupRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `checklist` | array<PickupChecklistItem> | oui | Must contain ALL 5 items — the server refuses a partial inspection (CNF-04) |
| `photoUrls` | array<string> | oui | 1 to 5 photo URLs already uploaded to ImageKit by the browser (D42) |
| `notes` | string \| null | non |  |


**`ConfirmTrackingStepRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `step` | TrackingStep | oui |  |


**`CreateBookingRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `product` | ParcelProduct | oui |  |
| `family` | ParcelFamily | oui |  |
| `sizeClass` | SizeClass \| null | non | Required for PARCEL |
| `weightKg` | number \| null | non | Declared weight (kg) — required for PARCEL; ignored for bags |
| `protection` | ProtectionTier | oui |  |
| `tripId` | ObjectId | oui |  |
| `paymentIntentId` | string | oui |  |
| `expectedTotalCents` | integer | oui |  |
| `description` | string | oui | Min 5 — same floor as the wizard (spec: recommended, low friction) |
| `declaredValueCents` | integer | oui |  |
| `photoUrls` | array<string> | oui |  |
| `recipient` | object | oui |  |
| `pickupPlace` | BookingPlaceInput \| null | non |  |
| `deliveryPlace` | BookingPlaceInput \| null | non |  |
| `charterAccepted` | boolean | oui | Shipper charter (CNF-02) — must be true |
| `termsAccepted` | boolean | oui |  |


**`CreateBookingResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `bookingId` | ObjectId | oui |  |
| `status` | BookingStatus | oui |  |
| `expiresAt` | string (date-time) | oui | 24h acceptance deadline (DEA-01) |
| `totalShipperCents` | integer | oui |  |
| `currencyCode` | string | oui |  |


**`CreatePaymentIntentRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `product` | ParcelProduct | oui |  |
| `family` | ParcelFamily | oui |  |
| `sizeClass` | SizeClass \| null | non | Required for PARCEL |
| `weightKg` | number \| null | non | Declared weight (kg) — required for PARCEL; ignored for bags |
| `protection` | ProtectionTier | oui |  |
| `tripId` | ObjectId | oui |  |
| `expectedTotalCents` | integer | oui | Total the shipper saw (D17 check) |


**`CreatePaymentIntentResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `provider` | PaymentProviderName | oui |  |
| `paymentIntentId` | string | oui |  |
| `clientSecret` | string \| null | oui | null for the FAKE provider |
| `amountCents` | integer | oui |  |
| `currencyCode` | string | oui |  |
| `quote` | ShipperPricing | oui | Server-side quote — what will be frozen (D17/D34) |


**`DealHistoryEvent`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `at` | string (date-time) | oui |  |
| `source` | DealHistorySource | oui |  |
| `type` | string | oui | eventType outbox, action admin, type de notification ou template d'email |
| `actor` | string \| null | oui | SHIPPER / CARRIER / SYSTEM / ADMIN, ou le nom court de l'admin |
| `recipient` | string \| null | oui | Notification / email : SHIPPER ou CARRIER |
| `summary` | object | oui | Sous-ensemble WHITELISTÉ du payload — jamais un code, un secret ou une photo |
| `relay` | object \| null | oui | Outbox seulement |
| `status` | string \| null | oui | Email : PENDING / SENT / FAILED · notification : lue ou non |


**`DealHistoryResponse`** — Tout ce qui est arrivé à ce deal (D59 5A), lecture seule, consultation journalisée

| Champ | Type | Requis | Description |
|---|---|---|---|
| `bookingId` | ObjectId | oui |  |
| `events` | array<DealHistoryEvent> | oui |  |
| `counts` | object | oui |  |
| `generatedAt` | string (date-time) | oui |  |


**`DealHistorySource`** — enum : `OUTBOX`, `ADMIN`, `NOTIFICATION`, `EMAIL`


**`DealResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `viewerRole` | BookingViewerRole | oui |  |
| `deal` | ShipperBookingView \| CarrierBookingView | oui | ShipperBookingView when viewerRole=SHIPPER, CarrierBookingView when viewerRole=CARRIER |


**`DealTransitionResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `bookingId` | ObjectId | oui |  |
| `status` | BookingStatus | oui |  |
| `refundAmountCents` | integer \| null | oui | Amount returned to the shipper (cents). Full total on PENDING closures (authorization released), ANN-01 amount on post-acceptance cancellation, null when nothing is returned (accept). |
| `currencyCode` | string | oui |  |


**`DeclineDealRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `reason` | DeclineReason \| null | non | Optional — one of 5 (spec É2) |


**`DeclineReason`** — enum : `CATEGORY_NOT_CARRIED`, `TOO_HEAVY`, `PLACES_INCOMPATIBLE`, `TIMING`, `OTHER` — The 5 optional decline reasons offered to the carrier (spec É2)


**`DeliverDealRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `code` | DeliveryCode | oui | Code given by the recipient — compared with bcrypt server-side |
| `photoUrls` | array<string> | oui | OPTIONAL handover photos (ImageKit, direct signed upload — D42/A76): the carrier's insurance on the parcel state |


**`DeliverDealResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `bookingId` | ObjectId | oui |  |
| `status` | BookingStatus | oui | DELIVERED |
| `deliveredAt` | string (date-time) | oui |  |
| `payoutDueAt` | string (date-time) | oui | deliveredAt + 4 days — end of the shipper verification window (B4 payout) |


**`DeliveryCode`** — string : 6 decimal digits (100000–999999)


**`DisputeCategory`** — enum : `NOT_DELIVERED`, `CONTENT_MISSING`, `DAMAGED`, `SIGNIFICANT_DELAY`, `RECIPIENT_ISSUE`, `OTHER` — Dispute category (spec §3.6 — one of six)


**`DisputeDealRequest`** — Open a dispute (shipper, DELIVERED, before payoutDueAt)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `category` | DisputeCategory | oui |  |
| `description` | string | oui |  |
| `pledgeAccepted` | boolean | oui | Honour pledge — must be true (anti-abuse, spec §3.6) |
| `photoUrls` | array<string> | oui | ImageKit URLs (direct signed upload — D42), optional but recommended |
| `desiredOutcome` | DisputeDesiredOutcome | non |  |


**`DisputeDealResponse`** — Dispute opened — payout frozen, ticket issued (INV-4/INV-5)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `bookingId` | ObjectId | oui |  |
| `status` | string | oui |  |
| `ticketNumber` | string | oui |  |
| `disputedAt` | string (date-time) | oui |  |


**`DisputeDesiredOutcome`** — enum : `FULL_REFUND`, `PARTIAL_REFUND`, `CONTACT_CARRIER`, `YAMBA_DECIDES` — What the shipper asks for (optional, informs mediation)


**`DisputeResolutionOutcome`** — enum : `REJECTED`, `PARTIAL_REFUND`, `FULL_REFUND` — REJECTED: carrier paid in full · PARTIAL_REFUND: free amount · FULL_REFUND: shipper refunded everything (D54 3A)


**`DisputeResolutionView`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `outcome` | DisputeResolutionOutcome | oui |  |
| `refundCents` | integer | oui | Refunded to the shipper |
| `carrierPayoutCents` | integer | oui | Paid out to the carrier (net − refund, floor 0) |
| `reason` | string | oui | Admin's written reason — read by BOTH parties |
| `resolvedAt` | string (date-time) | oui |  |


**`ErrorResponse`** — Enveloppe d'erreur standard (error-middleware, toute AppError)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `status` | string | oui |  |
| `message` | string | oui |  |
| `errors` | object | non | Erreurs par champ (formulaires) — exposé quand details.errors est présent |
| `details` |  | non | Contexte structuré 'safe' (ex: type=otp) — toujours exposé ; le reste hors prod uniquement |


**`FinanceQueueItem`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `bookingId` | ObjectId | oui |  |
| `kind` | FinanceQueueKind | oui |  |
| `status` | string | oui |  |
| `corridor` | object | oui |  |
| `shipper` | object | oui |  |
| `carrier` | object | oui |  |
| `amountCents` | integer | oui | Montant concerné : versement (FAILED / REVERSED) ou retenue (HELD) |
| `currencyCode` | string | oui |  |
| `payoutStatus` | string \| null | oui |  |
| `payoutAttempts` | integer | oui |  |
| `payoutFailureKind` | PayoutFailureKind \| null | oui |  |
| `payoutFailureDetail` | string \| null | oui | Message fournisseur brut — admin seulement, jamais servi au Voyageur (A75) |
| `lastAttemptAt` | string \| null | oui |  |
| `nextRetryAt` | string \| null | oui |  |
| `disputeTicket` | string \| null | oui |  |
| `since` | string (date-time) | oui | Depuis quand l'exception existe (fin du deal ou dernière écriture) |


**`FinanceQueueKind`** — enum : `FAILED`, `REVERSED`, `HELD`, `PROPOSED_REFUNDS` — FAILED = versements en échec · REVERSED = transferts renversés non clos · HELD = retenues conservées à arbitrer · PROPOSED_REFUNDS = remboursements manuels proposés, à décider (C-PR5b)


**`FinanceQueueResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `kind` | FinanceQueueKind | oui |  |
| `items` | array<FinanceQueueItem> | oui |  |
| `generatedAt` | string (date-time) | oui |  |


**`FinanceReport`** — Aucun grand livre (D58 1A) : agrégats des champs posés par les transitions. Les frais Stripe ne sont pas en base — rapprocher avec l'export Stripe.

| Champ | Type | Requis | Description |
|---|---|---|---|
| `from` | string (date-time) | oui |  |
| `to` | string (date-time) | oui |  |
| `generatedAt` | string (date-time) | oui |  |
| `months` | array<FinanceReportMonth> | oui |  |
| `snapshot` | array<FinanceSnapshot> | oui |  |


**`FinanceReportMonth`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `month` | string | oui | YYYY-MM (UTC) |
| `currencyCode` | string | oui |  |
| `capturedCents` | integer | oui | Encaissé : total payé des deals capturés ce mois |
| `capturedCount` | integer | oui |  |
| `refundedCents` | integer | oui | Remboursé aux Expéditeurs ce mois (toutes causes, manuel compris) |
| `refundCount` | integer | oui |  |
| `paidOutCents` | integer | oui | Versé aux Voyageurs ce mois (versements SENT, renversés inclus car partis) |
| `payoutCount` | integer | oui |  |
| `revenueCents` | integer | oui | Revenu reconnu : commission + prime des deals terminés ce mois (COMPLETED) |
| `completedCount` | integer | oui |  |
| `retentionCents` | integer | oui | Retenues nées ce mois (annulations tardives), quel que soit leur sort |
| `cancelledCount` | integer | oui |  |


**`FinanceSnapshot`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `currencyCode` | string | oui |  |
| `pendingPayoutCents` | integer | oui | Dû aux Voyageurs : PENDING + FAILED (passif) |
| `frozenPayoutCents` | integer | oui | Gelé par un litige (FROZEN) |
| `reversedOpenCents` | integer | oui | Transferts renversés non clos (argent revenu, à décider) |
| `heldRetentionCents` | integer | oui | Retenues conservées à arbitrer (passif, pas un revenu) |
| `proposedRefundCents` | integer | oui | Remboursements manuels proposés, non appliqués |


**`LocationKind`** — enum : `AIRPORT`, `TRAIN_STATION`, `CITY_AREA`


**`ManualRefundRequest`** — Montant en centimes ≤ total payé − déjà remboursé ; motif ≥ 50 caractères (geste commercial, jamais une décision de litige)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `amountCents` | integer | oui |  |
| `reason` | string | oui |  |


**`ManualRefundResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `bookingId` | ObjectId | oui |  |
| `refundedCents` | integer | oui |  |
| `totalRefundedCents` | integer | oui |  |
| `refundId` | string \| null | oui |  |
| `currencyCode` | string | oui |  |


**`MoneyTimelineEvent`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `at` | string (date-time) | oui |  |
| `kind` | MoneyTimelineKind | oui |  |
| `amountCents` | integer \| null | oui |  |
| `detail` | string \| null | oui |  |


**`MoneyTimelineKind`** — enum : `AUTHORIZED`, `CAPTURED`, `REFUNDED`, `DISPUTED`, `COMPLETED`, `CANCELLED`, `PAYOUT_SENT`, `PAYOUT_FAILED`, `PAYOUT_REVERSED`, `REVERSAL_RESOLVED`, `RETENTION`, `RETENTION_DECIDED`


**`MyBookingsResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `bookings` | array<ShipperBookingView> | oui |  |
| `count` | integer | oui |  |


**`MyDealsResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `deals` | array<CarrierBookingView> | oui |  |
| `count` | integer | oui |  |


**`MyRating`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `rating` | integer | oui |  |
| `criteria` | object \| null | oui |  |
| `comment` | string \| null | oui |  |
| `submittedAt` | string (date-time) | oui |  |


**`ObjectId`** — string : Identifiant MongoDB (ObjectId sérialisé en hexadécimal)


**`OpsAlert`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `rule` | OpsAlertRule | oui |  |
| `severity` | enum : warning, critical | oui |  |
| `title` | string | oui |  |
| `detail` | string | oui |  |
| `count` | integer \| null | oui | Éléments concernés (null pour une alerte de liquidité) |
| `href` | string | oui | Chemin admin où agir |


**`OpsAlertRule`** — enum : `PAYOUT_FAILED_48H`, `DISPUTE_UNDECIDED_72H`, `RETENTION_HELD_7D`, `REVERSAL_OPEN_48H`, `OUTBOX_PARKED`, `OUTBOX_LAGGING_15MIN`, `EMAILS_FAILED_24H`, `NO_TRIP_PUBLISHED_7D`, `ACCEPTANCE_RATE_LOW_7D`


**`OpsAlertsResponse`** — Sans état (D59 4A) : recalculées à chaque lecture ; le cron horaire n'envoie un email qu'à la première apparition du jour

| Champ | Type | Requis | Description |
|---|---|---|---|
| `alerts` | array<OpsAlert> | oui |  |
| `evaluatedAt` | string (date-time) | oui |  |
| `thresholds` | object | oui |  |


**`ParcelCategory`** — enum : `CLOTHES`, `SHOES`, `FASHION_ACCESSORIES`, `OTHER_ACCESSORIES`, `BOOKS`, `DOCUMENTS`, `SMALL_TOYS`, `PHONE`, `COMPUTER`, `OTHER_ELECTRONICS`, `CHECKED_BAG_23KG`, `CABIN_BAG_12KG` — Enum actuel (pré-D14). La migration vers les 8 familles de risque CAT-02 fera l'objet d'une PR dédiée (mapping conservé).


**`ParcelFamily`** — enum : `DOCUMENTS_PAPERS`, `CLOTHES_TEXTILE`, `FOOD_DRY_SEALED`, `ELECTRONICS_DEVICES`, `COSMETICS_CARE`, `PARTS_TOOLS`, `TOYS_CHILDCARE`, `MISC_ACCESSORIES` — D14/CAT-02 — the 8 risk families (conformity/risk/protection, never price)


**`ParcelProduct`** — enum : `PARCEL`, `CHECKED_BAG_23KG`, `CABIN_BAG_12KG` — PRC-04 — parcel priced per kg, or a whole bag at a flat rate


**`PaymentProviderName`** — enum : `STRIPE`, `FAKE` — FAKE only outside production (D11/D30)


**`PaymentReconciliation`** — Lecture seule chez le fournisseur ; la base n'est jamais modifiée par un rapprochement (D58 4A)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `provider` | string | oui |  |
| `checkedAt` | string (date-time) | oui |  |
| `live` | object \| null | oui |  |
| `divergences` | array<objet { code, message, dbCents, liveCents }> | oui |  |


**`PayoutFailureKind`** — enum : `ACCOUNT_NOT_READY`, `PROVIDER_ERROR`, `REVERSED`


**`PayoutStatus`** — enum : `PENDING`, `SENT`, `FAILED`, `FROZEN`, `REVERSED` — Carrier payout state (B4/D49). PENDING = deal COMPLETED, transfer not yet executed · SENT = transfer executed (payoutSentAt) · FAILED = transfer refused (retried by the payout cron) · FROZEN = dispute open (INV-5) · REVERSED = Stripe reversed the transfer (never re-sent automatically — admin, A87). null before COMPLETED / DISPUTED.


**`PickupChecklistItem`** — enum : `CONTENT_MATCHES`, `WEIGHT_OK`, `NO_FORBIDDEN`, `PACKAGING_OK`, `ITEMS_IDENTIFIED` — One of the 5 mandatory inspection items (spec É4a, CNF-04)


**`PickupRefusalReason`** — enum : `CONTENT_MISMATCH`, `SUSPICIOUS_CONTENT`, `OVERWEIGHT`, `BAD_PACKAGING`, `OTHER` — The 5 optional refusal reasons offered to the carrier at pickup (spec É4a)


**`PricingModel`** — enum : `PER_CATEGORY`, `PER_KG` — Pricing engine at booking creation time. PER_CATEGORY = current flat price per category; PER_KG = D13 target (price/kg x S/M/L size class). Snapshots are never migrated.


**`ProtectionTier`** — enum : `BASIC`, `EXTENDED_500` — GAR-02 — Yamba Guarantee tier (D22)


**`PublicTrackingResponse`** — D69 — recipient tracking page: minimal content, no address, no phone, no delivery code

| Champ | Type | Requis | Description |
|---|---|---|---|
| `milestone` | TrackingMilestone | oui |  |
| `steps` | array<objet { key, at }> | oui |  |
| `recipientFirstName` | string | oui |  |
| `shipperFirstName` | string | oui |  |
| `carrier` | object | oui |  |
| `corridor` | object | oui |  |
| `departureAt` | string \| null | oui |  |
| `arrivalAt` | string \| null | oui |  |


**`RatingContextResponse`** — Everything the rating screen needs — the frontend reflects, never decides

| Champ | Type | Requis | Description |
|---|---|---|---|
| `bookingId` | ObjectId | oui |  |
| `viewerRole` | BookingViewerRole | oui |  |
| `ratedRole` | BookingViewerRole | oui | The role being rated (opposite of viewerRole) — drives the criteria set |
| `person` | object | oui |  |
| `corridor` | object | oui |  |
| `completedAt` | string \| null | oui |  |
| `windowEndsAt` | string \| null | oui | completedAt + 14 days: rating closes and reviews are revealed |
| `canRate` | boolean | oui | Server verdict (state machine): COMPLETED, within the window, not rated yet by this role |
| `cannotRateReason` | string \| null | oui |  |
| `myRating` | MyRating \| null | oui |  |
| `counterpartHasRated` | boolean | oui |  |
| `revealedAt` | string \| null | oui | Double-blind lifted: both rated, or window elapsed |
| `counterpartRating` | MyRating \| null | oui |  |


**`RatingCriterion`** — enum : `PUNCTUALITY`, `COMMUNICATION`, `PARCEL_CARE`, `DECLARATION_CLARITY`, `RESPONSIVENESS` — Optional thumbs criteria — carrier: punctuality, communication, parcel care · shipper: declaration clarity, responsiveness, punctuality


**`RatingVote`** — enum : `UP`, `DOWN`


**`ReconciliationDivergenceCode`** — enum : `CAPTURE_NOT_RECORDED`, `CAPTURE_RECORDED_NOT_LIVE`, `REFUND_NOT_RECORDED`, `REFUND_RECORDED_NOT_LIVE`, `TRANSFER_MISSING`, `TRANSFER_AMOUNT_MISMATCH`, `TRANSFER_REVERSED_NOT_MARKED`, `TRANSFER_MARKED_REVERSED_BUT_LIVE_OK`, `INTENT_NOT_FOUND`


**`RefusePickupRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `reason` | PickupRefusalReason \| null | non | Optional — one of 5 (spec É4a) |


**`RegenerateCodeResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `bookingId` | ObjectId | oui |  |
| `deliveryCode` | DeliveryCode | oui | The NEW code — the only write-path surface where it appears (shipper only). The previous code is invalid. |
| `codeRegenerationsLeft` | integer | oui |  |


**`ResolveReversalRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `outcome` | enum : RESENT, WRITTEN_OFF | oui | RESENT = nouveau transfert par l'exécuteur unique · WRITTEN_OFF = manque à gagner assumé, rien n'est renvoyé |
| `reason` | string | oui |  |


**`ResolveReversalResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `outcome` | enum : RESENT, WRITTEN_OFF | oui |  |
| `payoutStatus` | string \| null | oui |  |
| `reason` | string \| null | oui |  |


**`RetentionArbitrationOutcome`** — enum : `COMPENSATE_CARRIER`, `RESTITUTE_SHIPPER` — Late cancellation after departure (A81): retention goes to the carrier (pro-rata A79) or back to the shipper


**`RetentionDecisionView`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `outcome` | RetentionArbitrationOutcome | oui |  |
| `reason` | string | oui |  |
| `decidedAt` | string (date-time) | oui |  |


**`RetryPayoutResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `payoutStatus` | enum : SENT, FAILED | oui |  |
| `reason` | string \| null | oui |  |
| `transferId` | string \| null | oui |  |


**`ShipperBookingView`** — Deal as seen by the shipper ('Mes envois')

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `tripId` | ObjectId | oui |  |
| `carrierId` | ObjectId | oui |  |
| `status` | BookingStatus | oui |  |
| `trip` | BookingTripSnapshot | oui |  |
| `pricing` | ShipperPricing | oui |  |
| `parcel` | BookingParcelSnapshot | oui |  |
| `recipient` | BookingRecipientSnapshot | oui |  |
| `pickupPlace` | BookingPlaceSnapshot \| null | non |  |
| `deliveryPlace` | BookingPlaceSnapshot \| null | non |  |
| `carrier` | BookingCounterpart | oui |  |
| `requestedAt` | string (date-time) | oui |  |
| `expiresAt` | string (date-time) | oui | requestedAt + 24h acceptance deadline |
| `acceptedAt` | string \| null | non |  |
| `pickedUpAt` | string \| null | non |  |
| `deliveredAt` | string \| null | non |  |
| `payoutDueAt` | string \| null | non | deliveredAt + D+4 (verification window end) |
| `completedAt` | string \| null | non |  |
| `closedAt` | string \| null | non | Set on DECLINED / EXPIRED / CANCELLED |
| `closedBy` | BookingActor \| null | non |  |
| `declineReason` | string \| null | non |  |
| `pickupRefusalReason` | string \| null | non | Set when the carrier refused the parcel at pickup (PickupRefusalReason — B3/A40) |
| `disputeTicket` | string \| null | non |  |
| `disputedAt` | string \| null | non |  |
| `payoutStatus` | PayoutStatus \| null | non | Carrier payout state (B4/A68) — both roles read it; the transfer id is served to nobody |
| `payoutSentAt` | string \| null | non |  |
| `deliveryPhotoUrls` | array<string> | oui | Optional handover photos taken by the carrier at delivery (B4-PR3/A76) — served to both parties |
| `createdAt` | string (date-time) | oui |  |
| `updatedAt` | string (date-time) | oui |  |
| `deliveryCode` | string \| null | oui | 6-digit delivery code, revealed to the shipper ONLY while the parcel is in transit (PICKED_UP) and only on GET /deals/:id (never in lists — D43, AES-256-GCM at rest). null otherwise. Never present in any carrier payload. |
| `codeRegenerationsLeft` | integer | oui | MAX_CODE_REGENERATIONS (5) minus regenerations used — server is the only judge |
| `pickup` | BookingPickupInfo \| null | non |  |
| `trackingEvents` | array<BookingTrackingEvent> | oui |  |
| `allowedActions` | array<BookingTransitionAction> | oui | getAllowedActions(booking, 'SHIPPER') — drives the frontend CTAs |
| `cancellationPreview` | CancellationPreview \| null | oui | Non-null exactly when 'cancel' is in allowedActions (PENDING or ACCEPTED) |
| `capturedAt` | string \| null | non | When the shipper's card was actually charged (at acceptance, D39) |
| `refundedAt` | string \| null | non |  |
| `refundAmountCents` | integer \| null | non | Amount returned (ANN-01 scale, plus a mediation refund or restitution); null when nothing was refunded |
| `retentionDecision` | RetentionDecisionView \| null | non | C-PR2 (D55 3A): how a held retention was arbitrated |
| `retentionCents` | integer \| null | non | Late cancellation: amount retained (ANN-01), null otherwise |
| `dispute` | ShipperDisputeView \| null | non | The dispute file — shipper only (A68); served while DISPUTED and after the decision (resolution), absent otherwise |
| `rating` | BookingRatingState \| null | oui | null unless COMPLETED (B5) |
| `disputeOpensAt` | string \| null | oui | PICKED_UP only: when the 'not delivered' dispute becomes possible (trip departure + 48h — B4/D51). Served, never computed by the front (A72). null otherwise. |


**`ShipperDisputeView`** — The dispute file as filed by the shipper (never served to the carrier)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `ticketNumber` | string | oui |  |
| `category` | DisputeCategory | oui |  |
| `description` | string | oui |  |
| `desiredOutcome` | DisputeDesiredOutcome \| null | oui |  |
| `photoUrls` | array<string> | oui |  |
| `createdAt` | string (date-time) | oui |  |
| `carrierRespondedAt` | string \| null | oui | The carrier gave their side (content never served to the shipper — D55 5A) |
| `resolution` | DisputeResolutionView \| null | oui |  |


**`ShipperPricing`** — Full pricing snapshot — shipper view only (all amounts in integer cents, A2)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `pricingModel` | PricingModel | oui |  |
| `weightKg` | number | oui |  |
| `categoryPriceCents` | integer \| null | non | PER_CATEGORY engine |
| `pricePerKgCents` | integer \| null | non | PER_KG engine (D13) |
| `sizeClass` | string \| null | non |  |
| `transportCents` | integer | oui | Carrier net (COM-03) |
| `commissionPct` | number | oui | Frozen at creation (COM-04) |
| `commissionCents` | integer | oui | Floor already applied (D16) |
| `protectionProvider` | string \| null | non |  |
| `protectionTier` | string \| null | non |  |
| `premiumCents` | integer | oui | Protection premium, separate flow (D22) |
| `totalShipperCents` | integer | oui | Total charged to the shipper |
| `currencyCode` | string | oui |  |
| `product` | string \| null | non | PARCEL / CHECKED_BAG_23KG / CABIN_BAG_12KG |
| `billableWeightKg` | number \| null | non | max(weight, 0.5) — D32 |
| `sizeCoef` | number \| null | non |  |
| `familySurchargePct` | number \| null | non |  |
| `rawTransportCents` | integer \| null | non | Before the 8 € floor |
| `minimumApplied` | boolean \| null | non |  |
| `serviceCents` | integer \| null | non | commission + premium (COM-03) |


**`ShipperWallet`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `heldCents` | integer | oui | Σ HELD — captured, not yet settled |
| `spentCents` | integer | oui | Σ RELEASED totals + retentions of PARTIALLY_REFUNDED |
| `refundedCents` | integer | oui | Σ refunds actually returned (REFUNDED + PARTIALLY_REFUNDED) |
| `currencyCode` | string | oui |  |
| `items` | array<WalletPaymentItem> | oui | Most recent first |


**`SizeClass`** — enum : `S`, `M`, `L` — PRC-03 — visual size class (coef 1 / 1.1 / 1.25)


**`SubmitRatingRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `rating` | integer | oui | 1 (disappointing) … 5 (excellent) — the only required field |
| `criteria` | object | non | Optional thumbs, only the criteria of the rated role are kept |
| `comment` | string | non | Public, attributed, immutable — 280 chars max |


**`SubmitRatingResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `bookingId` | ObjectId | oui |  |
| `submittedAt` | string (date-time) | oui |  |
| `revealed` | boolean | oui | true when the counterpart had already rated → both reviews revealed now |
| `revealedAt` | string \| null | oui |  |


**`TrackingLinkResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `token` | string | oui |  |
| `path` | string | oui |  |
| `recipientFirstName` | string | oui |  |
| `recipientPhoneE164` | string \| null | oui |  |


**`TrackingMilestone`** — enum : `ACCEPTED`, `PICKED_UP`, `IN_TRANSIT`, `ARRIVED`, `DELIVERED`, `CLOSED`


**`TrackingStep`** — enum : `AT_AIRPORT`, `FLIGHT_DEPARTED`, `FLIGHT_ARRIVED` — Optional tracking milestones inside PICKED_UP, strictly sequential


**`TrackingStepResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `bookingId` | ObjectId | oui |  |
| `step` | TrackingStep | oui |  |
| `confirmedAt` | string (date-time) | oui |  |
| `trackingEvents` | array<BookingTrackingEvent> | oui | Full sequence after this confirmation |


**`TripDealsResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `deals` | array<CarrierBookingView> | oui |  |
| `count` | integer | oui |  |


**`UnauthorizedResponse`** — 401 du middleware isAuthenticated (token absent, invalide, expiré, ou compte introuvable) — hors error-middleware

| Champ | Type | Requis | Description |
|---|---|---|---|
| `message` | string | oui |  |


**`UnhandledError`** — 500 non géré (exception hors AppError) — champ `error`, pas `message`

| Champ | Type | Requis | Description |
|---|---|---|---|
| `status` | string | oui |  |
| `error` | string | oui |  |


**`WalletPaymentItem`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `bookingId` | ObjectId | oui |  |
| `tripId` | ObjectId | oui |  |
| `bookingStatus` | BookingStatus | oui |  |
| `corridor` | object | oui |  |
| `counterpartFirstName` | string \| null | oui | Carrier first name (null if account deleted) |
| `state` | WalletPaymentState | oui |  |
| `amountCents` | integer | oui | Total charged (or authorized) to the shipper |
| `refundAmountCents` | integer \| null | oui | REFUNDED / PARTIALLY_REFUNDED: amount returned |
| `retentionCents` | integer \| null | oui | PARTIALLY_REFUNDED: amount kept (ANN-01) |
| `currencyCode` | string | oui |  |
| `date` | string \| null | oui | HELD (delivered): payoutDueAt · RELEASED: completedAt · REFUNDED: refundedAt · else: requestedAt |


**`WalletPaymentState`** — enum : `AUTHORIZED`, `HELD`, `RELEASED`, `RELEASED_NO_CHARGE`, `REFUNDED`, `PARTIALLY_REFUNDED` — AUTHORIZED = hold placed, nothing debited (PENDING request) · HELD = captured, kept by Yamba until completion (ACCEPTED/PICKED_UP/DELIVERED/DISPUTED) · RELEASED = completed, carrier paid · RELEASED_NO_CHARGE = declined / expired / cancelled before capture, the hold simply vanished · REFUNDED = captured then refunded in full · PARTIALLY_REFUNDED = late cancellation, ANN-01 retention kept


**`WalletPayoutItem`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `bookingId` | ObjectId | oui |  |
| `tripId` | ObjectId | oui |  |
| `bookingStatus` | BookingStatus | oui |  |
| `corridor` | object | oui |  |
| `counterpartFirstName` | string \| null | oui | Shipper first name (null if account deleted) |
| `kind` | enum : DELIVERY, LATE_CANCELLATION | oui | Net for a delivery, or ANN-01 compensation |
| `state` | WalletPayoutState | oui |  |
| `amountCents` | integer \| null | oui | null for HELD (nothing decided yet) |
| `currencyCode` | string | oui |  |
| `date` | string \| null | oui | UPCOMING: payoutDueAt · SENT: payoutSentAt · else: last update |


**`WalletPayoutState`** — enum : `UPCOMING`, `PENDING`, `BLOCKED`, `FROZEN`, `SENT`, `HELD`, `REVERSED` — UPCOMING = delivered, shipper verification running (payoutDueAt) · PENDING = being sent / retried · BLOCKED = carrier Stripe account not ready (CTA onboarding) · FROZEN = dispute open · SENT = transfer executed (payoutSentAt) · HELD = late cancellation after departure, retention held for mediation (no amount) · REVERSED = Stripe reversed the transfer, under review (A87)


**`WalletResponse`** — Finances page — both roles, totals computed server-side (A83)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `success` | boolean | oui |  |
| `carrier` | CarrierWallet | oui |  |
| `shipper` | ShipperWallet | oui |  |
| `generatedAt` | string (date-time) | oui |  |


## message-service — port 6005

Messagerie, rendez-vous, numéro, signalement de message. Document vivant : `http://localhost:6005/docs` (Scalar) et `apps/message-service/openapi.json`. Via le gateway : `http://localhost:8080/api` (préfixes ci-dessous).


### message-service › messages

Conversation, meetings and phone reveal (auth required, parties only)


#### `GET /messages/conversations`

**My conversations, most active first**  
`operationId` : `listConversations` · Authentification : cookieAuth, bearerAuth

Unread count per conversation, next meeting (accepted one first, otherwise the latest proposal) and write access.

| Code | Réponse |
|---|---|
| 200 | ConversationListResponse — Conversations |
| 401 | UnauthorizedResponse — Missing or invalid token (isAuthenticated middleware) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /messages/conversations/by-deal/{bookingId}`

**The thread of a deal, created on first access (D61 2A)**  
`operationId` : `getConversationByDeal` · Authentification : cookieAuth, bearerAuth

The conversation exists from ACCEPTED onwards. Before that: 403 — the request already carries a message.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `bookingId` | path | oui | ObjectId |  |

| Code | Réponse |
|---|---|
| 200 | ConversationThreadResponse — Thread |
| 401 | UnauthorizedResponse — Missing or invalid token (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated but not a party to this deal, or the deal has no conversation yet (ForbiddenError) |
| 404 | ErrorResponse — Conversation, deal or meeting not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /messages/conversations/{id}`

**The thread, oldest to newest, paginated backwards**  
`operationId` : `getConversationThread` · Authentification : cookieAuth, bearerAuth

`cursor` loads OLDER messages. Includes meetings and the phone state (revealed, opensAt).

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Conversation id |
| `cursor` | query | non | ObjectId | Oldest message already loaded |

| Code | Réponse |
|---|---|
| 200 | ConversationThreadResponse — Thread |
| 401 | UnauthorizedResponse — Missing or invalid token (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated but not a party to this deal, or the deal has no conversation yet (ForbiddenError) |
| 404 | ErrorResponse — Conversation, deal or meeting not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /messages/conversations/{id}/messages`

**Post a message (D61 3A / 4A / 5A)**  
`operationId` : `postMessage` · Authentification : cookieAuth, bearerAuth

Text up to 2000 chars plus up to 5 photos. REFUSED (400 DELIVERY_CODE_IN_MESSAGE) when a six-digit group matches the deal's delivery code hash (D43). Contact details (email, phone) are detected and flagged on the message, never blocked. Read-only while a dispute is open and 14 days after the deal ends. One transaction: message + conversation timestamp + outbox event (D2).

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Conversation id |

Corps (requis) : `PostMessageRequest`

| Code | Réponse |
|---|---|
| 201 | Message — Posted |
| 400 | ErrorResponse — Invalid request: empty message, bad slot, delivery code in the body (ValidationError) |
| 401 | UnauthorizedResponse — Missing or invalid token (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated but not a party to this deal, or the deal has no conversation yet (ForbiddenError) |
| 404 | ErrorResponse — Conversation, deal or meeting not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /messages/conversations/{id}/read`

**Mark the thread as read**  
`operationId` : `markConversationRead` · Authentification : cookieAuth, bearerAuth

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Conversation id |

| Code | Réponse |
|---|---|
| 200 | objet { readAt } — Read |
| 401 | UnauthorizedResponse — Missing or invalid token (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated but not a party to this deal, or the deal has no conversation yet (ForbiddenError) |
| 404 | ErrorResponse — Conversation, deal or meeting not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /messages/conversations/{id}/meetups`

**Propose a meeting (D61 1A) — the meeting is an object, not a conversation**  
`operationId` : `proposeMeetup` · Authentification : cookieAuth, bearerAuth

Place and slot: at least 30 minutes ahead, at most 90 days, window up to 12 hours. A new proposal of the same kind replaces the open one (counter-proposal).

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Conversation id |

Corps (requis) : `ProposeMeetupRequest`

| Code | Réponse |
|---|---|
| 201 | Meetup — Proposed |
| 400 | ErrorResponse — Invalid request: empty message, bad slot, delivery code in the body (ValidationError) |
| 401 | UnauthorizedResponse — Missing or invalid token (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated but not a party to this deal, or the deal has no conversation yet (ForbiddenError) |
| 404 | ErrorResponse — Conversation, deal or meeting not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /messages/conversations/{id}/meetups/{meetupId}/accept`

**Accept a meeting — the other party only**  
`operationId` : `acceptMeetup` · Authentification : cookieAuth, bearerAuth

Optimistic guard on PROPOSED: a concurrent change answers 400 rather than overwriting.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Conversation id |
| `meetupId` | path | oui | ObjectId |  |

| Code | Réponse |
|---|---|
| 200 | Meetup — Accepted |
| 400 | ErrorResponse — Invalid request: empty message, bad slot, delivery code in the body (ValidationError) |
| 401 | UnauthorizedResponse — Missing or invalid token (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated but not a party to this deal, or the deal has no conversation yet (ForbiddenError) |
| 404 | ErrorResponse — Conversation, deal or meeting not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /messages/conversations/{id}/phone`

**Reveal the counterpart's phone number (D61 4A)**  
`operationId` : `revealCounterpartPhone` · Authentification : cookieAuth, bearerAuth

Opens at most 2 hours before the accepted PICKUP meeting, otherwise before the trip departure. Recorded once per reader (PhoneReveal) and written in the thread as a system message. Rather than letting both parties trade numbers in the thread, the platform opens it late and keeps the trace.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Conversation id |

| Code | Réponse |
|---|---|
| 200 | RevealPhoneResponse — Revealed |
| 400 | ErrorResponse — Invalid request: empty message, bad slot, delivery code in the body (ValidationError) |
| 401 | UnauthorizedResponse — Missing or invalid token (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated but not a party to this deal, or the deal has no conversation yet (ForbiddenError) |
| 404 | ErrorResponse — Conversation, deal or meeting not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `POST /messages/conversations/{id}/messages/{messageId}/report`

**Report a message from the counterpart (F-PR3, D61 7A)**  
`operationId` : `reportMessage` · Authentification : cookieAuth, bearerAuth

Only a TEXT message written by the OTHER party can be reported, once per reporter. A moderation record, not a thread transition: no outbox event; support sees it in its queue and on the admin home. 409 when already reported by this user.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Conversation id |
| `messageId` | path | oui | ObjectId |  |

Corps (requis) : `ReportMessageRequest`

| Code | Réponse |
|---|---|
| 201 | ReportMessageResponse — Report recorded |
| 400 | ErrorResponse — Invalid request: empty message, bad slot, delivery code in the body (ValidationError) |
| 401 | UnauthorizedResponse — Missing or invalid token (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated but not a party to this deal, or the deal has no conversation yet (ForbiddenError) |
| 404 | ErrorResponse — Conversation, deal or meeting not found (NotFoundError) |
| 409 | ErrorResponse — Already reported by this user (ConflictError) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /messages/quick-replies`

**Quick replies in the reader's language (D61 2A)**  
`operationId` : `listQuickReplies` · Authentification : cookieAuth, bearerAuth

Same keys in every locale; the client sends the text as an ordinary message.

| Code | Réponse |
|---|---|
| 200 | QuickRepliesResponse — Quick replies |
| 401 | UnauthorizedResponse — Missing or invalid token (isAuthenticated middleware) |
| 500 | UnhandledError — Unhandled server error |


### message-service › admin

ADMIN session only (F-PR3, D61 7A): read a thread from a file (journaled), review reported messages


#### `GET /admin/conversations/by-deal/{bookingId}`

**Read a deal's whole conversation (conversations.read) — journaled CONVERSATION_VIEWED**  
`operationId` : `adminGetConversationByDeal` · Authentification : cookieAuth, bearerAuth

Both parties' names, every message with its reports, meetings and phone-reveal traces (who saw the number, when — never the number). 404 when the deal has no conversation.

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `bookingId` | path | oui | ObjectId |  |

| Code | Réponse |
|---|---|
| 200 | AdminConversationResponse — Conversation |
| 401 | UnauthorizedResponse — Missing or invalid token (isAuthenticated middleware) |
| 403 | ErrorResponse — Admin profile without this permission |
| 404 | ErrorResponse — Conversation, deal or meeting not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


#### `GET /admin/conversations/reports`

**Reported messages queue (reports.review)**  
`operationId` : `adminListMessageReports` · Authentification : cookieAuth, bearerAuth

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `status` | query | non | MessageReportStatus | OPEN by default |

| Code | Réponse |
|---|---|
| 200 | AdminMessageReportsResponse — Reports |
| 401 | UnauthorizedResponse — Missing or invalid token (isAuthenticated middleware) |
| 403 | ErrorResponse — Admin profile without this permission |
| 500 | UnhandledError — Unhandled server error |


#### `PATCH /admin/conversations/reports/{id}`

**Review a reported message (reports.review) — decision + journal in ONE transaction**  
`operationId` : `adminReviewMessageReport` · Authentification : cookieAuth, bearerAuth

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Report id |

Corps (requis) : `ReviewMessageReportRequest`

| Code | Réponse |
|---|---|
| 200 | objet { id, status } — Reviewed |
| 400 | ErrorResponse — Invalid request: empty message, bad slot, delivery code in the body (ValidationError) |
| 401 | UnauthorizedResponse — Missing or invalid token (isAuthenticated middleware) |
| 403 | ErrorResponse — Admin profile without this permission |
| 404 | ErrorResponse — Conversation, deal or meeting not found (NotFoundError) |
| 409 | ErrorResponse — Already reviewed (ConflictError) |
| 500 | UnhandledError — Unhandled server error |


### message-service › schémas utilisés (28)


**`AdminConversationResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `conversationId` | ObjectId | oui |  |
| `bookingId` | ObjectId | oui |  |
| `bookingStatus` | string | oui |  |
| `corridor` | object | oui |  |
| `shipper` | object | oui |  |
| `carrier` | object | oui |  |
| `messages` | array<AdminMessage> | oui | Du plus ancien au plus récent, sans pagination : un dossier se lit en entier |
| `meetups` | array<Meetup> | oui |  |
| `phoneReveals` | array<objet { revealedToRole, revealedAt }> | oui | Qui a vu le numéro de qui, quand — jamais le numéro |
| `lastMessageAt` | string \| null | oui |  |


**`AdminMessage`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `kind` | MessageKind | oui |  |
| `authorRole` | MessageAuthorRole | oui |  |
| `authorId` | ObjectId \| null | oui |  |
| `body` | string | oui | Texte de l'auteur, ou libellé de repli d'un message système |
| `photoUrls` | array<string> | oui |  |
| `systemKey` | string \| null | oui | Clé i18n d'un message SYSTEM / MEETUP — le client affiche sa propre copie |
| `systemData` | object \| null | oui |  |
| `flaggedContact` | boolean | oui | D61 5A — coordonnées détectées : averti, jamais bloqué |
| `createdAt` | string (date-time) | oui |  |
| `reports` | array<objet { id, reason, details, status, reporterRole, createdAt }> | oui |  |


**`AdminMessageReportItem`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `status` | MessageReportStatus | oui |  |
| `reason` | MessageReportReason | oui |  |
| `details` | string \| null | oui |  |
| `createdAt` | string (date-time) | oui |  |
| `reporter` | object | oui |  |
| `author` | object | oui |  |
| `message` | object | oui |  |
| `conversationId` | ObjectId | oui |  |
| `bookingId` | ObjectId | oui |  |
| `corridor` | object | oui |  |


**`AdminMessageReportsResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `items` | array<AdminMessageReportItem> | oui |  |
| `total` | integer | oui |  |


**`ConversationAccess`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `canRead` | boolean | oui |  |
| `canWrite` | boolean | oui |  |
| `reason` | string \| null | oui | Pourquoi l'écriture est fermée (clé stable, traduite par le client) |
| `writeClosesAt` | string \| null | oui |  |


**`ConversationListResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `items` | array<ConversationSummary> | oui |  |
| `totalUnread` | integer | oui |  |


**`ConversationSummary`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `bookingId` | ObjectId | oui |  |
| `role` | enum : SHIPPER, CARRIER | oui | Le rôle de CELUI qui lit |
| `counterpart` | object | oui |  |
| `corridor` | object | oui |  |
| `bookingStatus` | string | oui |  |
| `lastMessage` | object \| null | oui |  |
| `unreadCount` | integer | oui |  |
| `nextMeetup` | Meetup \| null | oui |  |
| `access` | ConversationAccess | oui |  |


**`ConversationThreadResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `conversation` | ConversationSummary | oui |  |
| `messages` | array<Message> | oui | Du plus ancien au plus récent |
| `meetups` | array<Meetup> | oui |  |
| `nextCursor` | ObjectId \| null | oui | Messages plus ANCIENS à charger |
| `phone` | object | oui | D61 4A — révélé au plus tôt 2 h avant le rendez-vous |


**`ErrorResponse`** — Enveloppe d'erreur standard (error-middleware, toute AppError)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `status` | string | oui |  |
| `message` | string | oui |  |
| `errors` | object | non | Erreurs par champ (formulaires) — exposé quand details.errors est présent |
| `details` |  | non | Contexte structuré 'safe' (ex: type=otp) — toujours exposé ; le reste hors prod uniquement |


**`Meetup`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `kind` | MeetupKind | oui |  |
| `status` | MeetupStatus | oui |  |
| `proposedByRole` | enum : SHIPPER, CARRIER | oui |  |
| `placeLabel` | string | oui |  |
| `placeDetails` | string \| null | oui |  |
| `startAt` | string (date-time) | oui |  |
| `endAt` | string (date-time) | oui |  |
| `acceptedAt` | string \| null | oui |  |
| `cancelledAt` | string \| null | oui |  |
| `createdAt` | string (date-time) | oui |  |


**`MeetupKind`** — enum : `PICKUP`, `DELIVERY`


**`MeetupStatus`** — enum : `PROPOSED`, `ACCEPTED`, `CANCELLED`


**`Message`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `kind` | MessageKind | oui |  |
| `authorRole` | MessageAuthorRole | oui |  |
| `authorId` | ObjectId \| null | oui |  |
| `body` | string | oui | Texte de l'auteur, ou libellé de repli d'un message système |
| `photoUrls` | array<string> | oui |  |
| `systemKey` | string \| null | oui | Clé i18n d'un message SYSTEM / MEETUP — le client affiche sa propre copie |
| `systemData` | object \| null | oui |  |
| `flaggedContact` | boolean | oui | D61 5A — coordonnées détectées : averti, jamais bloqué |
| `createdAt` | string (date-time) | oui |  |


**`MessageAuthorRole`** — enum : `SHIPPER`, `CARRIER`, `SYSTEM`


**`MessageKind`** — enum : `TEXT`, `SYSTEM`, `MEETUP`


**`MessageReportReason`** — enum : `OFF_PLATFORM`, `SCAM`, `HARASSMENT`, `OTHER`


**`MessageReportStatus`** — enum : `OPEN`, `REVIEWED`, `DISMISSED`


**`ObjectId`** — string : Identifiant MongoDB (ObjectId sérialisé en hexadécimal)


**`PostMessageRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `body` | string | oui |  |
| `photoUrls` | array<string> | non |  |


**`ProposeMeetupRequest`** — Proposition de rendez-vous ; une contre-proposition remplace la précédente

| Champ | Type | Requis | Description |
|---|---|---|---|
| `kind` | MeetupKind | oui |  |
| `placeLabel` | string | oui |  |
| `placeDetails` | string | non |  |
| `startAt` | string (date-time) | oui |  |
| `endAt` | string (date-time) | oui |  |


**`QuickRepliesResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `items` | array<QuickReply> | oui |  |


**`QuickReply`** — D61 2A — réponses rapides traduites, servies dans la langue du lecteur

| Champ | Type | Requis | Description |
|---|---|---|---|
| `key` | string | oui |  |
| `kind` | MeetupKind \| null | oui |  |
| `text` | string | oui |  |


**`ReportMessageRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `reason` | MessageReportReason | oui |  |
| `details` | string | non |  |


**`ReportMessageResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `reportId` | ObjectId | oui |  |
| `createdAt` | string (date-time) | oui |  |


**`RevealPhoneResponse`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `phoneE164` | string \| null | oui |  |
| `firstName` | string | oui |  |
| `revealedAt` | string (date-time) | oui |  |


**`ReviewMessageReportRequest`**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `decision` | enum : REVIEWED, DISMISSED | oui |  |
| `note` | string | non |  |


**`UnauthorizedResponse`** — 401 du middleware isAuthenticated (token absent, invalide, expiré, ou compte introuvable) — hors error-middleware

| Champ | Type | Requis | Description |
|---|---|---|---|
| `message` | string | oui |  |


**`UnhandledError`** — 500 non géré (exception hors AppError) — champ `error`, pas `message`

| Champ | Type | Requis | Description |
|---|---|---|---|
| `status` | string | oui |  |
| `error` | string | oui |  |


## notification-service — port 6004

Notifications in-app, webhooks email. Document vivant : `http://localhost:6004/docs` (Scalar) et `apps/notification-service/openapi.json`. Via le gateway : `http://localhost:8080/api` (préfixes ci-dessous).


### notification-service › —




#### `GET /me/notifications`

**My notifications (latest first) with unread count**  
`operationId` : `listMyNotifications` · Authentification : cookieAuth, bearerAuth

| Code | Réponse |
|---|---|
| 200 | MyNotificationsResponse — Latest 50 notifications + unreadCount |
| 401 | UnauthorizedResponse — Missing or invalid token (isAuthenticated middleware) |
| 500 | UnhandledError — Unhandled server error |


#### `PATCH /me/notifications/read-all`

**Mark ALL my notifications as read (idempotent — A91)**  
`operationId` : `markAllNotificationsRead` · Authentification : cookieAuth, bearerAuth

| Code | Réponse |
|---|---|
| 200 | MarkAllNotificationsReadResponse — How many were unread |
| 401 | UnauthorizedResponse — Missing or invalid token (isAuthenticated middleware) |
| 500 | UnhandledError — Unhandled server error |


#### `PATCH /me/notifications/{id}/read`

**Mark one notification as read (idempotent)**  
`operationId` : `markNotificationRead` · Authentification : cookieAuth, bearerAuth

| Paramètre | Dans | Requis | Type | Description |
|---|---|---|---|---|
| `id` | path | oui | ObjectId | Notification id |

| Code | Réponse |
|---|---|
| 200 | MarkNotificationReadResponse — The updated notification |
| 400 | ErrorResponse — Malformed notification id (ValidationError) |
| 401 | UnauthorizedResponse — Missing or invalid token (isAuthenticated middleware) |
| 403 | ErrorResponse — Authenticated but not the recipient (ForbiddenError — A21) |
| 404 | ErrorResponse — Notification not found (NotFoundError) |
| 500 | UnhandledError — Unhandled server error |


### notification-service › schémas utilisés (10)


**`BookingEventType`** — enum : `booking.requested`, `booking.payment_authorized`, `booking.accepted`, `booking.declined`, `booking.expired`, `booking.cancelled`, `booking.refund_issued`, `booking.picked_up`, `booking.pickup_refused`, `booking.tracking_event`, `booking.code_regenerated`, `booking.delivered`, `booking.completed`, `booking.payout_sent`, `booking.disputed`, `booking.verification_reminder`, `booking.rating_reminder`, `booking.rating_revealed`, `booking.dispute_carrier_responded`, `booking.dispute_resolved` — All booking domain event keys (outbox → Kafka topics)


**`ErrorResponse`** — Enveloppe d'erreur standard (error-middleware, toute AppError)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `status` | string | oui |  |
| `message` | string | oui |  |
| `errors` | object | non | Erreurs par champ (formulaires) — exposé quand details.errors est présent |
| `details` |  | non | Contexte structuré 'safe' (ex: type=otp) — toujours exposé ; le reste hors prod uniquement |


**`MarkAllNotificationsReadResponse`** — PATCH /me/notifications/read-all — how many were unread

| Champ | Type | Requis | Description |
|---|---|---|---|
| `updatedCount` | integer | oui |  |


**`MarkNotificationReadResponse`** — PATCH /me/notifications/{id}/read — the updated notification

| Champ | Type | Requis | Description |
|---|---|---|---|
| `notification` | NotificationView | oui |  |


**`MyNotificationsResponse`** — GET /me/notifications — latest first, unread count included

| Champ | Type | Requis | Description |
|---|---|---|---|
| `notifications` | array<NotificationView> | oui |  |
| `unreadCount` | integer | oui |  |


**`NotificationType`** — union : BookingEventType \| string


**`NotificationView`** — In-app notification (whitelist DTO — A13): userId/eventId never exposed

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | ObjectId | oui |  |
| `type` | NotificationType | oui |  |
| `bookingId` | ObjectId \| null | oui |  |
| `payload` | object | oui |  |
| `counterpartFirstName` | string \| null | oui |  |
| `readAt` | string \| null | oui |  |
| `createdAt` | string (date-time) | oui |  |


**`ObjectId`** — string : Identifiant MongoDB (ObjectId sérialisé en hexadécimal)


**`UnauthorizedResponse`** — 401 du middleware isAuthenticated (token absent, invalide, expiré, ou compte introuvable) — hors error-middleware

| Champ | Type | Requis | Description |
|---|---|---|---|
| `message` | string | oui |  |


**`UnhandledError`** — 500 non géré (exception hors AppError) — champ `error`, pas `message`

| Champ | Type | Requis | Description |
|---|---|---|---|
| `status` | string | oui |  |
| `error` | string | oui |  |

