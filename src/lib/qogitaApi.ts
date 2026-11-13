import fs from "fs";
import path from "path";

export interface QogitaApiCredential {
  id?: string;
  name?: string;
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  tokenScope: string;
}

export interface QogitaV1Money {
  amount: number;
  currency: string;
}

export interface QogitaV1TierPrice {
  mov: QogitaV1Money;
  unit_price: QogitaV1Money;
}

export interface QogitaV1Offer {
  supplier: string;
  gtin: string;
  unit_size?: number;
  inventory: number;
  minimum_order_value?: QogitaV1Money;
  tier_prices?: QogitaV1TierPrice[];
  stock_type?: "in_stock" | "pre_order" | string;
  estimated_delivery_weeks?: number;
  is_traceable?: boolean;
  requires_down_payment?: boolean;
  down_payment_percentage?: number;
}

export interface QogitaV1Product {
  gtin: string;
  name: string;
  brand?: { name: string; slug: string } | string;
  category?: { name: string; slug: string } | string;
  image_urls?: string[];
  product_url?: string;
  origin?: string;
  offer_count?: number;
  total_inventory?: number;
  cheapest_offer?: QogitaV1Offer;
}

export interface QogitaV1ExportJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed" | string;
  format: string;
  requested_at?: string;
  completed_at?: string;
  filename?: string;
  download_url?: string;
  download_url_expires_at?: string;
  error?: { code: string; message: string };
}

const CREDENTIAL_CACHE_PATH = path.join(process.cwd(), ".qogita-credential.json");

let memoryCredential: QogitaApiCredential | null = null;
let memoryOAuthToken: { accessToken: string; expiresAt: number } | null = null;

function loadCachedCredential(): QogitaApiCredential | null {
  if (
    process.env.QOGITA_CLIENT_ID &&
    process.env.QOGITA_CLIENT_SECRET &&
    process.env.QOGITA_TOKEN_SCOPE
  ) {
    return {
      clientId: process.env.QOGITA_CLIENT_ID,
      clientSecret: process.env.QOGITA_CLIENT_SECRET,
      tokenUrl:
        process.env.QOGITA_TOKEN_URL || "https://auth.qogita.com/oauth/v2/token",
      tokenScope: process.env.QOGITA_TOKEN_SCOPE,
    };
  }

  if (memoryCredential) return memoryCredential;

  try {
    if (fs.existsSync(CREDENTIAL_CACHE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CREDENTIAL_CACHE_PATH, "utf-8"));
      if (raw?.clientId && raw?.clientSecret && raw?.tokenUrl && raw?.tokenScope) {
        memoryCredential = raw;
        return raw;
      }
    }
  } catch (e) {
    console.warn("Could not read .qogita-credential.json:", e);
  }
  return null;
}

function saveCachedCredential(cred: QogitaApiCredential) {
  memoryCredential = cred;
  try {
    fs.writeFileSync(CREDENTIAL_CACHE_PATH, JSON.stringify(cred, null, 2), "utf-8");
  } catch (e) {
    // Ignore read-only filesystem errors (e.g. serverless runtime)
    console.warn("Could not persist .qogita-credential.json (using in-memory):", e);
  }
}

export class QogitaApiClient {
  private token: string | null = null;
  private websiteToken: string | null = null;
  private email?: string;
  private password?: string;
  private baseUrl: string;

