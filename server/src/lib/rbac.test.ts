import { can } from "./rbac";

// Full coverage of the permission matrix defined in rbac.ts.
// Pure unit tests — no I/O, no mocking required.

describe("RBAC — can(role, permission)", function () {

  // ─── ADMIN ──────────────────────────────────────────────────────────────────

  describe("ADMIN", function () {
    it("has wildcard and is granted every permission", function () {
      expect(can("ADMIN", "products:read")).toBe(true);
      expect(can("ADMIN", "products:write")).toBe(true);
      expect(can("ADMIN", "events:write")).toBe(true);
      expect(can("ADMIN", "certificates:read")).toBe(true);
      expect(can("ADMIN", "certificates:write")).toBe(true);
      expect(can("ADMIN", "users:read")).toBe(true);
      expect(can("ADMIN", "users:write")).toBe(true);
      expect(can("ADMIN", "raw-materials:read")).toBe(true);
      expect(can("ADMIN", "raw-materials:write")).toBe(true);
      expect(can("ADMIN", "verify:read")).toBe(true);
    });
  });

  // ─── SUPPLIER ───────────────────────────────────────────────────────────────

  describe("SUPPLIER", function () {
    it("is granted its allowed permissions", function () {
      expect(can("SUPPLIER", "raw-materials:read")).toBe(true);
      expect(can("SUPPLIER", "raw-materials:write")).toBe(true);
      expect(can("SUPPLIER", "events:write")).toBe(true);
      expect(can("SUPPLIER", "products:read")).toBe(true);
      expect(can("SUPPLIER", "verify:read")).toBe(true);
    });

    it("is denied permissions outside its scope", function () {
      expect(can("SUPPLIER", "products:write")).toBe(false);
      expect(can("SUPPLIER", "certificates:read")).toBe(false);
      expect(can("SUPPLIER", "certificates:write")).toBe(false);
      expect(can("SUPPLIER", "users:read")).toBe(false);
      expect(can("SUPPLIER", "users:write")).toBe(false);
    });
  });

  // ─── MANUFACTURER ────────────────────────────────────────────────────────────

  describe("MANUFACTURER", function () {
    it("is granted its allowed permissions", function () {
      expect(can("MANUFACTURER", "products:read")).toBe(true);
      expect(can("MANUFACTURER", "products:write")).toBe(true);
      expect(can("MANUFACTURER", "events:write")).toBe(true);
      expect(can("MANUFACTURER", "raw-materials:read")).toBe(true);
      expect(can("MANUFACTURER", "verify:read")).toBe(true);
    });

    it("cannot write raw materials, certificates, or manage users", function () {
      expect(can("MANUFACTURER", "raw-materials:write")).toBe(false);
      expect(can("MANUFACTURER", "certificates:read")).toBe(false);
      expect(can("MANUFACTURER", "certificates:write")).toBe(false);
      expect(can("MANUFACTURER", "users:read")).toBe(false);
      expect(can("MANUFACTURER", "users:write")).toBe(false);
    });
  });

  // ─── LOGISTICS ───────────────────────────────────────────────────────────────

  describe("LOGISTICS", function () {
    it("is granted its allowed permissions", function () {
      expect(can("LOGISTICS", "products:read")).toBe(true);
      expect(can("LOGISTICS", "events:write")).toBe(true);
      expect(can("LOGISTICS", "verify:read")).toBe(true);
    });

    it("cannot write products, materials, certificates, or manage users", function () {
      expect(can("LOGISTICS", "products:write")).toBe(false);
      expect(can("LOGISTICS", "raw-materials:read")).toBe(false);
      expect(can("LOGISTICS", "raw-materials:write")).toBe(false);
      expect(can("LOGISTICS", "certificates:read")).toBe(false);
      expect(can("LOGISTICS", "certificates:write")).toBe(false);
      expect(can("LOGISTICS", "users:read")).toBe(false);
      expect(can("LOGISTICS", "users:write")).toBe(false);
    });
  });

  // ─── RETAILER ────────────────────────────────────────────────────────────────

  describe("RETAILER", function () {
    it("is granted its allowed permissions", function () {
      expect(can("RETAILER", "products:read")).toBe(true);
      expect(can("RETAILER", "events:write")).toBe(true);
      expect(can("RETAILER", "verify:read")).toBe(true);
    });

    it("cannot write products, manage materials, certificates, or users", function () {
      expect(can("RETAILER", "products:write")).toBe(false);
      expect(can("RETAILER", "raw-materials:read")).toBe(false);
      expect(can("RETAILER", "raw-materials:write")).toBe(false);
      expect(can("RETAILER", "certificates:read")).toBe(false);
      expect(can("RETAILER", "certificates:write")).toBe(false);
      expect(can("RETAILER", "users:read")).toBe(false);
      expect(can("RETAILER", "users:write")).toBe(false);
    });
  });

  // ─── CONSUMER ────────────────────────────────────────────────────────────────

  describe("CONSUMER", function () {
    it("can only read the verify endpoint", function () {
      expect(can("CONSUMER", "verify:read")).toBe(true);
    });

    it("is denied every other permission", function () {
      expect(can("CONSUMER", "products:read")).toBe(false);
      expect(can("CONSUMER", "products:write")).toBe(false);
      expect(can("CONSUMER", "events:write")).toBe(false);
      expect(can("CONSUMER", "certificates:read")).toBe(false);
      expect(can("CONSUMER", "certificates:write")).toBe(false);
      expect(can("CONSUMER", "users:read")).toBe(false);
      expect(can("CONSUMER", "users:write")).toBe(false);
      expect(can("CONSUMER", "raw-materials:read")).toBe(false);
      expect(can("CONSUMER", "raw-materials:write")).toBe(false);
    });
  });
});
