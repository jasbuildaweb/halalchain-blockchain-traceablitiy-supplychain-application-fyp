#!/bin/sh
set -e

cd /app/blockchain

# ── 1. Start Hardhat node in the background ───────────────────────────────────
# --hostname 0.0.0.0 makes it reachable from other Docker containers
echo "Starting Hardhat node..."
npx hardhat node --hostname 0.0.0.0 &
HARDHAT_PID=$!

# ── 2. Wait until the JSON-RPC endpoint is accepting requests ─────────────────
echo "Waiting for Hardhat node to be ready..."
until curl -sf -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  > /dev/null 2>&1; do
  sleep 2
done
echo "Hardhat node is up."

# ── 3. Deploy all three contracts ─────────────────────────────────────────────
# Writes localhost.json to /app/blockchain/deployments/
# (which is the shared Docker volume read by the server container)
echo "Deploying contracts..."
npx hardhat run scripts/deploy.ts --network localhost
echo "Contracts deployed."

# ── 4. Seed demo on-chain data ────────────────────────────────────────────────
echo "Seeding on-chain demo data..."
npx hardhat run scripts/seed.ts --network localhost
echo "On-chain seed complete."

# ── 5. Signal that deployment is finished ─────────────────────────────────────
# The Docker health check watches for this file.
# The server container won't start until this file exists.
touch /deployed
echo "Blockchain ready. Server container will now start."

# ── 6. Keep the node running ──────────────────────────────────────────────────
wait $HARDHAT_PID
