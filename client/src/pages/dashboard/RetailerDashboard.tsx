import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingBag, QrCode, RefreshCw, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../lib/api";
import { Product, EventType } from "../../types";

const RETAILER_EVENTS: EventType[] = ["DELIVERED_TO_RETAILER", "AVAILABLE_FOR_SALE"];

export default function RetailerDashboard() {
  const qc = useQueryClient();
  const [eventForm, setEventForm] = useState({ productId: "", eventType: "" as EventType, location: "", notes: "" });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get("/products").then(r => r.data.data as Product[]),
  });

  const recordEvent = useMutation({
    mutationFn: () => api.post("/events", eventForm),
    onSuccess: () => {
      toast.success("Retail event recorded on blockchain!");
      qc.invalidateQueries({ queryKey: ["products"] });
      setEventForm({ productId: "", eventType: "" as EventType, location: "", notes: "" });
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Retailer Dashboard</h1>

      {/* Record event */}
      <div className="card mb-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><ShoppingBag size={18} className="text-teal-600" />Record Retail Event</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Product</label>
            <select className="input" value={eventForm.productId} onChange={e => setEventForm(f => ({ ...f, productId: e.target.value }))}>
              <option value="">Select product…</option>
              {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Event Type</label>
            <select className="input" value={eventForm.eventType} onChange={e => setEventForm(f => ({ ...f, eventType: e.target.value as EventType }))}>
              <option value="">Select…</option>
              {RETAILER_EVENTS.map(et => <option key={et} value={et}>{et.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div><label className="label">Store Location *</label><input className="input" value={eventForm.location} onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Aeon Shah Alam, Malaysia" /></div>
          <div><label className="label">Notes</label><input className="input" value={eventForm.notes} onChange={e => setEventForm(f => ({ ...f, notes: e.target.value }))} /></div>
        </div>
        <button
          onClick={() => recordEvent.mutate()}
          disabled={recordEvent.isPending || !eventForm.productId || !eventForm.eventType || !eventForm.location}
          className="btn-primary mt-4"
        >
          {recordEvent.isPending ? <><RefreshCw size={14} className="animate-spin" /> Recording…</> : "Record on Blockchain"}
        </button>
      </div>

      {/* Inventory */}
      <div className="card">
        <h2 className="font-semibold mb-4">Inventory ({products?.length ?? 0} products)</h2>
        {products?.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No products in inventory.</p>}
        <div className="space-y-3">
          {products?.map(product => (
            <div key={product.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
              <div>
                <p className="font-medium text-sm">{product.name}</p>
                <p className="text-xs text-gray-400">{product.manufacturer.company ?? product.manufacturer.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={product.isHalalCertified ? "badge-green" : "badge-amber"}>{product.halalStatus}</span>
                {product.qrCodeUrl && (
                  <a href={product.qrCodeUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700">
                    <QrCode size={18} />
                  </a>
                )}
                <a href={`/verify/${product.productId}`} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-gray-600">
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
