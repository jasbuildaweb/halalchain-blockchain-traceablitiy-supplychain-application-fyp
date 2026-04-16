import { Role } from "@prisma/client";
import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";

// ─── Permission matrix ────────────────────────────────────────────────────────

type Permission =
  | "products:read"
  | "products:write"
  | "events:write"
  | "certificates:read"
  | "certificates:write"
  | "users:read"
  | "users:write"
  | "raw-materials:read"
  | "raw-materials:write"
  | "verify:read"
  | "*";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: ["*"],
  SUPPLIER: [
    "raw-materials:read",
    "raw-materials:write",
    "events:write",
    "products:read",
    "verify:read",
  ],
  MANUFACTURER: [
    "products:read",
    "products:write",
    "events:write",
    "raw-materials:read",
    "verify:read",
  ],
  LOGISTICS: [
    "products:read",
    "events:write",
    "verify:read",
  ],
  RETAILER: [
    "products:read",
    "events:write",
    "verify:read",
  ],
  CONSUMER: ["verify:read"],
};

export function can(role: Role, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role];
  return perms.includes("*") || perms.includes(permission);
}

// ─── Express middleware factory ───────────────────────────────────────────────

/**
 * requireAuth(roles?) — middleware that:
 *  1. Checks the JWT was decoded by the auth middleware (req.user exists)
 *  2. Optionally checks the user's role is in the allowed list
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `Access denied. Required role: ${allowedRoles.join(" or ")}`,
      });
      return;
    }
    next();
  };
}
