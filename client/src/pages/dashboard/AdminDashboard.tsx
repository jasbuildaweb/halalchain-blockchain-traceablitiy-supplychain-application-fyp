import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, FileCheck, Package, Plus, Trash2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../lib/api";
import { User, Product, Certificate } from "../../types";

type Tab = "overview" | "users" | "certificates" | "products";

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const qc = useQueryClient();

  const { data: users }    = useQuery({ queryKey: ["users"],        queryFn: () => api.get("/users").then(r => r.data.data as User[]) });
  const { data: products } = useQuery({ queryKey: ["products"],     queryFn: () => api.get("/products").then(r => r.data.data as Product[]) });
  const { data: certs }    = useQuery({ queryKey: ["certificates"], queryFn: () => api.get("/certificates").then(r => r.data.data as Certificate[]) });

  // Issue certificate form state
  const [certForm, setCertForm] = useState({ productId: "", issuingBody: "JAKIM", expiresAt: "" });
  const issueCert = useMutation({
    mutationFn: () => api.post("/certificates", certForm),
    onSuccess: () => { toast.success("Certificate issued!"); qc.invalidateQueries({ queryKey: ["certificates"] }); qc.invalidateQueries({ queryKey: ["products"] }); setCertForm({ productId: "", issuingBody: "JAKIM", expiresAt: "" }); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"),
  });

  // Revoke certificate
  const revokeCert = useMutation({
    mutationFn: (id: string) => api.delete(`/certificates/${id}`, { data: { reason: "Revoked by admin" } }),
    onSuccess: () => { toast.success("Certificate revoked"); qc.invalidateQueries({ queryKey: ["certificates"] }); qc.invalidateQueries({ queryKey: ["products"] }); },
    onError: () => toast.error("Failed to revoke"),
  });

  // Approve user
  const approveUser = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/approve`),
    onSuccess: () => { toast.success("User approved"); qc.invalidateQueries({ queryKey: ["users"] }); },
  });

  const stats = [
    { label: "Total Products",    value: products?.length ?? 0, icon: Package,   color: "bg-blue-100 text-blue-700" },
    { label: "Halal Certified",   value: products?.filter(p => p.isHalalCertified).length ?? 0, icon: FileCheck, color: "bg-green-100 text-green-700" },
    { label: "Users",             value: users?.length ?? 0,    icon: Users,     color: "bg-purple-100 text-purple-700" },
    { label: "Active Certs",      value: certs?.filter(c => c.isValid).length ?? 0, icon: FileCheck, color: "bg-emerald-100 text-emerald-700" },
  ];

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview",     label: "Overview" },
    { id: "users",        label: "Users" },
    { id: "certificates", label: "Certificates" },
    { id: "products",     label: "Products" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${tab === t.id ? "bg-white border border-b-white border-gray-200 -mb-px text-green-700" : "text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {stats.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="card">
                <div className={`inline-flex p-2 rounded-lg ${color} mb-3`}><Icon size={20} /></div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-sm text-gray-500">{label}</p>
              </div>
            ))}
          </div>

          {/* Pending approvals */}
          {users?.filter(u => !u.isApproved).length! > 0 && (
            <div className="card border-amber-200 bg-amber-50">
              <h2 className="font-semibold text-amber-800 mb-3">⏳ Pending Approvals</h2>
              {users?.filter(u => !u.isApproved).map(u => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b border-amber-200 last:border-0">
                  <div>
                    <p className="font-medium text-sm">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.email} · {u.role}</p>
                  </div>
                  <button onClick={() => approveUser.mutate(u.id)} className="btn-primary text-xs px-3 py-1">Approve</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Users */}
      {tab === "users" && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b border-gray-200">
              <tr>{["Name","Email","Role","Company","Status","Wallet"].map(h => <th key={h} className="text-left py-2 px-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users?.map(u => (
                <tr key={u.id}>
                  <td className="py-3 px-3 font-medium">{u.name}</td>
                  <td className="py-3 px-3 text-gray-500">{u.email}</td>
                  <td className="py-3 px-3"><span className="badge-blue">{u.role}</span></td>
                  <td className="py-3 px-3 text-gray-500">{u.company ?? "—"}</td>
                  <td className="py-3 px-3">
                    {u.isApproved
                      ? <span className="badge-green">Approved</span>
                      : <span className="badge-amber">Pending</span>}
                  </td>
                  <td className="py-3 px-3 font-mono text-xs text-gray-400">
                    {u.walletAddress ? `${u.walletAddress.slice(0,8)}…` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Certificates */}
      {tab === "certificates" && (
        <div className="space-y-6">
          {/* Issue cert form */}
          <div className="card">
            <h2 className="font-semibold mb-4 flex items-center gap-2"><Plus size={18} />Issue Halal Certificate</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Product</label>
                <select className="input" value={certForm.productId} onChange={e => setCertForm(f => ({ ...f, productId: e.target.value }))}>
                  <option value="">Select product…</option>
                  {products?.filter(p => !p.isHalalCertified).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Issuing Body</label>
                <select className="input" value={certForm.issuingBody} onChange={e => setCertForm(f => ({ ...f, issuingBody: e.target.value }))}>
                  {["JAKIM","MUI","SIRIM","HDC","IFANCA","ESMA"].map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Expiry Date</label>
                <input type="date" className="input" value={certForm.expiresAt} onChange={e => setCertForm(f => ({ ...f, expiresAt: e.target.value }))} />
              </div>
            </div>
            <button
              onClick={() => issueCert.mutate()}
              disabled={!certForm.productId || !certForm.expiresAt || issueCert.isPending}
              className="btn-primary mt-4"
            >
              {issueCert.isPending ? <><RefreshCw size={14} className="animate-spin" /> Issuing on blockchain…</> : "Issue Certificate"}
            </button>
          </div>

          {/* Certificate list */}
          <div className="card overflow-x-auto">
            <h2 className="font-semibold mb-4">Issued Certificates</h2>
            {certs?.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No certificates yet.</p>}
            {certs?.map(cert => (
              <div key={cert.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-medium text-sm">{cert.issuingBody} Certificate</p>
                  <p className="text-xs text-gray-500">
                    Expires: {new Date(cert.expiresAt).toLocaleDateString()} ·{" "}
                    {cert.txHash ? <span className="font-mono">{cert.txHash.slice(0,14)}…</span> : "No tx"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cert.isValid ? "badge-green" : "badge-red"}>{cert.isValid ? "Valid" : "Revoked"}</span>
                  {cert.isValid && (
                    <button
                      onClick={() => confirm("Revoke this certificate?") && revokeCert.mutate(cert.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Products */}
      {tab === "products" && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b border-gray-200">
              <tr>{["Product","Manufacturer","Category","Status","Registered"].map(h => <th key={h} className="text-left py-2 px-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products?.map(p => (
                <tr key={p.id}>
                  <td className="py-3 px-3 font-medium">{p.name}</td>
                  <td className="py-3 px-3 text-gray-500">{p.manufacturer.company ?? p.manufacturer.name}</td>
                  <td className="py-3 px-3 text-gray-500">{p.category ?? "—"}</td>
                  <td className="py-3 px-3">
                    <span className={p.isHalalCertified ? "badge-green" : "badge-amber"}>
                      {p.halalStatus}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-gray-400 text-xs">{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
