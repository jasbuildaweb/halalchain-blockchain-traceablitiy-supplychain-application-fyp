import QRCode from "qrcode";
import * as fs from "fs";
import * as path from "path";

const QR_DIR = path.join(process.cwd(), "uploads", "qr");

export async function generateQRCode(productId: string, baseUrl: string): Promise<string> {
  fs.mkdirSync(QR_DIR, { recursive: true });

  const verifyUrl = `${baseUrl}/verify/${productId}`;
  const fileName = `${productId}.png`;
  const filePath = path.join(QR_DIR, fileName);

  await QRCode.toFile(filePath, verifyUrl, {
    width: 400,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "H",
  });

  return `/uploads/qr/${fileName}`;
}

export async function getQRCodeDataUrl(productId: string, baseUrl: string): Promise<string> {
  const verifyUrl = `${baseUrl}/verify/${productId}`;
  return QRCode.toDataURL(verifyUrl, {
    width: 400,
    margin: 2,
    errorCorrectionLevel: "H",
  });
}
