import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { getHalalRegistryContract, getSupplyChainTrackerContract, getProvider } from "../lib/blockchain";

const router = Router();

/**
 * GET /api/verify/:productId — PUBLIC endpoint (no auth required).
 * Returns everything a consumer needs to verify a product:
 *   - On-chain halal certification status
 *   - Certificate details (issuing body, expiry)
 *   - Full supply chain timeline
 * Designed to be called by the /verify/[productId] page after QR scan.
 */
router.get("/:productId", async (req: Request, res: Response): Promise<void> => {
  const { productId } = req.params;

  try {
    // 1. Off-chain product record (DB)
    const product = await prisma.product.findFirst({
      where: { OR: [{ id: productId }, { productId }] },
      include: {
        manufacturer: { select: { name: true, company: true } },
        certificate: {
          include: { issuedBy: { select: { name: true } } },
        },
        supplyChainEvents: {
          orderBy: { timestamp: "asc" },
          include: {
            actor: { select: { name: true, company: true, role: true } },
          },
        },
        rawMaterials: {
          include: {
            rawMaterial: {
              include: { supplier: { select: { name: true, company: true } } },
            },
          },
        },
      },
    });

    if (!product) {
      res.status(404).json({ success: false, error: "Product not found" });
      return;
    }

    // 2. On-chain verification (authoritative)
    let onChainStatus = { isHalalCertified: false, certValid: false, certExpired: false };
    let onChainEventCount = 0;

    try {
      const provider = getProvider();
      const registry = getHalalRegistryContract(provider);
      const tracker  = getSupplyChainTrackerContract(provider);

      const onChainProduct = await registry.getProduct(product.productId);
      const isCertified    = await registry.isHalalCertified(product.productId);
      onChainStatus.isHalalCertified = isCertified;

      if (onChainProduct.certificateId !== ethers.ZeroHash) {
        const cert = await registry.getCertificate(onChainProduct.certificateId);
        onChainStatus.certValid   = cert.isValid;
        onChainStatus.certExpired = Number(cert.expiresAt) < Math.floor(Date.now() / 1000);
      }

      onChainEventCount = Number(await tracker.getEventCount(product.productId));
    } catch (chainErr) {
      console.warn("Blockchain read failed (node may be offline):", chainErr);
    }

    // 3. Chain integrity badge
    const dbEventCount = product.supplyChainEvents.length;
    const chainIntegrity = onChainEventCount === 0 || dbEventCount === onChainEventCount
      ? "verified"
      : "mismatch";

    res.json({
      success: true,
      data: {
        product: {
          id:              product.id,
          productId:       product.productId,
          name:            product.name,
          description:     product.description,
          category:        product.category,
          ingredients:     product.ingredients,
          images:          product.images,
          manufacturer:    product.manufacturer,
          registeredAt:    product.createdAt,
          txHash:          product.txHash,
          blockNumber:     product.blockNumber,
        },
        halal: {
          isHalalCertified:    onChainStatus.isHalalCertified,
          dbStatus:            product.halalStatus,
          onChainVerified:     onChainStatus.isHalalCertified,
        },
        certificate: product.certificate
          ? {
              id:           product.certificate.id,
              certificateId: product.certificate.certificateId,
              issuingBody:  product.certificate.issuingBody,
              issuedAt:     product.certificate.issuedAt,
              expiresAt:    product.certificate.expiresAt,
              isValid:      product.certificate.isValid,
              certExpired:  onChainStatus.certExpired,
              documentUrl:  product.certificate.documentUrl,
              issuedBy:     product.certificate.issuedBy.name,
              txHash:       product.certificate.txHash,
            }
          : null,
        supplyChain: {
          events:         product.supplyChainEvents,
          dbEventCount,
          onChainEventCount,
          chainIntegrity,
        },
        rawMaterials: product.rawMaterials.map((pmr) => ({
          name:        pmr.rawMaterial.name,
          origin:      pmr.rawMaterial.origin,
          halalStatus: pmr.rawMaterial.halalStatus,
          supplier:    pmr.rawMaterial.supplier,
          quantity:    pmr.quantity,
          unit:        pmr.unit,
        })),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Needed for the ethers ZeroHash reference above
import { ethers } from "ethers";

export default router;
