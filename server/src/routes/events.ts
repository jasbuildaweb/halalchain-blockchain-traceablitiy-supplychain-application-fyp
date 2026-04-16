import { Router, Response } from "express";
import { body, validationResult } from "express-validator";
import { EventType, Role } from "@prisma/client";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../lib/rbac";
import { getSupplyChainTrackerContract } from "../lib/blockchain";
import { AuthRequest } from "../types";

const router = Router();

// EventType enum index must match the Solidity enum order exactly
const EVENT_TYPE_INDEX: Record<EventType, number> = {
  RAW_MATERIAL_ADDED:      0,
  MANUFACTURING_STARTED:   1,
  MANUFACTURING_COMPLETE:  2,
  QUALITY_CHECK_PASSED:    3,
  SHIPPED:                 4,
  IN_TRANSIT:              5,
  RECEIVED_AT_WAREHOUSE:   6,
  DELIVERED_TO_RETAILER:   7,
  AVAILABLE_FOR_SALE:      8,
};

// Which roles can record which event types
const ROLE_ALLOWED_EVENTS: Record<string, EventType[]> = {
  SUPPLIER:     ["RAW_MATERIAL_ADDED"],
  MANUFACTURER: ["MANUFACTURING_STARTED", "MANUFACTURING_COMPLETE", "QUALITY_CHECK_PASSED"],
  LOGISTICS:    ["SHIPPED", "IN_TRANSIT", "RECEIVED_AT_WAREHOUSE"],
  RETAILER:     ["DELIVERED_TO_RETAILER", "AVAILABLE_FOR_SALE"],
  ADMIN:        Object.values(EventType),
};

// POST /api/events
router.post(
  "/",
  authenticate,
  requireRole("SUPPLIER", "MANUFACTURER", "LOGISTICS", "RETAILER", "ADMIN"),
  [
    body("productId").notEmpty().withMessage("productId is required"),
    body("eventType").isIn(Object.values(EventType)).withMessage("Invalid event type"),
    body("location").trim().notEmpty().withMessage("Location is required"),
    body("notes").optional().trim(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: errors.array()[0].msg });
      return;
    }

    const { productId: dbProductId, eventType, location, notes } = req.body as {
      productId: string;
      eventType: EventType;
      location: string;
      notes?: string;
    };

    const userRole = req.user!.role as Role;
    const allowed = ROLE_ALLOWED_EVENTS[userRole] ?? [];
    if (!allowed.includes(eventType)) {
      res.status(403).json({
        success: false,
        error: `Role ${userRole} cannot record event type ${eventType}`,
      });
      return;
    }

    try {
      // Find product (by DB id or on-chain productId hex)
      const product = await prisma.product.findFirst({
        where: { OR: [{ id: dbProductId }, { productId: dbProductId }] },
      });
      if (!product) {
        res.status(404).json({ success: false, error: "Product not found" });
        return;
      }

      // Record on blockchain
      const tracker = getSupplyChainTrackerContract();
      const tx = await tracker.recordEvent(
        product.productId,
        EVENT_TYPE_INDEX[eventType],
        location,
        notes ?? ""
      );
      const receipt = await tx.wait();

      // Extract on-chain eventId from emitted log
      let onChainEventId = "";
      for (const log of receipt.logs) {
        try {
          const parsed = tracker.interface.parseLog(log);
          if (parsed?.name === "SupplyChainEventRecorded") {
            onChainEventId = parsed.args.eventId as string;
            break;
          }
        } catch { /* skip unparseable logs */ }
      }

      // Save to DB
      const event = await prisma.supplyChainEvent.create({
        data: {
          eventId:    onChainEventId || `fallback-${Date.now()}`,
          eventType,
          location,
          notes,
          txHash:     receipt.hash,
          blockNumber: receipt.blockNumber,
          productId:  product.id,
          actorId:    req.user!.userId,
        },
        include: {
          actor:   { select: { id: true, name: true, company: true, role: true } },
          product: { select: { id: true, name: true, productId: true } },
        },
      });

      res.status(201).json({ success: true, data: event });
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Server error";
      res.status(500).json({ success: false, error: msg });
    }
  }
);

// GET /api/events/:productId — full event log for a product
router.get("/:productId", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await prisma.product.findFirst({
      where: { OR: [{ id: req.params.productId }, { productId: req.params.productId }] },
    });
    if (!product) {
      res.status(404).json({ success: false, error: "Product not found" });
      return;
    }

    const events = await prisma.supplyChainEvent.findMany({
      where: { productId: product.id },
      orderBy: { timestamp: "asc" },
      include: {
        actor: { select: { id: true, name: true, company: true, role: true } },
      },
    });
    res.json({ success: true, data: events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

export default router;
