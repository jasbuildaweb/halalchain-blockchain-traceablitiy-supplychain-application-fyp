import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Leaf, Plus, RefreshCw, Package } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../lib/api";
import { EventType } from "../../types";

interface RawMaterial { id: string; name: string; origin?: string; halalStatus: string; supplier: { name: string; company?: string }; createdAt: string; }
interface Product { id: string; name: string; productId: string; }

export default function SupplierDashboard() {
  const qc = useQueryClient();
  const [matForm, setMatForm] = useState({ name: "", origin: "", certRef: "" });
  const [eventForm, setEventForm] = useState({ productId: "", location: "", notes: "" });

  const { data: materials } = useQuery({ queryKey: ["raw-materials"], queryFn: () => api.get("/raw-materials").then(r => r.data.data as RawMaterial[]) });
  const { data: products }  = useQuery({ queryKey: ["products-all"], queryFn: () => api.get("/products").then(r => r.data.data as Product[]) });

  const addMaterial = useMutation({
    mutationFn: () => api.post("/raw-materials", matForm),
    onSuccess: () => { toast.success("Material registered!"); qc.invalidateQueries({ queryKey: ["raw-materials"] }); setMatForm({ name: "", origin: "", certRef: "" }); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"),
  });

  const recordEvent = useMutation({
    mutationFn: () => api.post("/events", { ...eventForm, eventType: "RAW_MATERIAL_ADDED" as EventType }),
    onSuccess: () => { toast.success("Event recorded on blockchain!"); qc.invalidateQueries({ queryKey: ["products-all"] }); setEventForm({ productId: "", location: "", notes: "" }); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Supplier Dashboard</h1>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Register raw material */}
        <div className="card">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><Leaf size={18} className="text-emerald-600" />Register Raw Material</h2>
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); addMaterial.mutate(); }} className="space-y-3">
            <div><label className="label">Material Name *</label><input className="input" value={matForm.name} onChange={e => setMatForm(f => ({ ...f, name: e.target.value }))} required /></div>
            <div><label className="label">Origin</label><input className="input" value={matForm.origin} onChange={e => setMatForm(f => ({ ...f, origin: e.target.value }))} placeholder="e.g. Kelantan, Malaysia" /></div>
            <div><label className="label">Halal Cert Ref</label><input className="input" value={matForm.certRef} onChange={e => setMatForm(f => ({ ...f, certRef: e.target.value }))} /></div>
            <button type="submit" disabled={addMaterial.isPending || !matForm.name} className="btn-primary w-full">
              {addMaterial.isPending ? <><RefreshCw size={14} className="animate-spin" /> Registering…</> : <><Plus size={14} />Register Material</>}
            </button>
          </form>
        </div>

        {/* Record supply event */}
        <div className="card">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><Package size={18} className="text-emerald-600" />Record Raw Material Delivery</h2>
          <div className="space-y-3">
            <div>
              <label className="label">Product</label>
              <select className="input" value={eventForm.productId} onChange={e => setEventForm(f => ({ ...f, productId: e.target.value }))}>
                <option value="">Select product…</option>
                {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className="label">Location *</label><input className="input" value={eventForm.location} onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} placeholder="Farm / warehouse location" /></div>
            <div><label className="label">Notes</label><input className="input" value={eventForm.notes} onChange={e => setEventForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <button
              onClick={() => recordEvent.mutate()}
              disabled={recordEvent.isPending || !eventForm.productId || !eventForm.location}
              className="btn-primary w-full"
            >
              {recordEvent.isPending ? <><RefreshCw size={14} className="animate-spin" /> Recording…</> : "Record on Blockchain"}
            </button>
          </div>
        </div>
      </div>

      {/* Materials list */}
      <div className="card">
        <h2 className="font-semibold mb-4">My Raw Materials ({materials?.length ?? 0})</h2>
        {materials?.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No materials registered yet.</p>}
        <div className="space-y-2">
          {materials?.map(mat => (
            <div key={mat.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
              <div>
                <p className="font-medium text-sm">{mat.name}</p>
                <p className="text-xs text-gray-400">{mat.origin ?? "Origin not specified"} · {new Date(mat.createdAt).toLocaleDateString()}</p>
              </div>
              <span className={mat.halalStatus === "CERTIFIED" ? "badge-green" : mat.halalStatus === "PENDING" ? "badge-amber" : "badge-red"}>{mat.halalStatus}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
