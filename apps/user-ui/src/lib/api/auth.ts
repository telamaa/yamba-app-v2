export type Gender = "MALE" | "FEMALE" | "OTHER";

const BASE =
  process.env.NEXT_PUBLIC_AUTH_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:6001/api"; // adapte à ton gateway si besoin

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });

  const raw = await res.text();
  let json: any = {};
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    json = { message: raw };
  }

  if (!res.ok) {
    throw new Error(json?.error || json?.message || "Request failed");
  }
  return json as T;
}

export const authApi = {
  register: (payload: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    gender: Gender;
  }) =>
    postJson<{ message: string; verificationToken: string }>("/auth/register", payload),

  registerVerify: (payload: { verificationToken: string; otp: string }) =>
    postJson<{ success: boolean; message: string }>("/auth/register/verify", payload),

  login: (payload: { email: string; password: string }) =>
    postJson<{
      message: string;
      user: { id: string; email: string; firstName: string; lastName: string; roles: string[] };
    }>("/auth/login", payload),

  refresh: () => postJson<{ success: boolean }>("/auth/refresh", {}),

  forgot: (payload: { email: string }) =>
    postJson<{ message: string }>("/auth/password/forgot", payload),

  resetVerifyOtp: (payload: { email: string; otp: string }) =>
    postJson<{ message: string; passwordResetToken: string }>("/auth/password/verify", payload),

  resetPassword: (payload: { passwordResetToken: string; newPassword: string }) =>
    postJson<{ message: string }>("/auth/password/reset", payload),
};
