import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ShieldCheck, QrCode, Search } from "lucide-react";
import QRScanner from "../components/QRScanner";
import toast from "react-hot-toast";

export default function ScanPage() {
  const navigate = useNavigate();
  const [manualId, setManualId] = useState("");

  const handleQRResult = (text: string) => {
    // QR encodes the verify URL: http://localhost:3000/verify/<productId>
    try {
      const url = new URL(text);
      const parts = url.pathname.split("/");
      const productId = parts[parts.length - 1];
      if (productId) {
        navigate(`/verify/${productId}`);
        return;
      }
    } catch {
      // Not a URL — treat as raw product ID
    }
    // Fallback: raw product ID
    if (text.startsWith("0x") || text.length > 10) {
      navigate(`/verify/${text}`);
    } else {
      toast.error("Invalid QR code. Please scan a HalalChain product QR.");
    }
  };

  const handleManualSearch = () => {
    if (!manualId.trim()) return;
    navigate(`/verify/${manualId.trim()}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <ShieldCheck className="text-green-700" size={22} />
          <span className="font-bold text-gray-900">HalalChain</span>
        </Link>
        <Link to="/login" className="text-sm text-green-700 font-medium hover:underline">
          Portal Login →
        </Link>
      </header>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-8 space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
            <QrCode size={14} />
            Halal Verification Scanner
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Scan Product QR Code</h1>
          <p className="text-sm text-gray-500 mt-2">
            Point your camera at the QR code on any HalalChain-registered product to verify its halal status.
          </p>
        </div>

        {/* QR Scanner */}
        <div className="card">
          <QRScanner onResult={handleQRResult} onError={(err) => toast.error(err)} />
        </div>

        {/* Manual search */}
        <div className="card">
          <p className="text-sm font-medium text-gray-700 mb-3">Or search by Product ID</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
              placeholder="Enter product ID (0x…)"
              className="input flex-1"
            />
            <button onClick={handleManualSearch} className="btn-primary px-4">
              <Search size={16} />
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400">
          This scanner works directly in your browser — no app download required.
        </p>
      </div>
    </div>
  );
}
