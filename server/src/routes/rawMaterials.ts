import { Router, Response } from "express";
import { body, validationResult } from "express-validator";
import { HalalStatus } from "@prisma/client";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../lib/rbac";
import { AuthRequest } from "../types";

const router = Router();

// GET /api/raw-materials
router.get("/", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const where =
      req.user!.role === "SUPPLIER"
        ? { supplierId: req.user!.userId }
        : {};

    const materials = await prisma.rawMaterial.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, company: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: materials });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// POST /api/raw-materials
router.post(
  "/",
  authenticate,
  requireRole("SUPPLIER", "ADMIN"),
  [
    body("name").trim().notEmpty().withMessage("Material name is required"),
    body("origin").optional().trim(),
    body("certRef").optional().trim(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: errors.array()[0].msg });
      return;
    }
    const { name, origin, certRef } = req.body as { name: string; origin?: string; certRef?: string };
    try {
      const material = await prisma.rawMaterial.create({
        data: { name, origin, certRef, supplierId: req.user!.userId },
        include: { supplier: { select: { id: true, name: true, company: true } } },
      });
      res.status(201).json({ success: true, data: material });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

// PATCH /api/raw-materials/:id — Admin updates halal status
router.patch(
  "/:id",
  authenticate,
  requireRole("ADMIN"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { halalStatus, certRef } = req.body as { halalStatus?: HalalStatus; certRef?: string };
    if (halalStatus && !Object.values(HalalStatus).includes(halalStatus)) {
      res.status(400).json({ success: false, error: "Invalid halal status" });
      return;
    }
    try {
      const material = await prisma.rawMaterial.update({
        where: { id: req.params.id },
        data: {
          ...(halalStatus !== undefined && { halalStatus }),
          ...(certRef     !== undefined && { certRef }),
        },
      });
      res.json({ success: true, data: material });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

export default router;
