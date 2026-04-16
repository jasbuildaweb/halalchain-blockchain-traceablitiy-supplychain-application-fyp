import { Router, Response } from "express";
import { body, validationResult } from "express-validator";
import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../lib/rbac";
import { getHalalRegistryContract } from "../lib/blockchain";
import { AuthRequest } from "../types";

const router = Router();

// POST /api/certificates — issue halal certificate (Admin only)
router.post(
  "/",
  authenticate,
  requireRole("ADMIN"),
  [
    body("productId").notEmpty(),
    body("issuingBody").trim().notEmpty().withMessage("Issuing body is required (e.g. JAKIM)"),
    body("expiresAt").isISO8601().withMessage("Valid expiry date required"),
    body("documentUrl").optional().isURL(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: errors.array()[0].msg });
      return;
    }

    const { productId: dbProductId, issuingBody, expiresAt, documentUrl } = req.body as {
      productId: string;
      issuingBody: string;
      expiresAt: string;
      documentUrl?: string;
    };

    try {
      const product = await prisma.product.findFirst({
        where: { OR: [{ id: dbProductId }, { productId: dbProductId }] },
      });
      if (!product) {
        res.status(404).json({ success: false, error: "Product not found" });
        return;
      }

      const expiresDate = new Date(expiresAt);
      const expiresUnix = Math.floor(expiresDate.getTime() / 1000);
      const certificateId = ethers.keccak256(
        ethers.toUtf8Bytes(`cert-${uuidv4()}-${product.productId}`)
      );

      // Issue on blockchain
      const registry = getHalalRegistryContract();
      const tx = await registry.issueCertificate(
        product.productId,
        certificateId,
        issuingBody,
        expiresUnix
      );
      const receipt = await tx.wait();

      // Save to DB
      const certificate = await prisma.certificate.create({
        data: {
          certificateId,
          issuingBody,
          expiresAt:   expiresDate,
          documentUrl,
          productId:   product.id,
          issuedById:  req.user!.userId,
          txHash:      receipt.hash,
          blockNumber: receipt.blockNumber,
        },
      });

      // Update product status
      await prisma.product.update({
        where: { id: product.id },
        data: { isHalalCertified: true, halalStatus: "CERTIFIED" },
      });

      res.status(201).json({ success: true, data: certificate });
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Server error";
      res.status(500).json({ success: false, error: msg });
    }
  }
);

// GET /api/certificates — list all (Admin) or by product
router.get("/", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productId } = req.query;
    const where = productId
      ? { product: { OR: [{ id: productId as string }, { productId: productId as string }] } }
      : {};

    const certs = await prisma.certificate.findMany({
      where,
      include: {
        product:  { select: { id: true, name: true, productId: true } },
        issuedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: certs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// GET /api/certificates/:id
router.get("/:id", async (req, res: Response): Promise<void> => {
  try {
    const cert = await prisma.certificate.findFirst({
      where: { OR: [{ id: req.params.id }, { certificateId: req.params.id }] },
      include: {
        product:  { select: { id: true, name: true, productId: true } },
        issuedBy: { select: { id: true, name: true } },
      },
    });
    if (!cert) {
      res.status(404).json({ success: false, error: "Certificate not found" });
      return;
    }
    res.json({ success: true, data: cert });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// DELETE /api/certificates/:id — revoke
router.delete(
  "/:id",
  authenticate,
  requireRole("ADMIN"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { reason } = req.body as { reason?: string };
    try {
      const cert = await prisma.certificate.findFirst({
        where: { OR: [{ id: req.params.id }, { certificateId: req.params.id }] },
      });
      if (!cert) {
        res.status(404).json({ success: false, error: "Certificate not found" });
        return;
      }

      // Revoke on blockchain
      const registry = getHalalRegistryContract();
      const tx = await registry.revokeCertificate(cert.certificateId);
      await tx.wait();

      // Update DB
      await prisma.certificate.update({
        where: { id: cert.id },
        data: { isValid: false, revocationReason: reason },
      });
      await prisma.product.update({
        where: { id: cert.productId },
        data: { isHalalCertified: false, halalStatus: "REVOKED" },
      });

      res.json({ success: true, message: "Certificate revoked" });
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Server error";
      res.status(500).json({ success: false, error: msg });
    }
  }
);

export default router;
