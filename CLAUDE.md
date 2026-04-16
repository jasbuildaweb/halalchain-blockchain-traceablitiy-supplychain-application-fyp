# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the repo root (`/home/sonson/fyp`).

### Dev (requires 3 terminals)
```bash
npm run chain          # Terminal 1: start Hardhat local node on localhost:8545
npm run chain:deploy   # Terminal 2: deploy contracts (once per node restart)
npm run dev:server     # Terminal 3: Express API on port 5000 (tsx watch)
npm run dev:client     # Terminal 4: Vite dev server on port 3000
```

### Database
```bash
npm run db:migrate     # prisma migrate dev (creates/applies migrations)
npm run db:seed        # seed demo user accounts (password123 for all)
```

### Blockchain extras
```bash
npm run chain:seed     # seed demo on-chain data via Hardhat script
npm run chain:deploy   # re-deploy after changing Solidity contracts
```

### Client/server individually
```bash
cd blockchain && npx hardhat compile   # recompile contracts after changes
cd server && npx prisma studio         # GUI for the database
cd server && npx prisma migrate dev    # after schema.prisma changes
```

## Architecture

### Monorepo structure
```
fyp/
├── blockchain/   Hardhat + Solidity (no workspace node_modules — uses root)
├── server/       Express + TypeScript + Prisma
└── client/       React + Vite + Tailwind
```
npm workspaces — `node_modules/` lives at the root.

### Dual-storage pattern (critical to understand)
Every write goes to **both** PostgreSQL and the Hardhat blockchain:
- PostgreSQL (via Prisma) stores full records for fast queries
- The blockchain stores the canonical truth — product IDs, certificate hashes, event log
- `txHash` and `blockNumber` on Prisma models are mirrors of what was written on-chain
- The verify endpoint cross-checks PostgreSQL counts against on-chain event counts (`chainIntegrity` flag)

### Blockchain → server wiring
`server/src/lib/blockchain.ts` loads contract ABIs and addresses from `blockchain/deployments/localhost.json` (written by `deploy.ts`). If that file is missing, the server throws on startup. Contract instances are singletons. All blockchain writes use `DEPLOYER_PRIVATE_KEY` (Hardhat test account #0).

### Auth flow
JWT stored in `localStorage` under key `halalchain_token`. `client/src/lib/api.ts` attaches it as `Bearer` on every request. Server middleware in `server/src/middleware/auth.ts` decodes it. RBAC is enforced server-side via `server/src/lib/rbac.ts` — `requireRole(...roles)` middleware wraps routes. Frontend `ProtectedRoute` + `DashboardRedirect` in `App.tsx` handle client-side gating.

### New user approval
Registered users have `isApproved: false` by default. They cannot use their dashboard until Admin approves them via `PATCH /api/users/:id/approve`. Demo seeded accounts are pre-approved.

### Supply chain event types (ordered)
`RAW_MATERIAL_ADDED` → `MANUFACTURING_STARTED` → `MANUFACTURING_COMPLETE` → `QUALITY_CHECK_PASSED` → `SHIPPED` → `IN_TRANSIT` → `RECEIVED_AT_WAREHOUSE` → `DELIVERED_TO_RETAILER` → `AVAILABLE_FOR_SALE`

Each event is written to `SupplyChainTracker.sol` on-chain and mirrored in the `supply_chain_events` table.

### Verify page (consumer-facing, no auth)
`GET /api/verify/:productId` — reads from PostgreSQL then calls `getOnChainHistory()` to fetch the blockchain event log. Returns `{ product, halal, certificate, supplyChain, rawMaterials }`. The `VerifyPage` uses this to render the halal badge + timeline. QR codes encode the full URL `http://localhost:3000/verify/<productId>`.

### Client → API proxy
Vite proxies `/api/*` → `http://localhost:5000` in dev (`vite.config.ts`). All `axios` calls in client use baseURL `/api`. If the server isn't running, Vite throws `ECONNREFUSED` proxy errors.

### Adding a new route
1. Create `server/src/routes/foo.ts`, apply `authenticate` + `requireRole(...)` middleware
2. Mount in `server/src/index.ts`: `app.use("/api/foo", fooRoutes)`
3. Add permission to relevant roles in `server/src/lib/rbac.ts`

### Changing the Prisma schema
```bash
cd server && npx prisma migrate dev --name description_of_change
```
Prisma client is auto-generated into root `node_modules/@prisma/client`.

## Environment
`server/.env` is committed (dev-only credentials). Key values:
- `DATABASE_URL` — local PostgreSQL `halal_chain` database
- `DEPLOYER_PRIVATE_KEY` — Hardhat test account #0 (not a real key)
- `RPC_URL` — `http://127.0.0.1:8545` (Hardhat node)
- `PORT=5000`, `CLIENT_URL=http://localhost:3000`
