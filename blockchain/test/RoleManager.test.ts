import { expect } from "chai";
import { ethers } from "hardhat";

const Role = { NONE: 0, ADMIN: 1, SUPPLIER: 2, MANUFACTURER: 3, LOGISTICS: 4, RETAILER: 5 };

describe("RoleManager", function () {
  let roleManager: any;
  let owner: any, addr1: any, addr2: any;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    roleManager = await (await ethers.getContractFactory("RoleManager")).deploy();
  });

  // ─── Deployment ──────────────────────────────────────────────────────────────

  it("sets deployer as owner", async function () {
    expect(await roleManager.owner()).to.equal(owner.address);
  });

  it("assigns ADMIN role to deployer at construction", async function () {
    expect(await roleManager.isAdmin(owner.address)).to.be.true;
    expect(await roleManager.getRole(owner.address)).to.equal(Role.ADMIN);
  });

  it("unregistered address has NONE role", async function () {
    expect(await roleManager.getRole(addr1.address)).to.equal(Role.NONE);
    expect(await roleManager.hasRole(addr1.address, Role.SUPPLIER)).to.be.false;
  });

  // ─── assignRole ──────────────────────────────────────────────────────────────

  it("owner assigns SUPPLIER role", async function () {
    await roleManager.assignRole(addr1.address, Role.SUPPLIER);
    expect(await roleManager.hasRole(addr1.address, Role.SUPPLIER)).to.be.true;
    expect(await roleManager.getRole(addr1.address)).to.equal(Role.SUPPLIER);
  });

  it("owner assigns MANUFACTURER role", async function () {
    await roleManager.assignRole(addr1.address, Role.MANUFACTURER);
    expect(await roleManager.getRole(addr1.address)).to.equal(Role.MANUFACTURER);
  });

  it("owner assigns LOGISTICS role", async function () {
    await roleManager.assignRole(addr1.address, Role.LOGISTICS);
    expect(await roleManager.getRole(addr1.address)).to.equal(Role.LOGISTICS);
  });

  it("owner assigns RETAILER role", async function () {
    await roleManager.assignRole(addr1.address, Role.RETAILER);
    expect(await roleManager.getRole(addr1.address)).to.equal(Role.RETAILER);
  });

  it("non-owner cannot assign roles — reverts NotOwner", async function () {
    await expect(
      roleManager.connect(addr1).assignRole(addr2.address, Role.SUPPLIER)
    ).to.be.revertedWithCustomError(roleManager, "NotOwner");
  });

  it("assignRole reverts for zero address — reverts ZeroAddress", async function () {
    await expect(
      roleManager.assignRole(ethers.ZeroAddress, Role.SUPPLIER)
    ).to.be.revertedWithCustomError(roleManager, "ZeroAddress");
  });

  it("assignRole emits RoleAssigned event", async function () {
    await expect(roleManager.assignRole(addr1.address, Role.MANUFACTURER))
      .to.emit(roleManager, "RoleAssigned")
      .withArgs(addr1.address, Role.MANUFACTURER);
  });

  it("role can be reassigned to a different role", async function () {
    await roleManager.assignRole(addr1.address, Role.SUPPLIER);
    await roleManager.assignRole(addr1.address, Role.RETAILER);
    expect(await roleManager.getRole(addr1.address)).to.equal(Role.RETAILER);
    expect(await roleManager.hasRole(addr1.address, Role.SUPPLIER)).to.be.false;
  });

  // ─── revokeRole ──────────────────────────────────────────────────────────────

  it("owner revokes a role back to NONE", async function () {
    await roleManager.assignRole(addr1.address, Role.LOGISTICS);
    await roleManager.revokeRole(addr1.address);
    expect(await roleManager.getRole(addr1.address)).to.equal(Role.NONE);
    expect(await roleManager.hasRole(addr1.address, Role.LOGISTICS)).to.be.false;
  });

  it("non-owner cannot revoke roles — reverts NotOwner", async function () {
    await expect(
      roleManager.connect(addr1).revokeRole(addr2.address)
    ).to.be.revertedWithCustomError(roleManager, "NotOwner");
  });

  it("revokeRole emits RoleRevoked event", async function () {
    await roleManager.assignRole(addr1.address, Role.SUPPLIER);
    await expect(roleManager.revokeRole(addr1.address))
      .to.emit(roleManager, "RoleRevoked")
      .withArgs(addr1.address);
  });
});
