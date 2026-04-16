import { Role } from "@prisma/client";
import { Request } from "express";

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  walletAddress?: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
};
