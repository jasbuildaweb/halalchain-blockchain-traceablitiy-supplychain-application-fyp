import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, XCircle } from "lucide-react";

interface QRScannerProps {
  onResult: (text: string) => void;
  onError?: (err: string) => void;
}

export default function QRScanner({ onResult, onError }: QRScannerProps) {
  const divId    = "qr-reader";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const startScanner = async () => {
    setError(null);
    try {
      const scanner = new Html5Qrcode(divId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          stopScanner();
          onResult(decodedText);
        },
        undefined
      );
      setScanning(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera access denied";
      setError(msg);
      onError?.(msg);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch { /* already stopped */ }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  // Clean up on unmount
  useEffect(() => () => { stopScanner(); }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        id={divId}
        className="w-full max-w-sm rounded-2xl overflow-hidden border-2 border-dashed border-green-400 bg-gray-100 min-h-[300px] flex items-center justify-center"
      >
        {!scanning && (
          <div className="text-center text-gray-400">
            <Camera size={48} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Camera preview will appear here</p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg border border-red-200">
          <XCircle size={16} />
          {error}
        </div>
      )}

      {!scanning ? (
        <button onClick={startScanner} className="btn-primary w-full max-w-sm">
          <Camera size={18} />
          Start Camera
        </button>
      ) : (
        <button onClick={stopScanner} className="btn-danger w-full max-w-sm">
          <XCircle size={18} />
          Stop Scanner
        </button>
      )}
    </div>
  );
}
