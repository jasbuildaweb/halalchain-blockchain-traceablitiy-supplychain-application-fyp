import { CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { HalalStatus } from "../types";

interface HalalBadgeProps {
  status: HalalStatus;
  isOnChainVerified?: boolean;
  size?: "sm" | "md" | "lg";
}

const STATUS_CONFIG: Record<HalalStatus, {
  label: string;
  icon: typeof CheckCircle;
  bg: string;
  border: string;
  text: string;
  iconColor: string;
}> = {
  CERTIFIED: {
    label: "HALAL CERTIFIED",
    icon: CheckCircle,
    bg: "bg-green-50",
    border: "border-green-300",
    text: "text-green-800",
    iconColor: "text-green-600",
  },
  PENDING: {
    label: "Certification Pending",
    icon: Clock,
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-800",
    iconColor: "text-amber-600",
  },
  REJECTED: {
    label: "NOT HALAL CERTIFIED",
    icon: XCircle,
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-800",
    iconColor: "text-red-600",
  },
  REVOKED: {
    label: "CERTIFICATE REVOKED",
    icon: XCircle,
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-800",
    iconColor: "text-red-600",
  },
  EXPIRED: {
    label: "CERTIFICATE EXPIRED",
    icon: AlertTriangle,
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-800",
    iconColor: "text-amber-600",
  },
};

export default function HalalBadge({ status, isOnChainVerified, size = "md" }: HalalBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon   = config.icon;

  const sizeClasses = {
    sm: "p-3 text-sm",
    md: "p-6 text-lg",
    lg: "p-8 text-2xl",
  };

  const iconSizes = { sm: 20, md: 36, lg: 56 };

  return (
    <div className={`rounded-2xl border-2 ${config.bg} ${config.border} ${sizeClasses[size]} flex flex-col items-center gap-3 text-center`}>
      <Icon size={iconSizes[size]} className={config.iconColor} />
      <p className={`font-bold tracking-wide ${config.text}`}>{config.label}</p>
      {isOnChainVerified !== undefined && (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          isOnChainVerified ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
        }`}>
          {isOnChainVerified ? "✓ Verified on Blockchain" : "⚠ Blockchain unavailable"}
        </span>
      )}
    </div>
  );
}
