export type Role = "ADMIN" | "SUPPLIER" | "MANUFACTURER" | "LOGISTICS" | "RETAILER" | "CONSUMER";
export type HalalStatus = "PENDING" | "CERTIFIED" | "REJECTED" | "REVOKED" | "EXPIRED";
export type EventType =
  | "RAW_MATERIAL_ADDED"
  | "MANUFACTURING_STARTED"
  | "MANUFACTURING_COMPLETE"
  | "QUALITY_CHECK_PASSED"
  | "SHIPPED"
  | "IN_TRANSIT"
  | "RECEIVED_AT_WAREHOUSE"
  | "DELIVERED_TO_RETAILER"
  | "AVAILABLE_FOR_SALE";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  company?: string;
  walletAddress?: string;
  isApproved: boolean;
  createdAt: string;
}

export interface Certificate {
  id: string;
  certificateId: string;
  issuingBody: string;
  issuedAt: string;
  expiresAt: string;
  isValid: boolean;
  certExpired?: boolean;
  documentUrl?: string;
  issuedBy: string;
  txHash?: string;
}

export interface SupplyChainEvent {
  id: string;
  eventId: string;
  eventType: EventType;
  location: string;
  notes?: string;
  txHash?: string;
  blockNumber?: number;
  timestamp: string;
  actor: {
    name: string;
    company?: string;
    role: Role;
  };
}

export interface Product {
  id: string;
  productId: string;
  name: string;
  description?: string;
  category?: string;
  ingredients: string[];
  images: string[];
  isHalalCertified: boolean;
  halalStatus: HalalStatus;
  txHash?: string;
  blockNumber?: number;
  qrCodeUrl?: string;
  manufacturer: { name: string; company?: string };
  certificate?: Certificate;
  supplyChainEvents?: SupplyChainEvent[];
  createdAt: string;
}

export interface VerifyResponse {
  product: Omit<Product, "certificate" | "supplyChainEvents">;
  halal: {
    isHalalCertified: boolean;
    dbStatus: HalalStatus;
    onChainVerified: boolean;
  };
  certificate: Certificate | null;
  supplyChain: {
    events: SupplyChainEvent[];
    dbEventCount: number;
    onChainEventCount: number;
    chainIntegrity: "verified" | "mismatch";
  };
  rawMaterials: {
    name: string;
    origin?: string;
    halalStatus: HalalStatus;
    supplier: { name: string; company?: string };
    quantity?: string;
    unit?: string;
  }[];
}
