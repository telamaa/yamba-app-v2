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
};

export type RegisterPayload = {
  firstName: string;
  lastName: string;
  gender: Gender;
  email: string;
  password: string;
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

export type LoginPayload = {
  email: string;
  password: string;
  rememberMe: boolean;
};

export type LoginResponse = {
  message?: string;
  accessToken?: string;
};

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

export type ResetPasswordPayload = {
  passwordResetToken: string;
  newPassword: string;
};

export type ResetPasswordResponse = {
  message?: string;
};

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

export async function resendRegistrationOtp(
  payload: ResendRegistrationOtpPayload
) {
  const response = await authApi.post<ResendRegistrationOtpResponse>(
    "/auth/register/resend",
    payload
  );
  return response.data;
}

export async function loginUser(payload: LoginPayload) {
  const response = await authApi.post<LoginResponse>("/auth/login", payload);
  return response.data;
}

export async function requestPasswordResetOtp(payload: ForgotPasswordPayload) {
  const response = await authApi.post<ForgotPasswordResponse>(
    "/auth/password/forgot",
    payload
  );
  return response.data;
}

export async function verifyPasswordResetOtp(
  payload: VerifyPasswordResetOtpPayload
) {
  const response = await authApi.post<VerifyPasswordResetOtpResponse>(
    "/auth/password/verify",
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

// Logout
export const logoutUser = async () => {
  const response = await apiClient.post("/auth/logout", {}, {
    withCredentials: true,
    skipAuthRefresh: true,
  });
  return response.data;
};
