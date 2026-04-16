import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";

import authRoutes from "./routes/auth";
import productRoutes from "./routes/products";
import eventRoutes from "./routes/events";
import certificateRoutes from "./routes/certificates";
import userRoutes from "./routes/users";
import verifyRoutes from "./routes/verify";
import rawMaterialRoutes from "./routes/rawMaterials";

const app = express();
const PORT = process.env.PORT ?? 5000;
const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:3000";

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (QR codes, cert documents)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth",          authRoutes);
app.use("/api/products",      productRoutes);
app.use("/api/events",        eventRoutes);
app.use("/api/certificates",  certificateRoutes);
app.use("/api/users",         userRoutes);
app.use("/api/verify",        verifyRoutes);
app.use("/api/raw-materials", rawMaterialRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "HalalChain API running", timestamp: new Date().toISOString() });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`HalalChain API running on http://localhost:${PORT}`);
});

export default app;
