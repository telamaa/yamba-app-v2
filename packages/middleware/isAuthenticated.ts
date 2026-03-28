import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "@packages/libs/prisma";

export type AuthenticatedRequest = Request & {
  user?: any;
  roles?: string[];
};

type JwtPayload = {
  id: string;
  roles?: string[];
};

const extractToken = (req: Request): string | null => {
  const bearerToken = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.split(" ")[1]
    : null;

  return req.cookies?.access_token || bearerToken || null;
};

const isAuthenticated = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ message: "Unauthorized! Token missing." });
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET!
    ) as JwtPayload;

    if (!decoded?.id) {
      return res.status(401).json({ message: "Unauthorized! Invalid token." });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return res.status(401).json({ message: "Account not found." });
    }

    req.user = user;
    req.roles = decoded.roles ?? user.roles ?? [];

    return next();
  } catch (error) {
    return res
      .status(401)
      .json({ message: "Unauthorized! Token expired or invalid." });
  }
};

export default isAuthenticated;
