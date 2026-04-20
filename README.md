# HalalChain

A blockchain-backed halal supply chain verification system. Every product registers on an immutable on-chain ledger, and consumers can scan a QR code to verify halal status and the full supply chain journey — with tamper detection built in.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Architecture Overview](#architecture-overview)
3. [Prerequisites](#prerequisites)
4. [Setup & Running](#setup--running)
5. [How The System Works](#how-the-system-works)
   - [Blockchain Layer](#blockchain-layer)
   - [Server Layer](#server-layer)
   - [Client Layer](#client-layer)
   - [End-to-End Request Flow](#end-to-end-request-flow)
6. [API Reference](#api-reference)
7. [Smart Contracts Reference](#smart-contracts-reference)
8. [Database Schema](#database-schema)
9. [RBAC — Role Permissions](#rbac--role-permissions)
10. [Testing](#testing)
11. [Project Structure](#project-structure)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | Solidity 0.8.24, Hardhat, ethers.js v6 |
| Backend | Node.js, Express, TypeScript, Prisma ORM |
| Database | PostgreSQL |
| Frontend | React 18, Vite, Tailwind CSS, Axios |
| Auth | JWT (jsonwebtoken), bcrypt |
| Testing | Hardhat (Mocha/Chai), Jest, ts-jest |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  React Client  (port 3000)                                  │
│  Vite proxies /api/* → Express                              │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP (Axios + JWT)
┌────────────────────────▼────────────────────────────────────┐
│  Express API  (port 5000)                                   │
│  JWT Auth → RBAC → Route Handler                            │
│       │                          │                          │
│       ▼                          ▼                          │
│  PostgreSQL (Prisma)     Hardhat Node (port 8545)           │
│  Fast queries             Immutable truth                   │
│  Easy to query            Cannot be tampered                │
└─────────────────────────────────────────────────────────────┘
```

### The Dual-Storage Pattern

Every write goes to **both** databases simultaneously:

- **PostgreSQL** stores full records for fast UI queries, search, and joins
- **The blockchain** stores product IDs, certificate hashes, and the supply chain event log as permanent, tamper-proof entries
- `txHash` and `blockNumber` on every Prisma model are mirrors of what was written on-chain
- The `/api/verify` endpoint cross-checks PostgreSQL event counts against the blockchain event count (`chainIntegrity` flag). If someone tampers with the database, the mismatch is immediately visible to consumers.

---

## Prerequisites

- Node.js 18 or 20 LTS
- PostgreSQL (running locally)
- Git

---

## Quick Start with Docker (Recommended)

Run the entire stack — PostgreSQL, Hardhat blockchain, Express API, and React client — with a single command. No separate terminals needed.

**Requires:** [Docker Desktop](https://www.docker.com/products/docker-desktop/)

```bash
docker compose up --build
```

Open `http://localhost:3000` once all containers are healthy (about 2–3 minutes on first run for contract compilation).

**What happens automatically:**
1. PostgreSQL starts and creates the `halal_chain` database
2. Hardhat node starts, compiles contracts, deploys them, seeds demo on-chain data
3. Express server runs migrations, seeds demo accounts, starts on port 5000
4. React app is built and served via nginx on port 3000

```bash
# Stop everything and remove containers
docker compose down

# Stop and also delete the database + blockchain data (full reset)
docker compose down -v

# Rebuild images after code changes
docker compose up --build
```

---

## Manual Setup & Running

```bash
npm install
```

All dependencies for all three workspaces (`blockchain`, `server`, `client`) install to the root `node_modules`.

### 2. Configure environment

`server/.env` is committed with development values. Key variables:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/halal_chain
JWT_SECRET=your-secret-key
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
RPC_URL=http://127.0.0.1:8545
PORT=5000
CLIENT_URL=http://localhost:3000
```

`DEPLOYER_PRIVATE_KEY` is Hardhat test account #0 — not a real wallet key.

### 3. Set up the database

```bash
npm run db:migrate   # creates the halal_chain database and all tables
npm run db:seed      # seeds 5 demo accounts (password: password123)
```

Demo accounts seeded:

| Email | Password | Role |
|---|---|---|
| admin@halalchain.com | password123 | ADMIN |
| supplier@halalchain.com | password123 | SUPPLIER |
| manufacturer@halalchain.com | password123 | MANUFACTURER |
| logistics@halalchain.com | password123 | LOGISTICS |
| retailer@halalchain.com | password123 | RETAILER |

### 4. Start all services (4 terminals)

```bash
# Terminal 1 — local blockchain node
npm run chain

# Terminal 2 — deploy contracts (run once per node restart)
npm run chain:deploy

# Terminal 3 — Express API
npm run dev:server

# Terminal 4 — React dev server
npm run dev:client
```

Open `http://localhost:3000`.

### Optional: seed on-chain demo data

```bash
npm run chain:seed
```

### Useful commands

```bash
npm run db:migrate            # apply schema changes to the database
cd server && npx prisma studio  # open GUI to browse the database
cd blockchain && npx hardhat compile  # recompile contracts after Solidity changes
npm run chain:deploy          # re-deploy after changing Solidity contracts
```

---

## How The System Works

### Blockchain Layer

The blockchain is a local Hardhat node simulating an Ethereum network. Three Solidity contracts are deployed to it.

#### `RoleManager.sol`

The gatekeeper for the entire on-chain system. It maps Ethereum wallet addresses to roles.

```
deployer wallet → ADMIN       (set automatically in constructor)
wallet A        → SUPPLIER    (owner calls assignRole)
wallet B        → MANUFACTURER
```

- Only the **contract owner** (the deployer wallet) can assign or revoke roles.
- Both `HalalRegistry` and `SupplyChainTracker` import this contract and check it before allowing any write.
- A wallet with `NONE` role is rejected by every other contract.

#### `HalalRegistry.sol`

Stores two things permanently: **products** and **halal certificates**.

- `registerProduct(productId, name)` — only `MANUFACTURER` or `ADMIN` wallets. Records the product's bytes32 ID on-chain forever.
- `issueCertificate(productId, certId, issuingBody, expiresAt)` — only `ADMIN`. Links a certificate to a product and marks it halal-certified.
- `isHalalCertified(productId)` — a public view function. Returns `true` only when all three conditions pass simultaneously:
  1. Product exists on-chain
  2. Certificate `isValid = true` (not revoked)
  3. `certificate.expiresAt > block.timestamp` (not expired)

  Certificates expire **automatically** based on the stored timestamp — no admin action needed.
- `revokeCertificate(certId)` — only `ADMIN`. Sets `isValid = false`. The next call to `isHalalCertified` returns `false` immediately.

#### `SupplyChainTracker.sol`

An **append-only event log**. Like a flight black box — entries can only be added, never deleted or modified.

- `recordEvent(productId, eventType, location, notes)` — first checks the caller's role via `RoleManager`, then appends a `ChainEvent` struct to `_history[productId]`.
- Role-to-event-type enforcement is hardcoded in `_checkPermission()`:

  | Role | Permitted Event Types |
  |---|---|
  | SUPPLIER | RAW_MATERIAL_ADDED |
  | MANUFACTURER | MANUFACTURING_STARTED, MANUFACTURING_COMPLETE, QUALITY_CHECK_PASSED |
  | LOGISTICS | SHIPPED, IN_TRANSIT, RECEIVED_AT_WAREHOUSE |
  | RETAILER | DELIVERED_TO_RETAILER, AVAILABLE_FOR_SALE |
  | ADMIN | Any |

  If the wrong role attempts the wrong event type → Solidity reverts with `RoleNotPermittedForEventType`. The transaction is rejected and nothing is written.

- `getProductHistory(productId)` — returns the full ordered array of events.
- `getEventCount(productId)` — returns the number of events. Used by the verify endpoint for tamper detection.

#### `blockchain/scripts/deploy.ts`

One-time setup script (`npm run chain:deploy`). It:

1. Deploys `RoleManager` first (no dependencies).
2. Deploys `HalalRegistry(roleManagerAddress)` — passes RoleManager's address so it can call `hasRole()`.
3. Deploys `SupplyChainTracker(roleManagerAddress)` — same reason.
4. Writes contract addresses and ABIs to three locations:
   - `blockchain/deployments/localhost.json`
   - `server/src/config/contracts.json`
   - `client/src/config/contracts.json`

If `localhost.json` is missing, the Express server **crashes on startup**. This file must exist before starting the server. Re-running deploy after a node restart regenerates it with new addresses.

---

### Server Layer

#### `lib/blockchain.ts` — The Blockchain Connector

Bridges Express to the Hardhat node. On first use it:

1. Reads `localhost.json` to get contract addresses and ABIs.
2. Creates an `ethers.JsonRpcProvider` pointing to `http://127.0.0.1:8545`.
3. Creates an `ethers.Wallet` from `DEPLOYER_PRIVATE_KEY` — this wallet signs all on-chain write transactions.
4. Returns singleton `ethers.Contract` instances for each contract (created once, reused for every request).

```ts
// How a route calls the blockchain
const registry = getHalalRegistryContract();
const tx      = await registry.registerProduct(productId, name);
const receipt = await tx.wait();  // waits for block confirmation
// receipt.hash → the txHash stored in PostgreSQL as proof
```

#### `prisma/schema.prisma` — Database Models

Defines all PostgreSQL tables. Key design decisions:

- **`User`** — `role` defaults to `CONSUMER`, `isApproved` defaults to `false`. Admin must approve before the user can log in.
- **`Product`** — has both `id` (PostgreSQL CUID for internal joins) and `productId` (bytes32 hex — the shared key between DB and blockchain). These two IDs serve different purposes.
- **`Certificate`** — stores `txHash` and `blockNumber` as proof of which blockchain transaction issued it. Anyone can independently verify the certificate on the blockchain using this hash.
- **`SupplyChainEvent`** — each row has `eventId` (the bytes32 hash emitted by the on-chain `SupplyChainEventRecorded` event). This creates a 1:1 verifiable link between a DB row and a specific on-chain entry.
- **`RawMaterial`** — connected to products via `ProductRawMaterial` (many-to-many junction table), since one product can use multiple raw materials and one raw material can appear in multiple products.

#### `middleware/auth.ts` — JWT Authentication

Every protected API request passes through here first.

```
Request arrives
    │
    ├─ Authorization: Bearer <token>?
    │       No  → 401 "No token provided"
    │       Yes → jwt.verify(token, JWT_SECRET)
    │                   Fail → 401 "Invalid or expired token"
    │                   Pass → attach decoded payload to req.user → next()
    │
    └─ req.user = { userId, email, role, walletAddress }
```

Every downstream route reads `req.user.role` to know who is calling — without an extra database query.

`optionalAuth` is a softer version that never rejects. Used on public routes where knowing the caller's identity is useful but not required.

#### `lib/rbac.ts` — Permission Matrix

Defines what each role is allowed to do. The `can(role, permission)` function is a simple lookup — no database call, no async work.

`requireRole("MANUFACTURER", "ADMIN")` is Express middleware that wraps a route and returns 403 if the caller's role is not in the allowed list.

#### Routes

**`routes/auth.ts`**
- `POST /api/auth/register` — validates input, bcrypt-hashes password, creates a `User` row.
- `POST /api/auth/login` — checks password with `bcrypt.compare`, verifies `isApproved`, returns a signed JWT.
- `GET /api/auth/me` — decodes the JWT and returns fresh user data from the database.

**`routes/products.ts`** — The dual-write pattern in action:

```
POST /api/products
  1. productId = keccak256(uuid + name)         ← unique bytes32 on-chain key
  2. registry.registerProduct(productId, name)  ← write to blockchain
  3. await tx.wait()                            ← wait for block confirmation
  4. prisma.product.create({ productId, txHash })  ← write to PostgreSQL
  5. generateQRCode(productId, baseUrl)         ← save QR image file
  6. Return product with txHash as proof
```

The `txHash` stored in PostgreSQL is the blockchain transaction hash — anyone can look it up to independently verify the product was registered on-chain.

**`routes/events.ts`** — Same dual-write for supply chain events:

```
POST /api/events
  1. Validate: user role is allowed for this eventType (server-side RBAC check)
  2. tracker.recordEvent(productId, eventTypeIndex, location, notes)  ← on-chain
  3. Parse receipt logs → extract onChainEventId (bytes32 hash from event)
  4. prisma.supplyChainEvent.create({ eventId, txHash })               ← DB
  5. Return event with txHash
```

The `eventId` stored in the DB is the exact bytes32 hash emitted on-chain — a 1:1 verifiable link between the DB row and the blockchain entry.

**`routes/certificates.ts`**

| Method | Path | Role | What it does |
|---|---|---|---|
| POST | `/api/certificates` | ADMIN | Issues certificate on-chain + DB, sets product `halalStatus: CERTIFIED` |
| GET | `/api/certificates` | Any | Lists certificates, filterable by productId |
| GET | `/api/certificates/:id` | Public | Returns a single certificate |
| DELETE | `/api/certificates/:id` | ADMIN | Revokes on-chain + sets `isValid: false` in DB, sets product `halalStatus: REVOKED` |

**`routes/rawMaterials.ts`**

| Method | Path | Role | What it does |
|---|---|---|---|
| GET | `/api/raw-materials` | Any | SUPPLIER sees own materials; others see all |
| POST | `/api/raw-materials` | SUPPLIER, ADMIN | Creates a raw material record in DB only |
| PATCH | `/api/raw-materials/:id` | ADMIN | Updates `halalStatus` or `certRef` |

**`routes/verify.ts`** — Consumer-facing, no authentication required:

```
GET /api/verify/:productId
  1. Load full product from PostgreSQL (events, certificate, raw materials, manufacturer)
  2. Call registry.isHalalCertified(productId)   → boolean (authoritative, on-chain)
  3. Call tracker.getEventCount(productId)        → number  (authoritative, on-chain)
  4. Compare counts:
       DB count == on-chain count  → chainIntegrity: "verified"
       DB count != on-chain count  → chainIntegrity: "mismatch"  ← tamper detected
  5. Return all data to the frontend
```

`chainIntegrity` is the system's core security guarantee. If someone hacks PostgreSQL and adds or deletes event rows, the blockchain count will not match — and the mismatch is surfaced on the consumer-facing verify page.

---

### Client Layer

#### `lib/api.ts` — Axios Instance

A single configured axios instance used by every component. Two interceptors:

- **Request interceptor** — reads `halalchain_token` from `localStorage` and adds `Authorization: Bearer <token>` to every outgoing request automatically. No component manually attaches the token.
- **Response interceptor** — if any response returns 401, automatically clears localStorage and redirects to `/login`.

#### `context/AuthContext.tsx` — Global Authentication State

A React Context that wraps the entire app. On first load it:

1. Reads `halalchain_token` and `halalchain_user` from `localStorage`.
2. If found, calls `GET /api/auth/me` to re-validate the token with the server (handles tokens that expired while the tab was closed).
3. Exposes `{ user, token, login(), logout(), isLoading }` to every component via `useAuth()`.

`login(token, user)` saves to both state and localStorage. `logout()` clears both.

#### `App.tsx` — Routing and Access Control

**`ProtectedRoute`** wraps any route that requires login:
- `user` is null → redirect to `/login`
- `roles` specified and user's role not in list → redirect to `/dashboard`

**`DashboardRedirect`** reads the logged-in user's role and routes them to their specific dashboard:

```
ADMIN        → /dashboard/admin
SUPPLIER     → /dashboard/supplier
MANUFACTURER → /dashboard/manufacturer
LOGISTICS    → /dashboard/logistics
RETAILER     → /dashboard/retailer
CONSUMER     → /scan
```

Full route tree:

```
/                  LandingPage            (public)
/login             LoginPage              (public)
/register          RegisterPage           (public)
/scan              ScanPage               (public — QR camera)
/verify/:productId VerifyPage             (public — halal result)
/dashboard
  /admin           AdminDashboard         (ADMIN only)
  /supplier        SupplierDashboard      (SUPPLIER only)
  /manufacturer    ManufacturerDashboard  (MANUFACTURER only)
  /logistics       LogisticsDashboard     (LOGISTICS only)
  /retailer        RetailerDashboard      (RETAILER only)
```

---

### End-to-End Request Flow

#### A manufacturer registering a product

```
1.  User fills form in ManufacturerDashboard
2.  axios.post("/api/products", { name: "Halal Beef" })
3.  api.ts interceptor adds   →  Authorization: Bearer eyJhbG...
4.  Vite proxy forwards       →  http://localhost:5000/api/products
5.  authenticate middleware   →  decodes JWT, sets req.user = { role: "MANUFACTURER" }
6.  requireRole check         →  "MANUFACTURER" is allowed ✔
7.  Route handler:
        a. productId = keccak256("uuid-Halal Beef")
        b. registry.registerProduct(productId, "Halal Beef")  → blockchain tx
        c. prisma.product.create({ productId, txHash })       → PostgreSQL row
        d. generateQRCode(productId)                          → QR image saved
8.  Response: { success: true, data: { productId, txHash, blockNumber } }
9.  UI shows product with its txHash as blockchain proof
```

#### An admin issuing a halal certificate

```
1.  Admin fills certificate form in AdminDashboard
2.  axios.post("/api/certificates", { productId, issuingBody: "JAKIM", expiresAt })
3.  authenticate + requireRole("ADMIN") → passes ✔
4.  Route handler:
        a. certificateId = keccak256("cert-uuid-productId")
        b. registry.issueCertificate(productId, certId, "JAKIM", unixTimestamp) → blockchain
        c. prisma.certificate.create({ certificateId, txHash })   → PostgreSQL
        d. prisma.product.update({ halalStatus: "CERTIFIED" })    → PostgreSQL
5.  Consumer scanning the product's QR now sees the green halal badge
```

#### A consumer scanning a QR code

```
1.  Phone camera reads QR → opens http://localhost:3000/verify/0xABCD...
2.  VerifyPage calls       → GET /api/verify/0xABCD... (no token needed)
3.  Server queries PostgreSQL → product, events, certificate, raw materials
4.  Server queries blockchain → isHalalCertified() + getEventCount()
5.  Compares event counts     → chainIntegrity: "verified" or "mismatch"
6.  Returns all data to frontend
7.  VerifyPage renders:
        - Green halal badge  (certified + verified)
        - Supply chain timeline  (all events with timestamps)
        - Certificate details  (JAKIM, expiry date, txHash)
        - Raw materials list
        - Red warning if chainIntegrity: "mismatch"
```

---

## API Reference

All responses follow `{ success: boolean, data?: T, error?: string }`.

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | None | Create a new account |
| POST | `/api/auth/login` | None | Login, returns JWT token |
| GET | `/api/auth/me` | Bearer | Returns current user info |

### Products

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/products` | Bearer | Any | List products (MANUFACTURER sees own only) |
| POST | `/api/products` | Bearer | MANUFACTURER, ADMIN | Register product on-chain + DB |
| GET | `/api/products/:id` | Bearer | Any | Get single product with full details |
| PATCH | `/api/products/:id` | Bearer | MANUFACTURER, ADMIN | Update description / category |
| GET | `/api/products/:id/qr` | Bearer | Any | Get QR code image URL |

### Supply Chain Events

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/api/events` | Bearer | SUPPLIER, MANUFACTURER, LOGISTICS, RETAILER, ADMIN | Record event on-chain + DB |
| GET | `/api/events/:productId` | Bearer | Any | Full event log for a product |

### Certificates

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/api/certificates` | Bearer | ADMIN | Issue halal certificate on-chain + DB |
| GET | `/api/certificates` | Bearer | Any | List certificates |
| GET | `/api/certificates/:id` | None | Any | Get single certificate |
| DELETE | `/api/certificates/:id` | Bearer | ADMIN | Revoke certificate on-chain + DB |

### Raw Materials

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/raw-materials` | Bearer | Any | List raw materials |
| POST | `/api/raw-materials` | Bearer | SUPPLIER, ADMIN | Create a raw material |
| PATCH | `/api/raw-materials/:id` | Bearer | ADMIN | Update halal status |

### Verify (Public)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/verify/:productId` | None | Full halal verification data + chainIntegrity flag |

### Users

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/users` | Bearer | ADMIN | List all users |
| PATCH | `/api/users/:id/approve` | Bearer | ADMIN | Approve a pending user |
| PATCH | `/api/users/:id/role` | Bearer | ADMIN | Change a user's role |

---

## Smart Contracts Reference

### `RoleManager.sol`

| Function | Access | Description |
|---|---|---|
| `assignRole(address, Role)` | Owner only | Assign a role to a wallet |
| `revokeRole(address)` | Owner only | Remove a wallet's role (set to NONE) |
| `getRole(address)` | Public view | Returns the Role enum for an address |
| `hasRole(address, Role)` | Public view | True if address has the given role |
| `isAdmin(address)` | Public view | True if address has ADMIN role |

**Events:** `RoleAssigned(address indexed, Role)`, `RoleRevoked(address indexed)`

**Custom errors:** `NotOwner`, `ZeroAddress`

### `HalalRegistry.sol`

| Function | Access | Description |
|---|---|---|
| `registerProduct(bytes32, string)` | MANUFACTURER, ADMIN | Permanently registers a product |
| `issueCertificate(bytes32, bytes32, string, uint256)` | ADMIN | Issues a halal certificate |
| `revokeCertificate(bytes32)` | ADMIN | Revokes a certificate |
| `isHalalCertified(bytes32)` | Public view | True only if exists + valid + not expired |
| `getProduct(bytes32)` | Public view | Returns the full Product struct |
| `getCertificate(bytes32)` | Public view | Returns the full Certificate struct |
| `getProductCount()` | Public view | Total registered products |
| `getAllProductIds()` | Public view | Array of all product IDs |

**Events:** `ProductRegistered`, `CertificateIssued`, `CertificateRevoked`

**Custom errors:** `ProductAlreadyExists`, `ProductNotFound`, `CertificateNotFound`, `NotAuthorized`, `CertificateExpired`

### `SupplyChainTracker.sol`

| Function | Access | Description |
|---|---|---|
| `recordEvent(bytes32, EventType, string, string)` | Role-gated | Appends an event to a product's history |
| `getProductHistory(bytes32)` | Public view | Returns full ordered event array |
| `getEventCount(bytes32)` | Public view | Number of events recorded for a product |

**Events:** `SupplyChainEventRecorded(productId, eventId, eventType, actor, timestamp, location, notes)`

**Custom errors:** `NotAuthorized`, `RoleNotPermittedForEventType`

---

## Database Schema

```
users
  id             CUID (PK)
  email          unique
  password       bcrypt hash
  role           ADMIN | SUPPLIER | MANUFACTURER | LOGISTICS | RETAILER | CONSUMER
  isApproved     boolean  (default false — Admin must approve)
  walletAddress  optional, unique

products
  id             CUID (PK)
  productId      bytes32 hex  (unique) ← shared key with blockchain
  name, description, category, ingredients[]
  isHalalCertified  boolean
  halalStatus    PENDING | CERTIFIED | REJECTED | REVOKED | EXPIRED
  txHash         blockchain transaction hash for the registration tx
  blockNumber    block number when registered
  manufacturerId → users.id

certificates
  id             CUID (PK)
  certificateId  bytes32 hex  (unique) ← shared key with blockchain
  issuingBody    e.g. "JAKIM"
  expiresAt      DateTime
  isValid        boolean
  txHash         blockchain transaction hash for the issuance tx
  productId      → products.id  (one-to-one)
  issuedById     → users.id

supply_chain_events
  id             CUID (PK)
  eventId        bytes32 hex  (unique) ← matches on-chain event hash
  eventType      RAW_MATERIAL_ADDED | MANUFACTURING_STARTED | MANUFACTURING_COMPLETE
                 | QUALITY_CHECK_PASSED | SHIPPED | IN_TRANSIT | RECEIVED_AT_WAREHOUSE
                 | DELIVERED_TO_RETAILER | AVAILABLE_FOR_SALE
  location       string
  notes          optional
  txHash         blockchain transaction hash
  productId      → products.id
  actorId        → users.id

raw_materials
  id             CUID (PK)
  name, origin, halalStatus, certRef
  supplierId     → users.id

product_raw_materials  (many-to-many junction)
  productId      → products.id
  rawMaterialId  → raw_materials.id
  quantity, unit
```

---

## RBAC — Role Permissions

| Permission | ADMIN | SUPPLIER | MANUFACTURER | LOGISTICS | RETAILER | CONSUMER |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| products:read | ✔ | ✔ | ✔ | ✔ | ✔ | |
| products:write | ✔ | | ✔ | | | |
| events:write | ✔ | ✔ | ✔ | ✔ | ✔ | |
| certificates:read | ✔ | | | | | |
| certificates:write | ✔ | | | | | |
| users:read | ✔ | | | | | |
| users:write | ✔ | | | | | |
| raw-materials:read | ✔ | ✔ | ✔ | | | |
| raw-materials:write | ✔ | ✔ | | | | |
| verify:read | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

---

## Testing

### Blockchain Tests (Hardhat + Mocha/Chai)

Tests run against an in-memory Hardhat blockchain — no running node required.

```bash
npm run test --workspace=blockchain
```

**60 tests** across 3 files:

| File | What is tested |
|---|---|
| `blockchain/test/RoleManager.test.ts` | Deployment, role assignment, revocation, access control, events |
| `blockchain/test/HalalRegistry.test.ts` | Product registration, certification, revocation, certificate expiry |
| `blockchain/test/SupplyChainTracker.test.ts` | All 9 event types × all 5 roles, append-only guarantee, product isolation |

### Server Unit Tests (Jest + ts-jest)

Tests run with no database or blockchain — pure in-memory.

```bash
npm test --workspace=server
```

**21 tests** across 2 files:

| File | What is tested |
|---|---|
| `server/src/lib/rbac.test.ts` | Full permission matrix — every role × every permission |
| `server/src/middleware/auth.test.ts` | Valid token, no token, tampered token, wrong secret, expired token, `optionalAuth` |

---

## Project Structure

```
fyp/
├── package.json                   Root — npm workspaces config
│
├── blockchain/
│   ├── contracts/
│   │   ├── RoleManager.sol        On-chain RBAC (address → role mapping)
│   │   ├── HalalRegistry.sol      Product & certificate registry
│   │   └── SupplyChainTracker.sol Append-only supply chain event log
│   ├── scripts/
│   │   ├── deploy.ts              Deploys all 3 contracts, writes localhost.json
│   │   └── seed.ts                Seeds demo on-chain data
│   ├── test/
│   │   ├── RoleManager.test.ts
│   │   ├── HalalRegistry.test.ts
│   │   └── SupplyChainTracker.test.ts
│   ├── deployments/
│   │   └── localhost.json         Contract addresses + ABIs (written by deploy.ts)
│   └── hardhat.config.ts
│
├── server/
│   ├── prisma/
│   │   └── schema.prisma          PostgreSQL schema (all models + enums)
│   └── src/
│       ├── index.ts               Express app setup + route mounting
│       ├── middleware/
│       │   └── auth.ts            JWT authentication middleware
│       ├── lib/
│       │   ├── blockchain.ts      ethers.js connector (provider, signer, contracts)
│       │   ├── rbac.ts            Permission matrix + requireRole middleware
│       │   ├── prisma.ts          Prisma client singleton
│       │   └── qr.ts              QR code generation
│       ├── routes/
│       │   ├── auth.ts            Register, login, me
│       │   ├── products.ts        Product CRUD + on-chain registration
│       │   ├── events.ts          Supply chain event recording
│       │   ├── certificates.ts    Halal certificate issue/revoke
│       │   ├── rawMaterials.ts    Raw material management
│       │   ├── users.ts           User approval + role management
│       │   └── verify.ts          Public consumer verify endpoint
│       └── types/
│           └── index.ts           Shared TypeScript types
│
└── client/
    ├── src/
    │   ├── App.tsx                Routes + ProtectedRoute + DashboardRedirect
    │   ├── main.tsx               React root
    │   ├── context/
    │   │   └── AuthContext.tsx    Global auth state (user, token, login, logout)
    │   ├── lib/
    │   │   └── api.ts             Axios instance with JWT + 401 interceptors
    │   ├── components/
    │   │   ├── HalalBadge.tsx     Green/red halal status badge
    │   │   ├── QRScanner.tsx      Camera-based QR scanner
    │   │   ├── SupplyChainTimeline.tsx  Timeline of supply chain events
    │   │   └── layout/
    │   │       └── DashboardLayout.tsx  Shared sidebar + nav
    │   ├── pages/
    │   │   ├── LandingPage.tsx
    │   │   ├── LoginPage.tsx
    │   │   ├── RegisterPage.tsx
    │   │   ├── ScanPage.tsx       QR camera scan page
    │   │   ├── VerifyPage.tsx     Consumer halal verification result
    │   │   └── dashboard/
    │   │       ├── AdminDashboard.tsx
    │   │       ├── SupplierDashboard.tsx
    │   │       ├── ManufacturerDashboard.tsx
    │   │       ├── LogisticsDashboard.tsx
    │   │       └── RetailerDashboard.tsx
    │   └── types/
    │       └── index.ts
    └── vite.config.ts             Proxies /api/* → http://localhost:5000
```
