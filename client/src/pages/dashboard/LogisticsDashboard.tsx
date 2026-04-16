import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Truck, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../lib/api";
import { Product, EventType } from "../../types";

const LOGISTICS_EVENTS: EventType[] = ["SHIPPED", "IN_TRANSIT", "RECEIVED_AT_WAREHOUSE"];

export default function LogisticsDashboard() {
  const qc = useQueryClient();
  const [eventForm, setEventForm] = useState({ productId: "", eventType: "" as EventType, location: "", notes: "" });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get("/products").then(r => r.data.data as Product[]),
  });

  const recordEvent = useMutation({
    mutationFn: () => api.post("/events", eventForm),
    onSuccess: () => {
      toast.success("Shipment event recorded on blockchain!");
      qc.invalidateQueries({ queryKey: ["products"] });
      setEventForm({ productId: "", eventType: "" as EventType, location: "", notes: "" });
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"),
  });

  // Products in transit (last event is logistics-type)
  const inTransit = products?.filter(p => {
    const events = p.supplyChainEvents ?? [];
    if (events.length === 0) return false;
    const last = events[events.length - 1].eventType;
    return ["MANUFACTURING_COMPLETE", "QUALITY_CHECK_PASSED", "SHIPPED", "IN_TRANSIT"].includes(last);
  }) ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Logistics Dashboard</h1>

      {/* Record event */}
      <div className="card mb-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Truck size={18} className="text-orange-600" />Record Shipment Event</h2>
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
              {LOGISTICS_EVENTS.map(et => <option key={et} value={et}>{et.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div><label className="label">Location *</label><input className="input" value={eventForm.location} onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Port Klang, Malaysia" /></div>
          <div><label className="label">Notes</label><input className="input" value={eventForm.notes} onChange={e => setEventForm(f => ({ ...f, notes: e.target.value }))} placeholder="Container ID, temperature…" /></div>
        </div>
        <button
          onClick={() => recordEvent.mutate()}
          disabled={recordEvent.isPending || !eventForm.productId || !eventForm.eventType || !eventForm.location}
          className="btn-primary mt-4"
        >
          {recordEvent.isPending ? <><RefreshCw size={14} className="animate-spin" /> Recording…</> : "Record on Blockchain"}
        </button>
      </div>

      {/* In-transit products */}
      <div className="card">
        <h2 className="font-semibold mb-4">Products In Transit ({inTransit.length})</h2>
        {inTransit.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No products currently in transit.</p>}
        {inTransit.map(product => {
          const events = product.supplyChainEvents ?? [];
          const lastEvent = events[events.length - 1];
          return (
            <div key={product.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
              <div>
                <p className="font-medium text-sm">{product.name}</p>
                <p className="text-xs text-gray-400">
                  {lastEvent ? `Last: ${lastEvent.eventType.replace(/_/g, " ")} · ${lastEvent.location}` : "No events"}
                </p>
              </div>
              <span className={product.isHalalCertified ? "badge-green" : "badge-amber"}>{product.halalStatus}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
