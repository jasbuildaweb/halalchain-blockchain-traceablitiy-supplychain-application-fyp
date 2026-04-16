// eslint-disable-next-line @typescript-eslint/no-require-imports
import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ethers is injected by @nomicfoundation/hardhat-ethers at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ethers = (hre as any).ethers;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

  // 1. Deploy RoleManager
  const RoleManager = await ethers.getContractFactory("RoleManager");
  const roleManager = await RoleManager.deploy();
  await roleManager.waitForDeployment();
  const roleManagerAddress = await roleManager.getAddress();
  console.log("RoleManager deployed to:", roleManagerAddress);

  // 2. Deploy HalalRegistry
  const HalalRegistry = await ethers.getContractFactory("HalalRegistry");
  const halalRegistry = await HalalRegistry.deploy(roleManagerAddress);
  await halalRegistry.waitForDeployment();
  const halalRegistryAddress = await halalRegistry.getAddress();
  console.log("HalalRegistry deployed to:", halalRegistryAddress);

  // 3. Deploy SupplyChainTracker
  const SupplyChainTracker = await ethers.getContractFactory("SupplyChainTracker");
  const supplyChainTracker = await SupplyChainTracker.deploy(roleManagerAddress);
  await supplyChainTracker.waitForDeployment();
  const supplyChainTrackerAddress = await supplyChainTracker.getAddress();
  console.log("SupplyChainTracker deployed to:", supplyChainTrackerAddress);

  // 4. Persist addresses + ABIs so the web app can load them
  const deployment = {
    network: "localhost",
    chainId: 1337,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      RoleManager: {
        address: roleManagerAddress,
        abi: (await ethers.getContractFactory("RoleManager")).interface.formatJson(),
      },
      HalalRegistry: {
        address: halalRegistryAddress,
        abi: (await ethers.getContractFactory("HalalRegistry")).interface.formatJson(),
      },
      SupplyChainTracker: {
        address: supplyChainTrackerAddress,
        abi: (await ethers.getContractFactory("SupplyChainTracker")).interface.formatJson(),
      },
    },
  };

  const outDir = path.join(__dirname, "../deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "localhost.json"),
    JSON.stringify(deployment, null, 2)
  );

  // Also write to server and client config locations
  const serverConfigDir = path.join(__dirname, "../../server/src/config");
  const clientConfigDir = path.join(__dirname, "../../client/src/config");

  [serverConfigDir, clientConfigDir].forEach((dir) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "contracts.json"),
      JSON.stringify(deployment, null, 2)
    );
    console.log("Contract config written to:", dir);
  });

  console.log("\nDeployment complete!");
  console.log("  RoleManager:        ", roleManagerAddress);
  console.log("  HalalRegistry:      ", halalRegistryAddress);
  console.log("  SupplyChainTracker: ", supplyChainTrackerAddress);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
