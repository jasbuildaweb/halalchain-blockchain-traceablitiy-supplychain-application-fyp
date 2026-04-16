import { Link } from "react-router-dom";
import { ShieldCheck, QrCode, Link2, BarChart3, ChevronRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-green-700" size={26} />
          <span className="font-bold text-lg text-gray-900">HalalChain</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/scan" className="text-sm text-gray-600 hover:text-gray-900">Scan QR</Link>
          <Link to="/login" className="btn-secondary text-sm">Login</Link>
          <Link to="/register" className="btn-primary text-sm">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-1.5 text-sm font-medium text-green-800 mb-6">
          <ShieldCheck size={14} />
          Blockchain-Powered Halal Traceability
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
          Know exactly where your <br />
          <span className="text-green-700">halal food</span> comes from
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-10">
          HalalChain records every step of the halal supply chain on an immutable blockchain —
          from raw material supplier to your supermarket shelf. Scan any product QR code to
          verify its halal certification and full journey instantly.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/scan" className="btn-primary text-base px-8 py-3">
            <QrCode size={20} />
            Scan a Product
          </Link>
          <Link to="/login" className="btn-secondary text-base px-8 py-3">
            Supply Chain Portal
            <ChevronRight size={18} />
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-10">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: QrCode,
                title: "Scan the QR Code",
                desc: "Use any camera to scan the product QR in-store. No app needed.",
              },
              {
                icon: ShieldCheck,
                title: "Verify Halal Status",
                desc: "Instantly see the certification status, issuing body, and expiry date.",
              },
              {
                icon: Link2,
                title: "Trace the Full Journey",
                desc: "See every step — supplier, manufacturer, logistics, retailer — anchored on blockchain.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card text-center">
                <Icon size={32} className="mx-auto mb-3 text-green-600" />
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-10">Built for the entire supply chain</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { role: "Supplier",     color: "bg-emerald-100 text-emerald-800", desc: "Register raw materials" },
            { role: "Manufacturer", color: "bg-blue-100 text-blue-800",       desc: "Register products & log production" },
            { role: "Logistics",    color: "bg-orange-100 text-orange-800",   desc: "Track shipments end-to-end" },
            { role: "Retailer",     color: "bg-teal-100 text-teal-800",       desc: "Receive goods & print QR" },
          ].map(({ role, color, desc }) => (
            <div key={role} className="rounded-xl border border-gray-200 p-4 text-center">
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${color} mb-2`}>{role}</span>
              <p className="text-xs text-gray-600">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} HalalChain — FYP Prototype · Built with Ethereum + React + PostgreSQL
      </footer>
    </div>
  );
}
