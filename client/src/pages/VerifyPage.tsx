import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ArrowLeft, Package, Calendar, Building2, FileText, AlertTriangle } from "lucide-react";
import api from "../lib/api";
import { VerifyResponse } from "../types";
import HalalBadge from "../components/HalalBadge";
import SupplyChainTimeline from "../components/SupplyChainTimeline";

export default function VerifyPage() {
  const { productId } = useParams<{ productId: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["verify", productId],
    queryFn: async () => {
      const res = await api.get(`/verify/${productId}`);
      return res.data.data as VerifyResponse;
    },
    enabled: !!productId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p>Verifying on blockchain…</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="card text-center max-w-sm w-full">
          <AlertTriangle size={40} className="mx-auto text-amber-500 mb-3" />
          <h2 className="font-bold text-gray-900 mb-1">Product Not Found</h2>
          <p className="text-sm text-gray-500 mb-4">This QR code does not match any registered product.</p>
          <Link to="/scan" className="btn-primary">← Scan Another</Link>
        </div>
      </div>
    );
  }

  const { product, halal, certificate, supplyChain, rawMaterials } = data;
  const halalStatus = halal.isHalalCertified
    ? (certificate?.certExpired ? "EXPIRED" : "CERTIFIED")
    : (!certificate ? "PENDING" : (certificate.isValid ? "CERTIFIED" : "REVOKED"));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between max-w-2xl mx-auto">
        <Link to="/scan" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm">
          <ArrowLeft size={16} />
          Scan another
        </Link>
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-green-700" size={20} />
          <span className="font-semibold text-gray-900 text-sm">HalalChain</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Halal Badge */}
        <HalalBadge
          status={halalStatus}
          isOnChainVerified={halal.onChainVerified}
          size="lg"
        />

        {/* Product Info */}
        <div className="card">
          <div className="flex items-start gap-4">
            <Package size={40} className="text-gray-300 shrink-0" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">{product.name}</h1>
              {product.category && <p className="text-sm text-gray-500">{product.category}</p>}
              {product.description && <p className="text-sm text-gray-600 mt-1">{product.description}</p>}
              <p className="text-xs text-gray-400 mt-2">
                By <strong>{product.manufacturer.company ?? product.manufacturer.name}</strong> ·
                Registered {new Date(product.registeredAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {product.ingredients.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ingredients</p>
              <div className="flex flex-wrap gap-1.5">
                {product.ingredients.map((ing) => (
                  <span key={ing} className="badge-gray">{ing}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Certificate */}
        {certificate && (
          <div className={`card border-2 ${
            certificate.isValid && !certificate.certExpired
              ? "border-green-200 bg-green-50"
              : "border-amber-200 bg-amber-50"
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <FileText size={20} className="text-green-700" />
              <h2 className="font-semibold text-gray-900">Halal Certificate</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500 text-xs">Issuing Body</p>
                <p className="font-semibold">{certificate.issuingBody}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Status</p>
                <span className={certificate.isValid && !certificate.certExpired ? "badge-green" : "badge-amber"}>
                  {certificate.isValid && !certificate.certExpired ? "Valid" : certificate.certExpired ? "Expired" : "Revoked"}
                </span>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Issued</p>
                <p>{new Date(certificate.issuedAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Expires</p>
                <p className={certificate.certExpired ? "text-red-600 font-semibold" : ""}>
                  {new Date(certificate.expiresAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            {certificate.txHash && (
              <p className="mt-3 text-xs text-gray-400 font-mono break-all">
                TX: {certificate.txHash}
              </p>
            )}
          </div>
        )}

        {!certificate && (
          <div className="card border-2 border-amber-200 bg-amber-50 text-center py-6">
            <AlertTriangle size={28} className="mx-auto text-amber-500 mb-2" />
            <p className="font-semibold text-amber-800">No Halal Certificate Issued</p>
            <p className="text-sm text-amber-700 mt-1">This product has not yet been certified.</p>
          </div>
        )}

        {/* Raw Materials */}
        {rawMaterials.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={20} className="text-gray-500" />
              <h2 className="font-semibold text-gray-900">Raw Materials</h2>
            </div>
            <div className="space-y-2">
              {rawMaterials.map((mat, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{mat.name}</p>
                    <p className="text-xs text-gray-500">{mat.supplier.company ?? mat.supplier.name} {mat.origin && `· ${mat.origin}`}</p>
                  </div>
                  <span className={mat.halalStatus === "CERTIFIED" ? "badge-green" : mat.halalStatus === "PENDING" ? "badge-amber" : "badge-red"}>
                    {mat.halalStatus}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Supply Chain Timeline */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={20} className="text-gray-500" />
            <h2 className="font-semibold text-gray-900">Supply Chain Journey</h2>
            <span className="badge-blue ml-auto">{supplyChain.events.length} events</span>
          </div>
          <SupplyChainTimeline
            events={supplyChain.events}
            chainIntegrity={supplyChain.chainIntegrity}
            onChainEventCount={supplyChain.onChainEventCount}
          />
        </div>

        {/* Footer */}
        <div className="text-center pb-4">
          <p className="text-xs text-gray-400">
            Product ID: <span className="font-mono">{product.productId.slice(0, 16)}…</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">Powered by HalalChain · Ethereum Blockchain</p>
        </div>
      </div>
    </div>
  );
}
