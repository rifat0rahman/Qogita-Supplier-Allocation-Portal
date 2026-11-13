export interface QogitaCredentials {
  email?: string;
  password?: string;
  accessToken?: string;
}

export interface SupplierOffer {
  id?: string;
  offerQid: string;
  supplierAllocationId: string; // The anonymous supplier identifier (seller / allocation_fid)
  supplierAlias?: string;
  gtin: string;                 // UPC / EAN code
  productName: string;          // Description / Name
  brand: string;
  category: string;
  price: number;                // Cost by supplier
  currency: string;
  originalPrice?: number;       // Price in the supplier's source currency (before USD conversion)
  originalCurrency?: string;
  inventory: number;            // Units in stock
  mov: number;                  // Minimum Order Value ($$) per supplier order
  movCurrency: string;
  isWellPriced?: boolean;
  estimatedDeliveryTime?: string;
  productUrl?: string;
  imageUrl?: string;
  updatedAt: string | Date;
}

export interface SupplierSummary {
  supplierAllocationId: string;
  mov: number;
  currency: string;
  productCount: number;
  brands: string[];
  totalInventory: number;
  minPrice: number;
  maxPrice: number;
}

export interface SyncProgress {
  status: "idle" | "running" | "completed" | "error";
  totalProducts: number;
  processedProducts: number;
  totalOffers: number;
  currentStep: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}
