import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

const Role = { NONE: 0, ADMIN: 1, SUPPLIER: 2, MANUFACTURER: 3, LOGISTICS: 4, RETAILER: 5 };

const EventType = {
  RAW_MATERIAL_ADDED:     0,
  MANUFACTURING_STARTED:  1,
  MANUFACTURING_COMPLETE: 2,
  QUALITY_CHECK_PASSED:   3,
  SHIPPED:                4,
  IN_TRANSIT:             5,
  RECEIVED_AT_WAREHOUSE:  6,
  DELIVERED_TO_RETAILER:  7,
  AVAILABLE_FOR_SALE:     8,
};

describe("SupplyChainTracker", function () {
  let roleManager: any, tracker: any;
  let admin: any, supplier: any, manufacturer: any, logistics: any, retailer: any, stranger: any;

  const PRODUCT_A = ethers.keccak256(ethers.toUtf8Bytes("product-A"));
  const PRODUCT_B = ethers.keccak256(ethers.toUtf8Bytes("product-B"));

  beforeEach(async function () {
    [admin, supplier, manufacturer, logistics, retailer, stranger] = await ethers.getSigners();

    roleManager = await (await ethers.getContractFactory("RoleManager")).deploy();
    await roleManager.assignRole(supplier.address,     Role.SUPPLIER);
    await roleManager.assignRole(manufacturer.address, Role.MANUFACTURER);
    await roleManager.assignRole(logistics.address,    Role.LOGISTICS);
    await roleManager.assignRole(retailer.address,     Role.RETAILER);
    // admin is owner → already has ADMIN role from constructor

    tracker = await (await ethers.getContractFactory("SupplyChainTracker"))
      .deploy(await roleManager.getAddress());
  });

  // ─── Authorized event types per role ─────────────────────────────────────────

  describe("authorized recording — correct role + event type", function () {
    it("SUPPLIER records RAW_MATERIAL_ADDED", async function () {
      await tracker.connect(supplier)
        .recordEvent(PRODUCT_A, EventType.RAW_MATERIAL_ADDED, "Farm Selangor", "JAKIM-certified cattle");
      expect(await tracker.getEventCount(PRODUCT_A)).to.equal(1);
    });

    it("MANUFACTURER records MANUFACTURING_STARTED", async function () {
      await tracker.connect(manufacturer)
        .recordEvent(PRODUCT_A, EventType.MANUFACTURING_STARTED, "Factory KL", "");
      expect(await tracker.getEventCount(PRODUCT_A)).to.equal(1);
    });

    it("MANUFACTURER records MANUFACTURING_COMPLETE", async function () {
      await tracker.connect(manufacturer)
        .recordEvent(PRODUCT_A, EventType.MANUFACTURING_COMPLETE, "Factory KL", "");
      expect(await tracker.getEventCount(PRODUCT_A)).to.equal(1);
    });

    it("MANUFACTURER records QUALITY_CHECK_PASSED", async function () {
      await tracker.connect(manufacturer)
        .recordEvent(PRODUCT_A, EventType.QUALITY_CHECK_PASSED, "QC Lab", "All criteria met");
      expect(await tracker.getEventCount(PRODUCT_A)).to.equal(1);
    });

    it("LOGISTICS records SHIPPED", async function () {
      await tracker.connect(logistics)
        .recordEvent(PRODUCT_A, EventType.SHIPPED, "Depot Shah Alam", "");
      expect(await tracker.getEventCount(PRODUCT_A)).to.equal(1);
    });

    it("LOGISTICS records IN_TRANSIT", async function () {
      await tracker.connect(logistics)
        .recordEvent(PRODUCT_A, EventType.IN_TRANSIT, "Highway E1", "");
      expect(await tracker.getEventCount(PRODUCT_A)).to.equal(1);
    });

    it("LOGISTICS records RECEIVED_AT_WAREHOUSE", async function () {
      await tracker.connect(logistics)
        .recordEvent(PRODUCT_A, EventType.RECEIVED_AT_WAREHOUSE, "Warehouse PJ", "");
      expect(await tracker.getEventCount(PRODUCT_A)).to.equal(1);
    });

    it("RETAILER records DELIVERED_TO_RETAILER", async function () {
      await tracker.connect(retailer)
        .recordEvent(PRODUCT_A, EventType.DELIVERED_TO_RETAILER, "Store KLCC", "");
      expect(await tracker.getEventCount(PRODUCT_A)).to.equal(1);
    });

    it("RETAILER records AVAILABLE_FOR_SALE", async function () {
      await tracker.connect(retailer)
        .recordEvent(PRODUCT_A, EventType.AVAILABLE_FOR_SALE, "Store KLCC", "Shelf 3B");
      expect(await tracker.getEventCount(PRODUCT_A)).to.equal(1);
    });

    it("ADMIN can record any event type", async function () {
      await tracker.connect(admin).recordEvent(PRODUCT_A, EventType.RAW_MATERIAL_ADDED, "Admin", "");
      await tracker.connect(admin).recordEvent(PRODUCT_A, EventType.SHIPPED, "Admin", "");
      await tracker.connect(admin).recordEvent(PRODUCT_A, EventType.AVAILABLE_FOR_SALE, "Admin", "");
      expect(await tracker.getEventCount(PRODUCT_A)).to.equal(3);
    });
  });

  // ─── Unauthorized: wrong role for event type ──────────────────────────────────

  describe("unauthorized recording — wrong role for event type", function () {
    it("unregistered address reverts NotAuthorized", async function () {
      await expect(
        tracker.connect(stranger).recordEvent(PRODUCT_A, EventType.RAW_MATERIAL_ADDED, "", "")
      ).to.be.revertedWithCustomError(tracker, "NotAuthorized");
    });

    it("SUPPLIER cannot record MANUFACTURING_STARTED", async function () {
      await expect(
        tracker.connect(supplier).recordEvent(PRODUCT_A, EventType.MANUFACTURING_STARTED, "", "")
      ).to.be.revertedWithCustomError(tracker, "RoleNotPermittedForEventType");
    });

    it("SUPPLIER cannot record SHIPPED", async function () {
      await expect(
        tracker.connect(supplier).recordEvent(PRODUCT_A, EventType.SHIPPED, "", "")
      ).to.be.revertedWithCustomError(tracker, "RoleNotPermittedForEventType");
    });

    it("MANUFACTURER cannot record RAW_MATERIAL_ADDED", async function () {
      await expect(
        tracker.connect(manufacturer).recordEvent(PRODUCT_A, EventType.RAW_MATERIAL_ADDED, "", "")
      ).to.be.revertedWithCustomError(tracker, "RoleNotPermittedForEventType");
    });

    it("MANUFACTURER cannot record SHIPPED", async function () {
      await expect(
        tracker.connect(manufacturer).recordEvent(PRODUCT_A, EventType.SHIPPED, "", "")
      ).to.be.revertedWithCustomError(tracker, "RoleNotPermittedForEventType");
    });

    it("LOGISTICS cannot record RAW_MATERIAL_ADDED", async function () {
      await expect(
        tracker.connect(logistics).recordEvent(PRODUCT_A, EventType.RAW_MATERIAL_ADDED, "", "")
      ).to.be.revertedWithCustomError(tracker, "RoleNotPermittedForEventType");
    });

    it("LOGISTICS cannot record MANUFACTURING_STARTED", async function () {
      await expect(
        tracker.connect(logistics).recordEvent(PRODUCT_A, EventType.MANUFACTURING_STARTED, "", "")
      ).to.be.revertedWithCustomError(tracker, "RoleNotPermittedForEventType");
    });

    it("LOGISTICS cannot record DELIVERED_TO_RETAILER", async function () {
      await expect(
        tracker.connect(logistics).recordEvent(PRODUCT_A, EventType.DELIVERED_TO_RETAILER, "", "")
      ).to.be.revertedWithCustomError(tracker, "RoleNotPermittedForEventType");
    });

    it("RETAILER cannot record SHIPPED", async function () {
      await expect(
        tracker.connect(retailer).recordEvent(PRODUCT_A, EventType.SHIPPED, "", "")
      ).to.be.revertedWithCustomError(tracker, "RoleNotPermittedForEventType");
    });

    it("RETAILER cannot record RAW_MATERIAL_ADDED", async function () {
      await expect(
        tracker.connect(retailer).recordEvent(PRODUCT_A, EventType.RAW_MATERIAL_ADDED, "", "")
      ).to.be.revertedWithCustomError(tracker, "RoleNotPermittedForEventType");
    });
  });

  // ─── Event history / append-only guarantee ───────────────────────────────────

  describe("event history integrity", function () {
    it("history is ordered chronologically and append-only", async function () {
      await tracker.connect(supplier).recordEvent(PRODUCT_A, EventType.RAW_MATERIAL_ADDED, "Farm", "");
      await tracker.connect(manufacturer).recordEvent(PRODUCT_A, EventType.MANUFACTURING_STARTED, "Factory", "");
      await tracker.connect(manufacturer).recordEvent(PRODUCT_A, EventType.MANUFACTURING_COMPLETE, "Factory", "");
      await tracker.connect(logistics).recordEvent(PRODUCT_A, EventType.SHIPPED, "Depot", "");
      await tracker.connect(retailer).recordEvent(PRODUCT_A, EventType.AVAILABLE_FOR_SALE, "Store", "");

      expect(await tracker.getEventCount(PRODUCT_A)).to.equal(5);
      const history = await tracker.getProductHistory(PRODUCT_A);
      expect(history[0].eventType).to.equal(EventType.RAW_MATERIAL_ADDED);
      expect(history[1].eventType).to.equal(EventType.MANUFACTURING_STARTED);
      expect(history[2].eventType).to.equal(EventType.MANUFACTURING_COMPLETE);
      expect(history[3].eventType).to.equal(EventType.SHIPPED);
      expect(history[4].eventType).to.equal(EventType.AVAILABLE_FOR_SALE);
    });

    it("getProductHistory returns correct event data at index 0", async function () {
      await tracker.connect(supplier)
        .recordEvent(PRODUCT_A, EventType.RAW_MATERIAL_ADDED, "Farm Selangor", "halal cattle");
      // Use getProductHistory instead of getEvent to avoid the ethers v6 name collision
      const history = await tracker.getProductHistory(PRODUCT_A);
      const ev = history[0];
      expect(ev.eventType).to.equal(EventType.RAW_MATERIAL_ADDED);
      expect(ev.actor).to.equal(supplier.address);
      expect(ev.location).to.equal("Farm Selangor");
      expect(ev.notes).to.equal("halal cattle");
      expect(ev.productId).to.equal(PRODUCT_A);
    });

    it("event count is 0 for a product with no recorded events", async function () {
      expect(await tracker.getEventCount(PRODUCT_B)).to.equal(0);
    });

    it("events for different products are isolated", async function () {
      await tracker.connect(supplier).recordEvent(PRODUCT_A, EventType.RAW_MATERIAL_ADDED, "", "");
      await tracker.connect(manufacturer).recordEvent(PRODUCT_B, EventType.MANUFACTURING_STARTED, "", "");
      expect(await tracker.getEventCount(PRODUCT_A)).to.equal(1);
      expect(await tracker.getEventCount(PRODUCT_B)).to.equal(1);
      const histA = await tracker.getProductHistory(PRODUCT_A);
      const histB = await tracker.getProductHistory(PRODUCT_B);
      expect(histA[0].eventType).to.equal(EventType.RAW_MATERIAL_ADDED);
      expect(histB[0].eventType).to.equal(EventType.MANUFACTURING_STARTED);
    });

    it("emits SupplyChainEventRecorded with correct args", async function () {
      await expect(
        tracker.connect(supplier)
          .recordEvent(PRODUCT_A, EventType.RAW_MATERIAL_ADDED, "Farm A", "halal cattle")
      ).to.emit(tracker, "SupplyChainEventRecorded")
        .withArgs(
          PRODUCT_A,
          anyValue,                        // eventId (keccak hash)
          EventType.RAW_MATERIAL_ADDED,
          supplier.address,
          anyValue,                        // timestamp
          "Farm A",
          "halal cattle"
        );
    });
  });
});
