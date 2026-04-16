import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, QrCode, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../lib/api";
import { Product, EventType } from "../../types";
import SupplyChainTimeline from "../../components/SupplyChainTimeline";

const MFG_EVENTS: EventType[] = ["MANUFACTURING_STARTED", "MANUFACTURING_COMPLETE", "QUALITY_CHECK_PASSED"];

export default function ManufacturerDashboard() {
  const qc = useQueryClient();
  const [showNewForm, setShowNewForm] = useState(false);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [newProduct, setNewProduct]   = useState({ name: "", description: "", category: "", ingredients: "" });
  const [eventForm, setEventForm]     = useState({ productId: "", eventType: "" as EventType, location: "", notes: "" });

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get("/products").then(r => r.data.data as Product[]),
  });

  const registerProduct = useMutation({
    mutationFn: () => api.post("/products", {
      ...newProduct,
      ingredients: newProduct.ingredients.split(",").map(s => s.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      toast.success("Product registered on blockchain!");
      qc.invalidateQueries({ queryKey: ["products"] });
      setNewProduct({ name: "", description: "", category: "", ingredients: "" });
      setShowNewForm(false);
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"),
  });

  const recordEvent = useMutation({
    mutationFn: () => api.post("/events", eventForm),
    onSuccess: () => {
      toast.success("Event recorded on blockchain!");
      qc.invalidateQueries({ queryKey: ["products"] });
      setEventForm({ productId: "", eventType: "" as EventType, location: "", notes: "" });
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Manufacturer Dashboard</h1>
        <button onClick={() => setShowNewForm(v => !v)} className="btn-primary">
          <Plus size={16} />
          Register Product
        </button>
      </div>

      {/* New product form */}
      {showNewForm && (
        <div className="card mb-6 border-green-200 bg-green-50">
          <h2 className="font-semibold mb-4">Register New Product on Blockchain</h2>
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); registerProduct.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="label">Product Name *</label><input className="input" value={newProduct.name} onChange={e => setNewProduct(f => ({ ...f, name: e.target.value }))} required /></div>
              <div><label className="label">Category</label><input className="input" value={newProduct.category} onChange={e => setNewProduct(f => ({ ...f, category: e.target.value }))} /></div>
            </div>
            <div><label className="label">Description</label><textarea className="input" rows={2} value={newProduct.description} onChange={e => setNewProduct(f => ({ ...f, description: e.target.value }))} /></div>
            <div><label className="label">Ingredients (comma-separated)</label><input className="input" value={newProduct.ingredients} onChange={e => setNewProduct(f => ({ ...f, ingredients: e.target.value }))} placeholder="Chicken, Spices, Salt…" /></div>
            <div className="flex gap-3">
              <button type="submit" disabled={registerProduct.isPending || !newProduct.name} className="btn-primary">
                {registerProduct.isPending ? <><RefreshCw size={14} className="animate-spin" /> Registering…</> : "Register on Blockchain"}
              </button>
              <button type="button" onClick={() => setShowNewForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Record event */}
      {products && products.length > 0 && (
        <div className="card mb-6">
          <h2 className="font-semibold mb-4">Record Manufacturing Event</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Product</label>
              <select className="input" value={eventForm.productId} onChange={e => setEventForm(f => ({ ...f, productId: e.target.value }))}>
                <option value="">Select…</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Event Type</label>
              <select className="input" value={eventForm.eventType} onChange={e => setEventForm(f => ({ ...f, eventType: e.target.value as EventType }))}>
                <option value="">Select…</option>
                {MFG_EVENTS.map(et => <option key={et} value={et}>{et.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div><label className="label">Location *</label><input className="input" value={eventForm.location} onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. KL Factory, Malaysia" /></div>
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
      )}

      {/* Product list */}
      <div className="space-y-4">
        {isLoading && <div className="text-center text-gray-400 py-8">Loading products…</div>}
        {products?.length === 0 && <div className="card text-center text-gray-400 py-10"><Package size={40} className="mx-auto mb-2 opacity-30" /><p>No products registered yet.</p></div>}
        {products?.map(product => (
          <div key={product.id} className="card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package size={20} className="text-blue-500" />
                <div>
                  <p className="font-semibold text-gray-900">{product.name}</p>
                  <p className="text-xs text-gray-400">{product.category ?? "Uncategorised"} · {new Date(product.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={product.isHalalCertified ? "badge-green" : "badge-amber"}>{product.halalStatus}</span>
                {product.qrCodeUrl && (
                  <a href={product.qrCodeUrl} download className="btn-secondary text-xs py-1 px-2">
                    <QrCode size={14} /> QR
                  </a>
                )}
                <button onClick={() => setExpandedId(expandedId === product.id ? null : product.id)} className="text-gray-400 hover:text-gray-600">
                  {expandedId === product.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              </div>
            </div>

            {expandedId === product.id && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                {product.txHash && (
                  <p className="text-xs text-gray-400 font-mono mb-4">
                    On-chain TX: {product.txHash} · Block #{product.blockNumber}
                  </p>
                )}
                <SupplyChainTimeline events={product.supplyChainEvents ?? []} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
