# HalalChain — Blockchain-Based Halal Supply Chain Traceability

FYP Prototype | Ethereum + React + Express + PostgreSQL

---

## Project Structure

```
fyp/
├── blockchain/          # Hardhat + Solidity smart contracts
│   ├── contracts/
│   │   ├── RoleManager.sol          # On-chain RBAC
│   │   ├── HalalRegistry.sol        # Product & certificate registry
│   │   └── SupplyChainTracker.sol   # Immutable audit log
│   ├── scripts/
│   │   ├── deploy.ts                # Deploy all contracts
│   │   └── seed.ts                  # Seed demo data on-chain
│   └── deployments/localhost.json   # Written by deploy.ts
│
├── server/              # Express + TypeScript REST API
│   ├── prisma/schema.prisma         # PostgreSQL schema
│   └── src/
│       ├── routes/      # auth, products, events, certificates, users, verify, rawMaterials
│       ├── lib/         # blockchain.ts, rbac.ts, qr.ts, prisma.ts, dbSeed.ts
│       └── middleware/  # auth.ts (JWT)
│
└── client/              # React (Vite) + Tailwind
    └── src/
        ├── pages/       # LandingPage, LoginPage, ScanPage, VerifyPage, dashboards/
        ├── components/  # HalalBadge, SupplyChainTimeline, QRScanner, DashboardLayout
        └── context/     # AuthContext (JWT + RBAC)
```

---

## Quick Start

### 1. Prerequisites
- Node.js 20+
- PostgreSQL running locally
- Git

### 2. Install all dependencies
```bash
npm install
```

### 3. Configure environment
```bash
cp server/.env.example server/.env
# Edit server/.env:
#   DATABASE_URL="postgresql://postgres:password@localhost:5432/halal_chain"
#   JWT_SECRET="your-32-char-secret"
```

### 4. Start Hardhat node (Terminal 1)
```bash
npm run chain
```

### 5. Deploy contracts (Terminal 2)
```bash
npm run chain:deploy
npm run chain:seed
```

### 6. Set up PostgreSQL (Terminal 2)
```bash
cd server
npm run db:migrate    # runs prisma migrate dev
npm run db:seed       # creates demo user accounts
```

### 7. Start the server (Terminal 3)
```bash
npm run dev:server    # runs on port 5000
```

### 8. Start the client (Terminal 4)
```bash
npm run dev:client    # runs on port 3000
```

---

## Demo Accounts (after db:seed)

| Role         | Email                        | Password    |
|--------------|------------------------------|-------------|
| Admin        | admin@halalchain.com         | password123 |
| Supplier     | supplier@halalchain.com      | password123 |
| Manufacturer | manufacturer@halalchain.com  | password123 |
| Logistics    | logistics@halalchain.com     | password123 |
| Retailer     | retailer@halalchain.com      | password123 |

---

## Key Demo Flow (for FYP examiners)

1. **Login as Manufacturer** → Register a new product → Get QR code
2. **Login as Admin** → Issue JAKIM halal certificate for the product
3. **Each role** logs supply chain events (Supplier → Manufacturer → Logistics → Retailer)
4. **Open `/scan`** → Scan the product QR (or enter product ID)
5. **Verify page** shows: ✅ HALAL CERTIFIED badge, certificate details, full timeline with blockchain TX hashes
6. **Admin revokes** the certificate → Refresh verify page → ❌ REVOKED badge

---

## Architecture

- **Blockchain**: Ethereum (Hardhat local node). Three Solidity contracts:
  - `RoleManager` — address → role mapping
  - `HalalRegistry` — product registration + certification state machine
  - `SupplyChainTracker` — append-only event log per product
- **Backend**: Express.js API with Prisma ORM (PostgreSQL). ethers.js v6 for blockchain writes.
- **Frontend**: React + Vite + Tailwind. `html5-qrcode` for camera scanning. `@tanstack/react-query` for data fetching.
- **RBAC**: Server-side via JWT + role middleware. Blockchain-side via `RoleManager.sol`.
- **QR Flow**: Product QR encodes `/verify/<productId>`. Verify page calls `/api/verify/:productId` which reads directly from the blockchain.
