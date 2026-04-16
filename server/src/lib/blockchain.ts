import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

// ─── Load deployment config written by Hardhat deploy script ─────────────────
function loadDeployment() {
  const deploymentPath = path.join(
    __dirname,
    "../../../blockchain/deployments/localhost.json"
  );
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(
      "Deployment config not found. Run: cd blockchain && npm run deploy"
    );
  }
  return JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
}

// ─── Singleton provider + signer ─────────────────────────────────────────────
let _provider: ethers.JsonRpcProvider | null = null;
let _signer: ethers.Wallet | null = null;

export function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";
    _provider = new ethers.JsonRpcProvider(rpcUrl);
  }
  return _provider;
}

export function getSigner(): ethers.Wallet {
  if (!_signer) {
    const pk = process.env.DEPLOYER_PRIVATE_KEY;
    if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY not set in environment");
    _signer = new ethers.Wallet(pk, getProvider());
  }
  return _signer;
}

// ─── Contract instances ───────────────────────────────────────────────────────
let _deployment: ReturnType<typeof loadDeployment> | null = null;

function getDeployment() {
  if (!_deployment) _deployment = loadDeployment();
  return _deployment;
}

export function getRoleManagerContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  const d = getDeployment();
  const abi = JSON.parse(d.contracts.RoleManager.abi);
  return new ethers.Contract(
    d.contracts.RoleManager.address,
    abi,
    signerOrProvider ?? getSigner()
  );
}

export function getHalalRegistryContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  const d = getDeployment();
  const abi = JSON.parse(d.contracts.HalalRegistry.abi);
  return new ethers.Contract(
    d.contracts.HalalRegistry.address,
    abi,
    signerOrProvider ?? getSigner()
  );
}

export function getSupplyChainTrackerContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  const d = getDeployment();
  const abi = JSON.parse(d.contracts.SupplyChainTracker.abi);
  return new ethers.Contract(
    d.contracts.SupplyChainTracker.address,
    abi,
    signerOrProvider ?? getSigner()
  );
}

// ─── On-chain history helper ──────────────────────────────────────────────────

export interface OnChainEvent {
  eventId: string;
  productId: string;
  eventType: number;
  actor: string;
  timestamp: number;
  location: string;
  notes: string;
}

/**
 * Query the SupplyChainEventRecorded event log for a product.
 * Cross-checks against the struct array stored in the contract.
 */
export async function getOnChainHistory(productId: string): Promise<OnChainEvent[]> {
  const tracker = getSupplyChainTrackerContract(getProvider());
  const history: OnChainEvent[] = await tracker.getProductHistory(productId);
  return history.map((e) => ({
    eventId:   e.eventId,
    productId: e.productId,
    eventType: Number(e.eventType),
    actor:     e.actor,
    timestamp: Number(e.timestamp),
    location:  e.location,
    notes:     e.notes,
  }));
}

// ─── Contract addresses (for client config) ───────────────────────────────────
export function getContractAddresses() {
  const d = getDeployment();
  return {
    roleManager:       d.contracts.RoleManager.address,
    halalRegistry:     d.contracts.HalalRegistry.address,
    supplyChainTracker: d.contracts.SupplyChainTracker.address,
  };
}
