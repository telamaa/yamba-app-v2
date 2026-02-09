import type { Response } from "express";

type CookieName = "access_token" | "refresh_token";

export const setCookie = (res: Response, name: CookieName, value: string) => {
  const isProd = process.env.NODE_ENV === "production";

  const maxAge =
    name === "access_token"
      ? 15 * 60 * 1000 // 15 min
      : 7 * 24 * 60 * 60 * 1000; // 7 jours

  res.cookie(name, value, {
    httpOnly: true,
    secure: isProd,                 // https only in prod
    sameSite: isProd ? "none" : "lax",
    maxAge,
    path: "/",
  });
};

export const clearAuthCookies = (res: Response) => {
  const isProd = process.env.NODE_ENV === "production";

  const base = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  } as const;

  res.clearCookie("access_token", base);
  res.clearCookie("refresh_token", base);
};
