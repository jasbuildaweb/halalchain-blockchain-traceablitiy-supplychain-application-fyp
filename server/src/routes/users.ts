import { Router, Response } from "express";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { body, validationResult } from "express-validator";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../lib/rbac";
import { getRoleManagerContract } from "../lib/blockchain";
import { AuthRequest } from "../types";

const router = Router();

// GET /api/users — Admin: list all; others: own profile only
router.get("/", authenticate, requireRole("ADMIN"), async (_req, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, name: true, email: true, role: true,
        company: true, walletAddress: true, isApproved: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// POST /api/users — Admin creates supply chain actor accounts
router.post(
  "/",
  authenticate,
  requireRole("ADMIN"),
  [
    body("name").trim().notEmpty(),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
    body("role").isIn(Object.values(Role)),
    body("company").optional().trim(),
    body("walletAddress").optional().isEthereumAddress(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: errors.array()[0].msg });
      return;
    }
    const { name, email, password, role, company, walletAddress } = req.body as {
      name: string; email: string; password: string; role: Role;
      company?: string; walletAddress?: string;
    };

    try {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        res.status(409).json({ success: false, error: "Email already in use" });
        return;
      }
      const hashed = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: { name, email, password: hashed, role, company, walletAddress, isApproved: true },
        select: { id: true, name: true, email: true, role: true, company: true, walletAddress: true },
      });

      // Assign role on blockchain if wallet provided
      if (walletAddress) {
        try {
          const roleIndex = ["NONE", "ADMIN", "SUPPLIER", "MANUFACTURER", "LOGISTICS", "RETAILER"].indexOf(role);
          if (roleIndex > 0) {
            const rm = getRoleManagerContract();
            await (await rm.assignRole(walletAddress, roleIndex)).wait();
          }
        } catch (chainErr) {
          console.warn("Blockchain role assignment failed:", chainErr);
        }
      }

      res.status(201).json({ success: true, data: user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

// GET /api/users/:id
router.get("/:id", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requestedId = req.params.id;
    // Users can only view themselves unless admin
    if (req.user!.role !== "ADMIN" && req.user!.userId !== requestedId) {
      res.status(403).json({ success: false, error: "Access denied" });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: requestedId },
      select: { id: true, name: true, email: true, role: true, company: true, walletAddress: true, isApproved: true, createdAt: true },
    });
    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }
    res.json({ success: true, data: user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// PATCH /api/users/:id — update profile / wallet
router.patch("/:id", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user!.role !== "ADMIN" && req.user!.userId !== req.params.id) {
    res.status(403).json({ success: false, error: "Access denied" });
    return;
  }
  const { name, company, walletAddress } = req.body as {
    name?: string; company?: string; walletAddress?: string;
  };
  try {
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(name          !== undefined && { name }),
        ...(company       !== undefined && { company }),
        ...(walletAddress !== undefined && { walletAddress }),
      },
      select: { id: true, name: true, email: true, role: true, company: true, walletAddress: true },
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// PATCH /api/users/:id/role — Admin changes role
router.patch(
  "/:id/role",
  authenticate,
  requireRole("ADMIN"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { role, walletAddress } = req.body as { role: Role; walletAddress?: string };
    if (!Object.values(Role).includes(role)) {
      res.status(400).json({ success: false, error: "Invalid role" });
      return;
    }
    try {
      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: { role, isApproved: true, ...(walletAddress && { walletAddress }) },
        select: { id: true, name: true, email: true, role: true, walletAddress: true },
      });

      // Update on blockchain if wallet is set
      const wallet = walletAddress ?? user.walletAddress;
      if (wallet) {
        try {
          const roleIndex = ["NONE", "ADMIN", "SUPPLIER", "MANUFACTURER", "LOGISTICS", "RETAILER"].indexOf(role);
          if (roleIndex > 0) {
            const rm = getRoleManagerContract();
            await (await rm.assignRole(wallet, roleIndex)).wait();
          }
        } catch (chainErr) {
          console.warn("Blockchain role assignment failed:", chainErr);
        }
      }

      res.json({ success: true, data: user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

// PATCH /api/users/:id/approve — Admin approves pending user
router.patch(
  "/:id/approve",
  authenticate,
  requireRole("ADMIN"),
  async (_req, res: Response): Promise<void> => {
    try {
      const user = await prisma.user.update({
        where: { id: _req.params.id },
        data: { isApproved: true },
        select: { id: true, name: true, email: true, isApproved: true },
      });
      res.json({ success: true, data: user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

export default router;
