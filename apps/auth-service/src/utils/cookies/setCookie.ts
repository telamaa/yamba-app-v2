import type { Response, CookieOptions } from "express";

type CookieName = "access_token" | "refresh_token";

type SetCookieOptions = {
  rememberMe?: boolean;
};

export const setCookie = (
  res: Response,
  name: CookieName,
  value: string,
  options?: SetCookieOptions
) => {
  const isProd = process.env.NODE_ENV === "production";

  const baseOptions: CookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  };

  if (name === "access_token") {
    res.cookie(name, value, {
      ...baseOptions,
      maxAge: 15 * 60 * 1000, // 15 min
    });
    return;
  }

  if (options?.rememberMe) {
    res.cookie(name, value, {
      ...baseOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
    });
    return;
  }

  // refresh_token de session uniquement
  res.cookie(name, value, baseOptions);
};

export const clearAuthCookies = (res: Response) => {
  const isProd = process.env.NODE_ENV === "production";

  const base: CookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  };

  res.clearCookie("access_token", base);
  res.clearCookie("refresh_token", base);
};