  constructor(token?: string, baseUrl?: string) {
    this.token =
      token ||
      process.env.QOGITA_TOKEN ||
      process.env.QOGITA_ACCESS_TOKEN ||
      null;
    this.baseUrl = (
      baseUrl ||
      process.env.QOGITA_API_URL ||
      "https://api.qogita.com"
    ).replace(/\/+$/, "");
  }

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    bearerOverride?: string
  ): Promise<T> {
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const [pathPart, queryPart] = cleanEndpoint.split("?");
    const normalizedPath = pathPart.endsWith("/") ? pathPart : `${pathPart}/`;
    const url = endpoint.startsWith("http")
      ? endpoint
      : `${this.baseUrl}${normalizedPath}${queryPart ? `?${queryPart}` : ""}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers as Record<string, string>),
    };

    const isV1Endpoint = cleanEndpoint.startsWith("/v1/");
    const activeToken =
      bearerOverride !== undefined
        ? bearerOverride
        : isV1Endpoint
        ? this.token
        : this.websiteToken;
    if (activeToken) {
      headers["Authorization"] = `Bearer ${activeToken}`;
    }

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "5", 10) || 5;
      const waitSec = Math.min(retryAfter, 30);
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      return this.request<T>(endpoint, options, bearerOverride);
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
          parsed?.error?.message ||
          parsed?.error ||
          parsed?.detail ||
          `Qogita API error: ${res.status} ${res.statusText} - ${errorText.slice(
            0,
            200
          )}`
      );
    }

    if (res.status === 204) {
      return {} as T;
    }

    return res.json() as Promise<T>;
  }

  /**
   * Part 1, Step 1: Log in with Qogita email & password to obtain website_token
   */
  async loginWebsiteToken(email?: string, password?: string): Promise<string> {
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
    }>(
      "/auth/login/",
      {
        method: "POST",
        body: JSON.stringify({ email: emailToUse, password: passwordToUse }),
      },
      ""
    );

    const websiteToken = data.access_token || data.accessToken || data.token;
    if (!websiteToken) {
      throw new Error("No access_token returned in Qogita /auth/login/ response");
    }

    this.websiteToken = websiteToken;
    return websiteToken;
  }

  /**
   * Part 1, Step 2: Create (or reuse cached) API credential with catalog:read capability
   */
  async getOrCreateApiCredential(
    email?: string,
    password?: string
  ): Promise<QogitaApiCredential> {
    const existing = loadCachedCredential();
    if (existing) {
      return existing;
    }

    const websiteToken = await this.loginWebsiteToken(email, password);
    const credName = `Portal Catalog Sync ${new Date().toISOString().slice(0, 19).replace("T", " ")}`;

    try {
      const created = await this.request<QogitaApiCredential>(
        "/auth/api-credentials/",
        {
          method: "POST",
          body: JSON.stringify({
            name: credName,
            capabilities: ["catalog:read"],
          }),
        },
        websiteToken
      );

      saveCachedCredential(created);
      return created;
    } catch (err) {
      // If 10-credential limit reached (409), delete the oldest Portal Catalog Sync credential and retry
      try {
        const listRes = await this.request<{
          results?: Array<{ id: string; name: string }>;
        }>("/auth/api-credentials/", { method: "GET" }, websiteToken);

        const portalCreds = (listRes.results || []).filter((c) =>
          c.name?.toLowerCase().includes("portal") ||
          c.name?.toLowerCase().includes("sync")
        );
        const targetToDelete =
          portalCreds[portalCreds.length - 1] ||
          (listRes.results || [])[(listRes.results || []).length - 1];

        if (targetToDelete?.id) {
          await this.request(
            `/auth/api-credentials/${targetToDelete.id}/`,
            { method: "DELETE" },
            websiteToken
          );
          const retried = await this.request<QogitaApiCredential>(
            "/auth/api-credentials/",
            {
              method: "POST",
              body: JSON.stringify({
                name: credName,
                capabilities: ["catalog:read"],
              }),
            },
            websiteToken
          );
          saveCachedCredential(retried);
          return retried;
        }
      } catch {
        // Fall through to throw original error
      }
      throw err;
    }
  }

  /**
   * Part 2, Step 3: Exchange API credential for an OAuth2 /v1 access token
   */
  async authenticateV1(email?: string, password?: string): Promise<string> {
    if (email) this.email = email;
    if (password) this.password = password;
    if (memoryOAuthToken && Date.now() < memoryOAuthToken.expiresAt - 60_000) {
      this.token = memoryOAuthToken.accessToken;
      return memoryOAuthToken.accessToken;
    }

    const cred = await this.getOrCreateApiCredential(email, password);
    const basicAuth = Buffer.from(
      `${cred.clientId}:${cred.clientSecret}`
    ).toString("base64");

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      scope: cred.tokenScope,
    });

    const tokenRes = await fetch(cred.tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    if (!tokenRes.ok) {
      // If cached credential was revoked/deleted, clear cache and retry once
      if ((tokenRes.status === 400 || tokenRes.status === 401) && memoryCredential) {
        memoryCredential = null;
        try {
          if (fs.existsSync(CREDENTIAL_CACHE_PATH)) {
            fs.unlinkSync(CREDENTIAL_CACHE_PATH);
          }
        } catch {
          // ignore
        }
        return this.authenticateV1(email, password);
      }
      const errText = await tokenRes.text();
      throw new Error(
        `OAuth2 token exchange failed (${tokenRes.status}): ${errText.slice(0, 200)}`
      );
    }

    const tokenData: { access_token: string; expires_in?: number } =
      await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error("No access_token returned from OAuth2 token endpoint");
    }

    const expiresInSec = tokenData.expires_in || 3600;
    memoryOAuthToken = {
      accessToken: tokenData.access_token,
      expiresAt: Date.now() + expiresInSec * 1000,
    };
    this.token = tokenData.access_token;
    return tokenData.access_token;
  }

  /**
   * Backwards-compatible login helper: tries v1 OAuth2 credential exchange first,
   * falls back to website_token if the account cannot create API credentials.
   */
  async login(email?: string, password?: string): Promise<string> {
    try {
      return await this.authenticateV1(email, password);
    } catch (v1Err) {
      console.warn(
        "Could not obtain /v1 OAuth2 token, falling back to login token:",
        v1Err
      );
      const token = await this.loginWebsiteToken(email, password);
      this.token = token;
      return token;
    }
  }

  /**
   * Search / list products from the public buyers endpoint
   */
  async searchProducts(
    params: {
      page?: number;
      pageSize?: number;
      stockAvailability?: "in_stock" | "all";
      brandName?: string[];
      categorySlug?: string[];
    } = {}
  ): Promise<{
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
  }> {
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

    try {
      return await this.request<{
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
    } catch (err) {
      // If /public/buyers/products/ requires website login token and we haven't logged in this session
      if (!this.websiteToken) {
        await this.loginWebsiteToken(this.email, this.password);
        return this.request(`/public/buyers/products/?${query.toString()}`);
      }
      throw err;
    }
  }

  /**
   * v1: Get single product details + cheapest_offer by GTIN
   * GET /v1/buyers/products/:gtin/
   */
  async getProductV1(gtin: string): Promise<QogitaV1Product> {
    return this.request<QogitaV1Product>(
      `/v1/buyers/products/${encodeURIComponent(gtin)}/`
    );
  }

  /**
   * v1: Get all supplier offers for a product by GTIN
   * GET /v1/buyers/products/:gtin/offers/?page_size=...
   * Returns each offer's `supplier` (Supplier Allocation ID) and `minimum_order_value` / `tier_prices`.
   */
  async getProductOffersV1(gtin: string, pageSize = 100): Promise<QogitaV1Offer[]> {
    const allOffers: QogitaV1Offer[] = [];
    let endpoint: string | null = `/v1/buyers/products/${encodeURIComponent(
      gtin
    )}/offers/?page_size=${pageSize}`;

    while (endpoint) {
      const res: {
        next: string | null;
        previous: string | null;
        results: QogitaV1Offer[];
      } = await this.request(endpoint);

      if (Array.isArray(res.results)) {
        allOffers.push(...res.results);
      }
      endpoint = res.next && res.next !== "string" ? res.next : null;
    }

    return allOffers;
  }

  /**
   * v1: Trigger an Offer Export job (CSV of all matching supplier offers)
   * POST /v1/buyers/offer-exports/
   */
  async createOfferExportV1(
    filters: {
      brands?: string[];
      categories?: string[];
      min_price?: number;
      max_price?: number;
      max_delivery_time_weeks?: number;
      mov?: number;
      include_pre_orders?: boolean;
      country?: string;
      currency?: string;
      buying_countries?: string[];
      only_traceable_stock?: boolean;
    } = {}
  ): Promise<QogitaV1ExportJob> {
    return this.request<QogitaV1ExportJob>("/v1/buyers/offer-exports/", {
      method: "POST",
      body: JSON.stringify(filters),
    });
  }

  /**
   * v1: Poll status of an Offer Export job
   * GET /v1/buyers/offer-exports/:id/
   */
  async getOfferExportV1(exportId: string): Promise<QogitaV1ExportJob> {
    return this.request<QogitaV1ExportJob>(
      `/v1/buyers/offer-exports/${encodeURIComponent(exportId)}/`
    );
  }

  /**
   * v1: Trigger a Product Export job
   * POST /v1/buyers/product-exports/
   */
  async createProductExportV1(
    filters: Record<string, unknown> = {}
  ): Promise<QogitaV1ExportJob> {
    return this.request<QogitaV1ExportJob>("/v1/buyers/product-exports/", {
      method: "POST",
      body: JSON.stringify(filters),
    });
  }

  /**
   * v1: Poll status of a Product Export job
   * GET /v1/buyers/product-exports/:id/
   */
  async getProductExportV1(exportId: string): Promise<QogitaV1ExportJob> {
    return this.request<QogitaV1ExportJob>(
      `/v1/buyers/product-exports/${encodeURIComponent(exportId)}/`
    );
  }
}
