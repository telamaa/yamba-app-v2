import axios from "axios";
import apiClient from "@/lib/api-client";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

export const authApi = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export type Gender = "MALE" | "FEMALE" | "OTHER";

export type ApiErrorResponse = {
  message?: string;
  errors?: Record<string, string>;
  details?: unknown;
  status?: string;
};

// ─── Register types ────────────────────────────────────
export type RegisterPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  termsAccepted: boolean;
  termsVersion: string;
  privacyVersion: string;
};

export type RegisterResponse = {
  message?: string;
  verificationToken?: string;
};

export type VerifyRegisterPayload = {
  verificationToken: string;
  otp: string;
};

export type VerifyRegisterResponse = {
  message?: string;
};

export type ResendRegistrationOtpPayload = {
  verificationToken: string;
};

export type ResendRegistrationOtpResponse = {
  message?: string;
  verificationToken?: string;
};

// 🆕 Cancel registration
export type CancelRegistrationPayload = {
  verificationToken: string;
};

export type CancelRegistrationResponse = {
  success?: boolean;
  message?: string;
};

// ─── Login types ───────────────────────────────────────
export type LoginPayload = {
  email: string;
  password: string;
  rememberMe: boolean;
};

export type LoginResponse = {
  message?: string;
  accessToken?: string;
};

// ─── Forgot password types ─────────────────────────────
export type ForgotPasswordPayload = {
  email: string;
};

export type ForgotPasswordResponse = {
  message?: string;
};

export type VerifyPasswordResetOtpPayload = {
  email: string;
  otp: string;
};

export type VerifyPasswordResetOtpResponse = {
  message?: string;
  passwordResetToken?: string;
};

// 🆕 Resend forgot password OTP
export type ResendPasswordResetOtpPayload = {
  email: string;
};

export type ResendPasswordResetOtpResponse = {
  message?: string;
};

export type ResetPasswordPayload = {
  passwordResetToken: string;
  newPassword: string;
};

export type ResetPasswordResponse = {
  message?: string;
};

// ─── Register API calls ────────────────────────────────
export async function registerUser(payload: RegisterPayload) {
  const response = await authApi.post<RegisterResponse>("/auth/register", payload);
  return response.data;
}

export async function verifyRegistrationOtp(payload: VerifyRegisterPayload) {
  const response = await authApi.post<VerifyRegisterResponse>(
    "/auth/register/verify",
    payload
  );
  return response.data;
}

export async function resendRegistrationOtp(payload: ResendRegistrationOtpPayload) {
  const response = await authApi.post<ResendRegistrationOtpResponse>(
    "/auth/register/resend",
    payload
  );
  return response.data;
}

// 🆕
export async function cancelRegistration(payload: CancelRegistrationPayload) {
  const response = await authApi.post<CancelRegistrationResponse>(
    "/auth/register/cancel",
    payload
  );
  return response.data;
}

// ─── Login API calls ───────────────────────────────────
export async function loginUser(payload: LoginPayload) {
  const response = await authApi.post<LoginResponse>("/auth/login", payload);
  return response.data;
}

// ─── Forgot password API calls ─────────────────────────
export async function requestPasswordResetOtp(payload: ForgotPasswordPayload) {
  const response = await authApi.post<ForgotPasswordResponse>(
    "/auth/password/forgot",
    payload
  );
  return response.data;
}

export async function verifyPasswordResetOtp(payload: VerifyPasswordResetOtpPayload) {
  const response = await authApi.post<VerifyPasswordResetOtpResponse>(
    "/auth/password/verify",
    payload
  );
  return response.data;
}

// 🆕
export async function resendPasswordResetOtp(payload: ResendPasswordResetOtpPayload) {
  const response = await authApi.post<ResendPasswordResetOtpResponse>(
    "/auth/password/resend",
    payload
  );
  return response.data;
}

export async function resetPassword(payload: ResetPasswordPayload) {
  const response = await authApi.post<ResetPasswordResponse>(
    "/auth/password/reset",
    payload
  );
  return response.data;
}

// ─── Helpers ───────────────────────────────────────────
export function getApiErrorData(error: unknown): ApiErrorResponse {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as ApiErrorResponse | undefined) ?? {};
  }
  return {};
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  const data = getApiErrorData(error);
  return data.message || fallback;
}

export function hasApiBaseUrl() {
  return Boolean(apiBaseUrl);
}

export const logoutUser = async () => {
  const response = await apiClient.post("/auth/logout", {}, {
    withCredentials: true,
    skipAuthRefresh: true,
  });
  return response.data;
};
