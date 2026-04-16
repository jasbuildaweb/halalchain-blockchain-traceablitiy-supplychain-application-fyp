import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ethers is injected by @nomicfoundation/hardhat-ethers at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ethers = (hre as any).ethers;

/**
 * Seed script — populates the local Hardhat chain with demo data for the FYP demo.
 *
 * Accounts used (Hardhat defaults):
 *   #0  0xf39Fd…  → ADMIN / deployer
 *   #1  0x7099…   → SUPPLIER
 *   #2  0x3C44…   → MANUFACTURER
 *   #3  0x90F7…   → LOGISTICS
 *   #4  0x15d3…   → RETAILER
 */
async function main() {
  const signers = await ethers.getSigners();
  const [admin, supplier, manufacturer, logistics, retailer] = signers;

  const deployment = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../deployments/localhost.json"), "utf-8")
  );

  const roleManagerAddr        = deployment.contracts.RoleManager.address;
  const halalRegistryAddr      = deployment.contracts.HalalRegistry.address;
  const supplyChainTrackerAddr = deployment.contracts.SupplyChainTracker.address;

  const roleManagerAbi        = JSON.parse(deployment.contracts.RoleManager.abi);
  const halalRegistryAbi      = JSON.parse(deployment.contracts.HalalRegistry.abi);
  const supplyChainTrackerAbi = JSON.parse(deployment.contracts.SupplyChainTracker.abi);

  const roleManager   = new ethers.Contract(roleManagerAddr,    roleManagerAbi,   admin);
  const halalRegistry = new ethers.Contract(halalRegistryAddr,  halalRegistryAbi, admin);

  console.log("Seeding roles...");
  // Role enum: 0=NONE, 1=ADMIN, 2=SUPPLIER, 3=MANUFACTURER, 4=LOGISTICS, 5=RETAILER
  await (await roleManager.assignRole(supplier.address,     2)).wait();
  await (await roleManager.assignRole(manufacturer.address, 3)).wait();
  await (await roleManager.assignRole(logistics.address,    4)).wait();
  await (await roleManager.assignRole(retailer.address,     5)).wait();
  console.log("  Roles assigned to all demo accounts.");

  // ─── Product 1: Chicken Rendang ──────────────────────────────────────────
  const productId1 = ethers.keccak256(ethers.toUtf8Bytes("chicken-rendang-001"));

  console.log("\nRegistering product: Chicken Rendang...");
  const mfcRegistry = new ethers.Contract(halalRegistryAddr, halalRegistryAbi, manufacturer);
  await (await mfcRegistry.registerProduct(productId1, "Chicken Rendang")).wait();

  const trackerSupplier     = new ethers.Contract(supplyChainTrackerAddr, supplyChainTrackerAbi, supplier);
  const trackerManufacturer = new ethers.Contract(supplyChainTrackerAddr, supplyChainTrackerAbi, manufacturer);
  const trackerLogistics    = new ethers.Contract(supplyChainTrackerAddr, supplyChainTrackerAbi, logistics);
  const trackerRetailer     = new ethers.Contract(supplyChainTrackerAddr, supplyChainTrackerAbi, retailer);

  // EventType: 0=RAW_MATERIAL_ADDED, 1=MFG_STARTED, 2=MFG_COMPLETE, 3=QUALITY_CHECK,
  //            4=SHIPPED, 5=IN_TRANSIT, 6=RECEIVED_AT_WH, 7=DELIVERED, 8=AVAILABLE
  await (await trackerSupplier.recordEvent(productId1, 0, "Kelantan Farm, Malaysia", "Fresh free-range chicken delivered")).wait();
  await (await trackerManufacturer.recordEvent(productId1, 1, "Kuala Lumpur Factory, Malaysia", "Production line A started")).wait();
  await (await trackerManufacturer.recordEvent(productId1, 2, "Kuala Lumpur Factory, Malaysia", "Batch KL-2024-001 completed")).wait();
  await (await trackerManufacturer.recordEvent(productId1, 3, "Kuala Lumpur QA Lab, Malaysia", "JAKIM inspector on-site — passed")).wait();
  await (await trackerLogistics.recordEvent(productId1, 4, "Port Klang, Malaysia", "Container MSKU-4821 loaded")).wait();
  await (await trackerLogistics.recordEvent(productId1, 5, "Johor Bahru Checkpoint, Malaysia", "In transit — temperature 4°C")).wait();
  await (await trackerLogistics.recordEvent(productId1, 6, "Shah Alam Warehouse, Malaysia", "Received — cold chain intact")).wait();
  await (await trackerRetailer.recordEvent(productId1, 7, "Aeon Mall Shah Alam, Malaysia", "Accepted by store manager")).wait();
  await (await trackerRetailer.recordEvent(productId1, 8, "Aeon Mall Shah Alam — Chilled Section", "On shelf, price tag applied")).wait();

  console.log("  Issuing JAKIM halal certificate...");
  const certId1    = ethers.keccak256(ethers.toUtf8Bytes("cert-jakim-chicken-rendang-001"));
  const expiresAt1 = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
  await (await halalRegistry.issueCertificate(productId1, certId1, "JAKIM", expiresAt1)).wait();
  console.log("  ✓ Certificate issued.");

  // ─── Product 2: Beef Burger Patty ────────────────────────────────────────
  const productId2 = ethers.keccak256(ethers.toUtf8Bytes("beef-burger-patty-002"));

  console.log("\nRegistering product: Beef Burger Patty...");
  await (await mfcRegistry.registerProduct(productId2, "Beef Burger Patty")).wait();
  await (await trackerSupplier.recordEvent(productId2, 0, "Pahang Cattle Farm, Malaysia", "Halal-slaughtered beef, batch PH-022")).wait();
  await (await trackerManufacturer.recordEvent(productId2, 1, "Selangor Processing Plant, Malaysia", "Grinding and forming started")).wait();
  await (await trackerManufacturer.recordEvent(productId2, 2, "Selangor Processing Plant, Malaysia", "1000 units formed and flash-frozen")).wait();
  console.log("  ✓ Beef Burger Patty registered (no cert yet — pending state demo).");

  console.log("\n=== Seed complete ===");
  console.log("Product 1 (Halal certified) ID:", productId1);
  console.log("Product 2 (Pending cert)    ID:", productId2);
  console.log("Admin wallet:        ", admin.address);
  console.log("Supplier wallet:     ", supplier.address);
  console.log("Manufacturer wallet: ", manufacturer.address);
  console.log("Logistics wallet:    ", logistics.address);
  console.log("Retailer wallet:     ", retailer.address);

  const outDir = path.join(__dirname, "../deployments");
  fs.writeFileSync(path.join(outDir, "seed.json"), JSON.stringify({
    products: [
      { productId: productId1, name: "Chicken Rendang",   certId: certId1, isHalalCertified: true  },
      { productId: productId2, name: "Beef Burger Patty", certId: null,    isHalalCertified: false },
    ],
    wallets: { admin: admin.address, supplier: supplier.address, manufacturer: manufacturer.address, logistics: logistics.address, retailer: retailer.address },
  }, null, 2));
  console.log("\nSeed data written to blockchain/deployments/seed.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
