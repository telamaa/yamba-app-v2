/**
 * member-sessions.schema.ts — sessions membre, sudo, identifiants (D65, solde D27)
 * ================================================================================
 */
import { z } from "zod";

export const SUDO_WINDOW_MINUTES = 15;
export const EMAIL_CHANGE_TTL_MINUTES = 10;

export const SudoStatusSchema = z.object({ active: z.boolean(), expiresAt: z.string().datetime().nullable() }).meta({ id: "SudoStatus", description: "Sudo window bound to the current session (D65 1A)" });
export type SudoStatus = z.infer<typeof SudoStatusSchema>;
export const SudoVerifyRequestSchema = z.object({ code: z.string().regex(/^\d{6}$/) }).meta({ id: "SudoVerifyRequest" });

export const MemberSessionItemSchema = z
  .object({
    jti: z.string(),
    createdAt: z.string().datetime(),
    lastActivityAt: z.string().datetime(),
    rememberMe: z.boolean(),
    device: z.string().meta({ description: "Browser + OS derived from the user agent, or « Appareil inconnu »" }),
    ip: z.string().nullable(),
    current: z.boolean(),
  })
  .meta({ id: "MemberSessionItem" });
export type MemberSessionItem = z.infer<typeof MemberSessionItemSchema>;
export const MemberSessionsResponseSchema = z.object({ items: z.array(MemberSessionItemSchema) }).meta({ id: "MemberSessionsResponse" });
export type MemberSessionsResponse = z.infer<typeof MemberSessionsResponseSchema>;

export const ChangePasswordRequestSchema = z.object({ newPassword: z.string().min(1).max(200) }).meta({ id: "ChangePasswordRequest", description: "Under sudo (D65 3A); every other session is revoked" });
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

export const RequestEmailChangeSchema = z.object({ newEmail: z.string().trim().email().max(254) }).meta({ id: "RequestEmailChange", description: "Under sudo (D65 4A); a code is sent to the NEW address" });
export type RequestEmailChange = z.infer<typeof RequestEmailChangeSchema>;
export const ConfirmEmailChangeSchema = z.object({ code: z.string().regex(/^\d{6}$/) }).meta({ id: "ConfirmEmailChange" });
export type ConfirmEmailChange = z.infer<typeof ConfirmEmailChangeSchema>;
