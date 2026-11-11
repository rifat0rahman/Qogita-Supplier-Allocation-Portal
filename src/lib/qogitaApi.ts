import { SupplierOffer } from "@/types/qogita";

const BASE_URL = process.env.QOGITA_API_URL || "https://api.qogita.com";

export class QogitaApiClient {
  private token: string | null = null;
  private baseUrl: string;

  constructor(token?: string, baseUrl?: string) {
    this.token =
      token ||
      process.env.QOGITA_TOKEN ||
      process.env.QOGITA_ACCESS_TOKEN ||
      null;
    this.baseUrl = (baseUrl || process.env.QOGITA_API_URL || "https://api.qogita.com").replace(/\/+$/, "");
  }

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = endpoint.startsWith("http")
      ? endpoint
      : `${this.baseUrl}${cleanEndpoint.endsWith("/") ? cleanEndpoint : cleanEndpoint + "/"}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After") || "5";
      throw new Error(
        `Rate limit exceeded (429). Retry after ${retryAfter} seconds.`
      );
    }

    if (!res.ok) {
      const errorText = await res.text();
      let parsed;
      try {
        parsed = JSON.parse(errorText);
      } catch {
        parsed = null;
      }
      throw new Error(
        parsed?.message ||
          parsed?.error ||
          parsed?.detail ||
          `Qogita API error: ${res.status} ${res.statusText} - ${errorText.slice(
            0,
            200
          )}`
      );
    }

    return res.json() as Promise<T>;
  }

  /**
   * Authenticate with Qogita credentials to obtain JWT Bearer Token
   */
  async login(email?: string, password?: string): Promise<string> {
    const emailToUse = (email && email.trim()) || process.env.QOGITA_EMAIL;
    const passwordToUse = password || process.env.QOGITA_PASSWORD;

    if (!emailToUse || !passwordToUse) {
      throw new Error(
        "Missing Qogita credentials: email and password are required. Set QOGITA_EMAIL and QOGITA_PASSWORD in .env.local or enter them in the form."
      );
    }

    const data = await this.request<{
      accessToken?: string;
      access_token?: string;
      token?: string;
    }>("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ email: emailToUse, password: passwordToUse }),
    });

    const token = data.accessToken || data.access_token || data.token;
    if (!token) {
      throw new Error("No access token returned in Qogita API response");
    }

    this.token = token;
    return token;
  }

  /**
   * Search / list products from the public buyers endpoint
   */
  async searchProducts(params: {
    page?: number;
    pageSize?: number;
    stockAvailability?: "in_stock" | "all";
    brandName?: string[];
    categorySlug?: string[];
  } = {}) {
    const query = new URLSearchParams();
    if (params.page) query.append("page", params.page.toString());
    if (params.pageSize) query.append("page_size", params.pageSize.toString());
    if (params.stockAvailability)
      query.append("stockAvailability", params.stockAvailability);
    if (params.brandName) {
      params.brandName.forEach((b) => query.append("brandName", b));
    }
    if (params.categorySlug) {
      params.categorySlug.forEach((c) => query.append("categorySlug", c));
    }

    return this.request<{
      count: number;
      next: string | null;
      previous: string | null;
      results: Array<{
        availability: "in_stock" | "out_of_stock";
        gtin: string;
        name: string;
        brand: string;
        category: string;
        imageUrl?: string;
        productUrl?: string;
        price?: { amount: number; currency: string };
        inventory?: number;
        variantFid?: string;
      }>;
    }>(`/public/buyers/products/?${query.toString()}`);
  }

  /**
   * Get all supplier offers for a specific product variant
   * This reveals the Supplier Allocation ID ('seller') and Minimum Order Value (tierMov)
   */
  async getVariantOffers(variantFid: string) {
    return this.request<{
      offers: Array<{
        qid: string;
        unit: string;
        inventory: number;
        seller: string; // The Supplier Allocation ID / Alias
        estimatedDeliveryTime?: string;
        tieredPrices: Array<{
          tierPrice: { amount: number; currency: string };
          tierMov: { amount: number; currency: string }; // Supplier MOV ($$)
          movProgress?: number;
          isActive?: boolean;
        }>;
      }>;
      numberOfExcludedOffers?: number;
    }>(`/buyers/variants/${variantFid}/offers/`);
  }

  /**
   * Search offers from a single supplier allocation
   */
  async searchSupplierOffers(
    allocationFidOrAlias: string,
    params: {
      category_name?: string;
      stock_availability?: "in_stock" | "all";
    } = {}
  ) {
    const query = new URLSearchParams();
    if (params.category_name)
      query.append("category_name", params.category_name);
    if (params.stock_availability)
      query.append("stock_availability", params.stock_availability);

    return this.request<{
      count: number;
      results: Array<{
        offerQid: string;
        gtin: string;
        name: string;
        price: number;
        priceCurrency: string;
        inventory: number;
        isWellPriced?: boolean;
        brand?: string;
        category?: string;
      }>;
    }>(`/variants/offers/search/${allocationFidOrAlias}/?${query.toString()}`);
  }

  /**
   * Get buyer's active cart allocations and MOV progress
   */
  async getCartAllocations() {
    return this.request<{
      results: Array<{
        qid: string;
        fid: string;
        movProgress: number;
        mov: { amount: number; currency: string };
        subtotal: { amount: number; currency: string };
      }>;
    }>("/buyers/carts/active/allocations/");
  }

  /**
   * Trigger asynchronous full catalog download job
   */
  async triggerCatalogDownload(filters: {
    category_slug?: string[];
    brand_names?: string[];
  } = {}) {
    return this.request<{
      catalogRequestId: string;
    }>("/public/buyers/catalog-downloads/", {
      method: "POST",
      body: JSON.stringify(filters),
    });
  }
}
