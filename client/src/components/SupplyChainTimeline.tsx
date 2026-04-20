import { Package, Factory, Truck, ShoppingBag, CheckSquare, ArrowDown } from "lucide-react";
import { SupplyChainEvent, EventType, Role } from "../types";

const EVENT_CONFIG: Record<EventType, { label: string; icon: typeof Package; color: string }> = {
  RAW_MATERIAL_ADDED:      { label: "Raw Material Added",       icon: Package,     color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  MANUFACTURING_STARTED:   { label: "Manufacturing Started",    icon: Factory,     color: "bg-blue-100 text-blue-700 border-blue-300" },
  MANUFACTURING_COMPLETE:  { label: "Manufacturing Complete",   icon: Factory,     color: "bg-blue-100 text-blue-700 border-blue-300" },
  QUALITY_CHECK_PASSED:    { label: "Quality Check Passed",     icon: CheckSquare, color: "bg-purple-100 text-purple-700 border-purple-300" },
  SHIPPED:                 { label: "Shipped",                  icon: Truck,       color: "bg-orange-100 text-orange-700 border-orange-300" },
  IN_TRANSIT:              { label: "In Transit",               icon: Truck,       color: "bg-orange-100 text-orange-700 border-orange-300" },
  RECEIVED_AT_WAREHOUSE:   { label: "Received at Warehouse",    icon: Package,     color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  DELIVERED_TO_RETAILER:   { label: "Delivered to Retailer",    icon: ShoppingBag, color: "bg-teal-100 text-teal-700 border-teal-300" },
  AVAILABLE_FOR_SALE:      { label: "Available for Sale",       icon: ShoppingBag, color: "bg-green-100 text-green-700 border-green-300" },
};

const ROLE_LABELS: Record<Role, string> = {
  ADMIN:        "Admin",
  SUPPLIER:     "Supplier",
  MANUFACTURER: "Manufacturer",
  LOGISTICS:    "Logistics",
  RETAILER:     "Retailer",
  CONSUMER:     "Consumer",
};

interface Props {
  events: SupplyChainEvent[];
  chainIntegrity?: "verified" | "mismatch";
  onChainEventCount?: number;
}

export default function SupplyChainTimeline({ events, chainIntegrity, onChainEventCount }: Props) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Package size={40} className="mx-auto mb-2 opacity-40" />
        <p>No supply chain events recorded yet.</p>
      </div>
    );
  }

  return (
    <div>
      {chainIntegrity === "mismatch" && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          ⚠ Chain integrity warning: DB has {events.length} events but blockchain has {onChainEventCount}.
        </div>
      )}
      {chainIntegrity === "verified" && onChainEventCount !== undefined && onChainEventCount > 0 && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 flex items-center gap-2">
          ✓ All {events.length} events verified on blockchain
        </div>
      )}

      <ol className="relative">
        {events.map((event, idx) => {
          const config = EVENT_CONFIG[event.eventType];
          const Icon   = config.icon;
          const isLast = idx === events.length - 1;

          return (
            <li key={event.id} className="relative flex gap-4">
              {/* Connector line */}
              {!isLast && (
                <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-gray-200" />
              )}

              {/* Icon */}
              <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${config.color}`}>
                <Icon size={18} />
              </div>

              {/* Content */}
              <div className={`mb-6 flex-1 rounded-xl border bg-white p-4 shadow-sm ${isLast ? "" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{config.label}</p>
                    <p className="text-sm text-gray-500">
                      {event.actor.company ?? event.actor.name} ·{" "}
                      <span className="badge-gray">{ROLE_LABELS[event.actor.role]}</span>
                    </p>
                  </div>
                  <time className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(event.timestamp).toLocaleString()}
                  </time>
                </div>

                {event.location && (
                  <p className="mt-2 text-sm text-gray-600">
                    📍 {event.location}
                  </p>
                )}
                {event.notes && (
                  <p className="mt-1 text-sm text-gray-500 italic">"{event.notes}"</p>
                )}

                {event.txHash && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="badge-green text-xs">✓ On Blockchain</span>
                    <span
                      title={event.txHash}
                      className="text-xs text-gray-500 font-mono"
                    >
                      {event.txHash.slice(0, 12)}…{event.txHash.slice(-8)}
                    </span>
                    {event.blockNumber && (
                      <span className="text-xs text-gray-400">Block #{event.blockNumber}</span>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {events.length > 0 && (
        <div className="flex justify-center mt-2">
          <ArrowDown size={20} className="text-green-500" />
        </div>
      )}
    </div>
  );
}
