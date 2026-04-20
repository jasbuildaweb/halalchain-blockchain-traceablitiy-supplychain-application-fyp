import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

const Role = { NONE: 0, ADMIN: 1, SUPPLIER: 2, MANUFACTURER: 3, LOGISTICS: 4, RETAILER: 5 };

describe("HalalRegistry", function () {
  let roleManager: any, registry: any;
  let owner: any, mfr: any, stranger: any;

  const PRODUCT_ID = ethers.keccak256(ethers.toUtf8Bytes("halal-beef-batch-001"));
  const CERT_ID    = ethers.keccak256(ethers.toUtf8Bytes("jakim-cert-2024-001"));
  const FUTURE     = Math.floor(Date.now() / 1000) + 365 * 24 * 3600; // +1 year
  const PAST       = Math.floor(Date.now() / 1000) - 1;               // 1 second ago

  beforeEach(async function () {
    [owner, mfr, stranger] = await ethers.getSigners();

    roleManager = await (await ethers.getContractFactory("RoleManager")).deploy();
    await roleManager.assignRole(mfr.address, Role.MANUFACTURER);

    registry = await (await ethers.getContractFactory("HalalRegistry"))
      .deploy(await roleManager.getAddress());
  });

  // ─── registerProduct ─────────────────────────────────────────────────────────

  describe("registerProduct", function () {
    it("manufacturer registers a product successfully", async function () {
      await registry.connect(mfr).registerProduct(PRODUCT_ID, "Halal Beef");
      const p = await registry.getProduct(PRODUCT_ID);
      expect(p.name).to.equal("Halal Beef");
      expect(p.registeredBy).to.equal(mfr.address);
      expect(p.isHalalCertified).to.be.false;
      expect(p.exists).to.be.true;
    });

    it("admin can also register a product", async function () {
      await registry.connect(owner).registerProduct(PRODUCT_ID, "Halal Chicken");
      expect((await registry.getProduct(PRODUCT_ID)).exists).to.be.true;
    });

    it("unauthorized address cannot register — reverts NotAuthorized", async function () {
      await expect(
        registry.connect(stranger).registerProduct(PRODUCT_ID, "Fake Product")
      ).to.be.revertedWithCustomError(registry, "NotAuthorized");
    });

    it("duplicate product ID reverts ProductAlreadyExists", async function () {
      await registry.connect(mfr).registerProduct(PRODUCT_ID, "Halal Beef");
      await expect(
        registry.connect(mfr).registerProduct(PRODUCT_ID, "Halal Beef v2")
      ).to.be.revertedWithCustomError(registry, "ProductAlreadyExists");
    });

    it("getProduct reverts for non-existent ID", async function () {
      const unknownId = ethers.keccak256(ethers.toUtf8Bytes("does-not-exist"));
      await expect(
        registry.getProduct(unknownId)
      ).to.be.revertedWithCustomError(registry, "ProductNotFound");
    });

    it("emits ProductRegistered event", async function () {
      await expect(registry.connect(mfr).registerProduct(PRODUCT_ID, "Halal Beef"))
        .to.emit(registry, "ProductRegistered")
        .withArgs(PRODUCT_ID, mfr.address, "Halal Beef", anyValue);
    });

    it("product count increments after registration", async function () {
      expect(await registry.getProductCount()).to.equal(0);
      await registry.connect(mfr).registerProduct(PRODUCT_ID, "Halal Beef");
      expect(await registry.getProductCount()).to.equal(1);
    });

    it("getAllProductIds returns the registered product ID", async function () {
      await registry.connect(mfr).registerProduct(PRODUCT_ID, "Halal Beef");
      const ids = await registry.getAllProductIds();
      expect(ids).to.include(PRODUCT_ID);
    });
  });

  // ─── issueCertificate ────────────────────────────────────────────────────────

  describe("issueCertificate", function () {
    beforeEach(async function () {
      await registry.connect(mfr).registerProduct(PRODUCT_ID, "Halal Beef");
    });

    it("admin issues certificate and product becomes halal-certified", async function () {
      await registry.connect(owner).issueCertificate(PRODUCT_ID, CERT_ID, "JAKIM", FUTURE);
      expect(await registry.isHalalCertified(PRODUCT_ID)).to.be.true;
    });

    it("issued certificate stores correct metadata", async function () {
      await registry.connect(owner).issueCertificate(PRODUCT_ID, CERT_ID, "JAKIM", FUTURE);
      const cert = await registry.getCertificate(CERT_ID);
      expect(cert.issuingBody).to.equal("JAKIM");
      expect(cert.isValid).to.be.true;
      expect(Number(cert.expiresAt)).to.equal(FUTURE);
    });

    it("non-admin cannot issue certificate — reverts NotAuthorized", async function () {
      await expect(
        registry.connect(mfr).issueCertificate(PRODUCT_ID, CERT_ID, "JAKIM", FUTURE)
      ).to.be.revertedWithCustomError(registry, "NotAuthorized");
    });

    it("issuing for non-existent product reverts ProductNotFound", async function () {
      const unknownId = ethers.keccak256(ethers.toUtf8Bytes("no-such-product"));
      await expect(
        registry.connect(owner).issueCertificate(unknownId, CERT_ID, "JAKIM", FUTURE)
      ).to.be.revertedWithCustomError(registry, "ProductNotFound");
    });

    it("emits CertificateIssued event", async function () {
      await expect(
        registry.connect(owner).issueCertificate(PRODUCT_ID, CERT_ID, "JAKIM", FUTURE)
      ).to.emit(registry, "CertificateIssued")
        .withArgs(PRODUCT_ID, CERT_ID, "JAKIM", FUTURE);
    });
  });

  // ─── revokeCertificate ───────────────────────────────────────────────────────

  describe("revokeCertificate", function () {
    beforeEach(async function () {
      await registry.connect(mfr).registerProduct(PRODUCT_ID, "Halal Beef");
      await registry.connect(owner).issueCertificate(PRODUCT_ID, CERT_ID, "JAKIM", FUTURE);
    });

    it("admin revokes certificate — product loses halal-certified status", async function () {
      await registry.connect(owner).revokeCertificate(CERT_ID);
      expect(await registry.isHalalCertified(PRODUCT_ID)).to.be.false;
    });

    it("revoked certificate has isValid = false", async function () {
      await registry.connect(owner).revokeCertificate(CERT_ID);
      const cert = await registry.getCertificate(CERT_ID);
      expect(cert.isValid).to.be.false;
    });

    it("non-admin cannot revoke — reverts NotAuthorized", async function () {
      await expect(
        registry.connect(mfr).revokeCertificate(CERT_ID)
      ).to.be.revertedWithCustomError(registry, "NotAuthorized");
    });

    it("revoking non-existent certificate reverts CertificateNotFound", async function () {
      const fakeCertId = ethers.keccak256(ethers.toUtf8Bytes("fake-cert-id"));
      await expect(
        registry.connect(owner).revokeCertificate(fakeCertId)
      ).to.be.revertedWithCustomError(registry, "CertificateNotFound");
    });

    it("emits CertificateRevoked event", async function () {
      await expect(registry.connect(owner).revokeCertificate(CERT_ID))
        .to.emit(registry, "CertificateRevoked")
        .withArgs(CERT_ID, PRODUCT_ID, anyValue);
    });
  });

  // ─── certificate expiry ──────────────────────────────────────────────────────

  describe("certificate expiry", function () {
    it("isHalalCertified returns false when certificate is expired", async function () {
      await registry.connect(mfr).registerProduct(PRODUCT_ID, "Halal Beef");
      // expiresAt set 1 second in the past → already expired
      await registry.connect(owner).issueCertificate(PRODUCT_ID, CERT_ID, "JAKIM", PAST);
      expect(await registry.isHalalCertified(PRODUCT_ID)).to.be.false;
    });

    it("isHalalCertified returns false for product with no certificate", async function () {
      await registry.connect(mfr).registerProduct(PRODUCT_ID, "Halal Beef");
      expect(await registry.isHalalCertified(PRODUCT_ID)).to.be.false;
    });

    it("isHalalCertified returns false for completely unregistered product", async function () {
      const unknownId = ethers.keccak256(ethers.toUtf8Bytes("unknown-product"));
      expect(await registry.isHalalCertified(unknownId)).to.be.false;
    });
  });
});
