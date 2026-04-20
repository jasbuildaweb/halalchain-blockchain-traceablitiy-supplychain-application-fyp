#!/bin/sh
set -e

cd /app/server

# ── 1. Apply database migrations ──────────────────────────────────────────────
# prisma migrate deploy applies all pending migrations without prompts.
# The postgres container is already healthy before this runs (depends_on).
echo "Running database migrations..."
npx prisma migrate deploy
echo "Migrations done."

# ── 2. Seed demo accounts ─────────────────────────────────────────────────────
# dbSeed uses upsert so it is safe to run on every container start.
echo "Seeding demo user accounts..."
npx tsx src/lib/dbSeed.ts
echo "Seed done."

# ── 3. Start the Express server ───────────────────────────────────────────────
echo "Starting HalalChain API on port 5000..."
exec npx tsx src/index.ts
