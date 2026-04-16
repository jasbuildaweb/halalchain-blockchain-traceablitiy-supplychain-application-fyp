import { Router, Response } from "express";
import { body, validationResult } from "express-validator";
import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../lib/rbac";
import { getHalalRegistryContract } from "../lib/blockchain";
import { generateQRCode } from "../lib/qr";
import { AuthRequest } from "../types";

const router = Router();

// GET /api/products — list products (role-scoped)
router.get("/", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const where =
      user.role === "MANUFACTURER"
        ? { manufacturerId: user.userId }
        : user.role === "ADMIN"
        ? {}
        : {};

    const products = await prisma.product.findMany({
      where,
      include: {
        manufacturer: { select: { id: true, name: true, company: true } },
        certificate: true,
        supplyChainEvents: {
          orderBy: { timestamp: "asc" },
          include: { actor: { select: { id: true, name: true, company: true, role: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// POST /api/products — register new product on-chain + DB
router.post(
  "/",
  authenticate,
  requireRole("MANUFACTURER", "ADMIN"),
  [
    body("name").trim().notEmpty().withMessage("Product name is required"),
    body("description").optional().trim(),
    body("category").optional().trim(),
    body("ingredients").optional().isArray(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: errors.array()[0].msg });
      return;
    }

    const { name, description, category, ingredients } = req.body;

    try {
      // Generate unique bytes32 product ID
      const productId = ethers.keccak256(ethers.toUtf8Bytes(`${uuidv4()}-${name}`));

      // Register on blockchain
      const registry = getHalalRegistryContract();
      const tx = await registry.registerProduct(productId, name);
      const receipt = await tx.wait();

      // Save to PostgreSQL
      const baseUrl = process.env.CLIENT_URL ?? "http://localhost:3000";
      const qrCodeUrl = await generateQRCode(productId, baseUrl);

      const product = await prisma.product.create({
        data: {
          productId,
          name,
          description,
          category,
          ingredients: ingredients ?? [],
          manufacturerId: req.user!.userId,
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          qrCodeUrl,
        },
        include: {
          manufacturer: { select: { id: true, name: true, company: true } },
        },
      });

      res.status(201).json({ success: true, data: product });
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Server error";
      res.status(500).json({ success: false, error: msg });
    }
  }
);

// GET /api/products/:id
router.get("/:id", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await prisma.product.findFirst({
      where: { OR: [{ id: req.params.id }, { productId: req.params.id }] },
      include: {
        manufacturer: { select: { id: true, name: true, company: true } },
        certificate: true,
        supplyChainEvents: {
          orderBy: { timestamp: "asc" },
          include: { actor: { select: { id: true, name: true, company: true, role: true } } },
        },
        rawMaterials: {
          include: {
            rawMaterial: {
              include: { supplier: { select: { id: true, name: true, company: true } } },
            },
          },
        },
      },
    });
    if (!product) {
      res.status(404).json({ success: false, error: "Product not found" });
      return;
    }
    res.json({ success: true, data: product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// PATCH /api/products/:id — update off-chain fields
router.patch(
  "/:id",
  authenticate,
  requireRole("MANUFACTURER", "ADMIN"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { description, category, ingredients } = req.body;
    try {
      const product = await prisma.product.update({
        where: { id: req.params.id },
        data: {
          ...(description !== undefined && { description }),
          ...(category !== undefined && { category }),
          ...(ingredients !== undefined && { ingredients }),
        },
      });
      res.json({ success: true, data: product });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

// GET /api/products/:id/qr — return QR image URL
router.get("/:id/qr", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await prisma.product.findFirst({
      where: { OR: [{ id: req.params.id }, { productId: req.params.id }] },
      select: { qrCodeUrl: true, productId: true },
    });
    if (!product) {
      res.status(404).json({ success: false, error: "Product not found" });
      return;
    }
    const baseUrl = process.env.CLIENT_URL ?? "http://localhost:3000";
    const url = product.qrCodeUrl ?? (await generateQRCode(product.productId, baseUrl));
    res.json({ success: true, data: { qrCodeUrl: url } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

export default router;
