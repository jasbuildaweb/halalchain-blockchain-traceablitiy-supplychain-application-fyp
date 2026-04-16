/**
 * PostgreSQL seed script — creates demo user accounts to match the Hardhat seed.
 * Run: cd server && npm run db:seed
 *
 * Hardhat test account private keys (for dev only):
 *   #0 Admin:        0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
 *   #1 Supplier:     0x70997970C51812dc3A010C7d01b50e0d17dc79C8
 *   #2 Manufacturer: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
 *   #3 Logistics:    0x90F79bf6EB2c4f870365E785982E1f101E93b906
 *   #4 Retailer:     0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
 */

import "dotenv/config";
import prisma from "./prisma";
import bcrypt from "bcryptjs";

async function seed() {
  const accounts = [
    { name: "Admin User",         email: "admin@halalchain.com",        role: "ADMIN"        as const, company: "HalalChain Authority",     wallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" },
    { name: "Ahmad Supplier",     email: "supplier@halalchain.com",     role: "SUPPLIER"     as const, company: "Kelantan Agro Farms",       wallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" },
    { name: "Siti Manufacturer",  email: "manufacturer@halalchain.com", role: "MANUFACTURER" as const, company: "KL Food Manufacturing Sdn Bhd", wallet: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" },
    { name: "Ravi Logistics",     email: "logistics@halalchain.com",    role: "LOGISTICS"    as const, company: "Express Freight Malaysia",   wallet: "0x90F79bf6EB2c4f870365E785982E1f101E93b906" },
    { name: "Mei Retailer",       email: "retailer@halalchain.com",     role: "RETAILER"     as const, company: "Aeon Shah Alam",             wallet: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65" },
  ];

  const password = await bcrypt.hash("password123", 12);

  for (const account of accounts) {
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {},
      create: {
        name:          account.name,
        email:         account.email,
        password,
        role:          account.role,
        company:       account.company,
        walletAddress: account.wallet,
        isApproved:    true,
      },
    });
    console.log(`✓ ${user.role}: ${user.email} (${user.name})`);
  }

  console.log("\nSeed complete. Login credentials:");
  accounts.forEach(a => console.log(`  ${a.role.padEnd(14)} ${a.email}  /  password123`));
  await prisma.$disconnect();
}

seed().catch((err) => { console.error(err); process.exit(1); });
