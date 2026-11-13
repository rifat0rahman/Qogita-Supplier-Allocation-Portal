#!/usr/bin/env node

/**
 * CLI script to batch-sync Qogita v1 catalog offers into data/catalog.json.
 *
 * Implements the full Qogita v1 authentication flow:
 *   Part 1: POST /auth/login/ -> POST /auth/api-credentials/ (cached in .qogita-credential.json)
 *   Part 2: POST <tokenUrl> (OAuth2 client_credentials) -> GET /v1/buyers/products/:gtin/offers/
 *
 * Usage:
 *   npm run sync-catalog
 *   npm run sync-catalog -- --pages 20
 *   npm run sync-catalog -- --all
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const CACHE_FILE = path.join(DATA_DIR, "catalog.json");
const CRED_FILE = path.join(ROOT_DIR, ".qogita-credential.json");

const SAMPLE_SUPPLIER_IDS = new Set([
  "SUP-AL-1084",
  "SUP-AL-2041",
  "SUP-AL-3920",
  "SUP-AL-4105",
  "SUP-AL-5512",
]);

const args = process.argv.slice(2);
let maxPages = 10;
let fetchAll = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--pages" && args[i + 1]) {
    maxPages = parseInt(args[i + 1], 10) || 10;
    i++;
  } else if (args[i] === "--all") {
    fetchAll = true;
    maxPages = 9999;
  }
}

const BASE_URL = (process.env.QOGITA_API_URL || "https://api.qogita.com").replace(/\/+$/, "");
const EMAIL = process.env.QOGITA_EMAIL;
const PASSWORD = process.env.QOGITA_PASSWORD;
let TOKEN = process.env.QOGITA_TOKEN || process.env.QOGITA_ACCESS_TOKEN;
let WEBSITE_TOKEN = null;

console.log("==================================================");
console.log("  🚀 Qogita v1 Catalog Batch Sync CLI");
console.log("==================================================");
console.log(`API Target: ${BASE_URL}`);
console.log(`Email:      ${EMAIL ? EMAIL.replace(/^(.)(.*)(@.*)$/, "$1***$3") : "NOT SET"}`);
console.log(`Max Pages:  ${fetchAll ? "ALL AVAILABLE" : maxPages}`);
console.log("--------------------------------------------------");

async function request(endpoint, options = {}, bearerOverride = undefined) {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const [pathPart, queryPart] = cleanEndpoint.split("?");
  const normalizedPath = pathPart.endsWith("/") ? pathPart : `${pathPart}/`;
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${BASE_URL}${normalizedPath}${queryPart ? `?${queryPart}` : ""}`;

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(options.headers || {}),
  };

  const isV1Endpoint = cleanEndpoint.startsWith("/v1/");
  const activeToken =
    bearerOverride !== undefined
      ? bearerOverride
      : isV1Endpoint
      ? TOKEN
      : WEBSITE_TOKEN;
  if (activeToken) {
    headers["Authorization"] = `Bearer ${activeToken}`;
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "5", 10) || 5;
    console.log(`⏳ Rate limit reached (429). Waiting ${retryAfter}s before retrying...`);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return request(endpoint, options, bearerOverride);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 300)}`);
  }

  if (res.status === 204) return {};
  return res.json();
}

async function getOrCreateCredential() {
  if (
    process.env.QOGITA_CLIENT_ID &&
    process.env.QOGITA_CLIENT_SECRET &&
    process.env.QOGITA_TOKEN_SCOPE
  ) {
    return {
      clientId: process.env.QOGITA_CLIENT_ID,
      clientSecret: process.env.QOGITA_CLIENT_SECRET,
      tokenUrl: process.env.QOGITA_TOKEN_URL || "https://auth.qogita.com/oauth/v2/token",
      tokenScope: process.env.QOGITA_TOKEN_SCOPE,
    };
  }

  if (fs.existsSync(CRED_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(CRED_FILE, "utf-8"));
      if (saved?.clientId && saved?.clientSecret && saved?.tokenUrl && saved?.tokenScope) {
        console.log("🔑 Using cached Qogita API credential (.qogita-credential.json)");
        return saved;
      }
    } catch {
      // recreate below
    }
  }

  if (!EMAIL || !PASSWORD) {
    console.error("❌ Error: Missing credentials! Configure QOGITA_EMAIL and QOGITA_PASSWORD in .env.local");
    process.exit(1);
  }

  console.log("🔐 Step 1: Logging in to Qogita (/auth/login/)...");
  const loginData = await request(
    "/auth/login/",
    {
      method: "POST",
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    },
    ""
  );
  const websiteToken = loginData.access_token || loginData.accessToken || loginData.token;
  if (!websiteToken) {
    throw new Error("No access_token returned from /auth/login/");
  }
  WEBSITE_TOKEN = websiteToken;

  console.log("🪪 Step 2: Creating API credential with catalog:read capability...");
  const credName = `Portal Catalog Sync ${new Date().toISOString().slice(0, 19).replace("T", " ")}`;

  try {
    const cred = await request(
      "/auth/api-credentials/",
      {
        method: "POST",
        body: JSON.stringify({ name: credName, capabilities: ["catalog:read"] }),
      },
      websiteToken
    );
    fs.writeFileSync(CRED_FILE, JSON.stringify(cred, null, 2), "utf-8");
    return cred;
  } catch (err) {
    // Handle 10-credential limit (409) by rotating oldest Portal sync credential
    const listRes = await request("/auth/api-credentials/", { method: "GET" }, websiteToken);
    const results = listRes.results || [];
    const portalCreds = results.filter(
      (c) => c.name?.toLowerCase().includes("portal") || c.name?.toLowerCase().includes("sync")
    );
    const toDelete = portalCreds[portalCreds.length - 1] || results[results.length - 1];
    if (toDelete?.id) {
      await request(`/auth/api-credentials/${toDelete.id}/`, { method: "DELETE" }, websiteToken);
      const cred = await request(
        "/auth/api-credentials/",
        {
          method: "POST",
          body: JSON.stringify({ name: credName, capabilities: ["catalog:read"] }),
        },
        websiteToken
      );
      fs.writeFileSync(CRED_FILE, JSON.stringify(cred, null, 2), "utf-8");
      return cred;
    }
    throw err;
  }
}

async function authenticate() {
  if (TOKEN) {
    console.log("🔑 Using pre-configured JWT Bearer Token.");
    return;
  }

  const cred = await getOrCreateCredential();
  console.log("🎟️ Step 3: Exchanging credential for OAuth2 /v1 access token...");
  const basicAuth = Buffer.from(`${cred.clientId}:${cred.clientSecret}`).toString("base64");
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
    if (fs.existsSync(CRED_FILE)) {
      fs.unlinkSync(CRED_FILE);
      return authenticate();
    }
    const errText = await tokenRes.text();
    throw new Error(`OAuth2 token exchange failed (${tokenRes.status}): ${errText}`);
  }

  const tokenData = await tokenRes.json();
  TOKEN = tokenData.access_token;
  if (!TOKEN) {
    throw new Error("No access_token returned from OAuth2 token endpoint!");
  }
  console.log("✅ Authenticated with Qogita v1 API!");
}

function mapV1Offer(off, prod) {
  const baseTier = off.tier_prices?.[0];
  const rawPrice = baseTier?.unit_price?.amount ?? prod.price?.amount ?? 0;
  const price = parseFloat(String(rawPrice)) || 0;
  const currency =
    baseTier?.unit_price?.currency ??
    off.minimum_order_value?.currency ??
    prod.price?.currency ??
    "USD";
  const rawMov = off.minimum_order_value?.amount ?? baseTier?.mov?.amount ?? 0;
  const mov = parseFloat(String(rawMov)) || 0;
  const movCurrency =
    off.minimum_order_value?.currency ?? baseTier?.mov?.currency ?? currency;
  const rawInventory = off.inventory ?? prod.inventory ?? 0;
  const inventory = parseInt(String(rawInventory), 10) || 0;
  const supplierId = off.supplier || "UNKNOWN_SUPPLIER";

  return {
    offerQid: `off_${prod.gtin}_${supplierId}_${off.unit_size || 1}`,
    supplierAllocationId: supplierId,
    supplierAlias: `Supplier #${supplierId}`,
    gtin: prod.gtin,
    productName: prod.name,
    brand: prod.brand,
    category: prod.category,
    price,
    currency,
    inventory,
    mov,
    movCurrency,
    estimatedDeliveryTime:
      off.estimated_delivery_weeks !== undefined
        ? `${off.estimated_delivery_weeks} weeks`
        : undefined,
    productUrl: prod.productUrl,
    imageUrl: prod.imageUrl,
    updatedAt: new Date().toISOString(),
  };
}

async function main() {
  try {
    await authenticate();

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const existingMap = new Map();
    if (fs.existsSync(CACHE_FILE)) {
      try {
        const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
        if (Array.isArray(raw)) {
          for (const item of raw) {
            // Strip fake sample rows immediately
            if (item.offerQid && !SAMPLE_SUPPLIER_IDS.has(item.supplierAllocationId)) {
              existingMap.set(item.offerQid, item);
            }
          }
        }
      } catch (e) {
        console.warn("Could not read existing catalog.json:", e.message);
      }
    }
    console.log(`📦 Loaded ${existingMap.size} existing offers from data/catalog.json`);

    let page = 1;
    let hasMore = true;
    let newlySyncedCount = 0;
    const uniqueSuppliers = new Set();

    console.log(`\n⏳ Starting v1 catalog pull (up to ${maxPages} pages)...`);

    while (hasMore && page <= maxPages) {
      process.stdout.write(`Fetching Page ${page}... `);
      let productRes;
      try {
        productRes = await request(
          `/public/buyers/products/?page=${page}&page_size=20&stockAvailability=in_stock`
        );
      } catch (err) {
        if (!WEBSITE_TOKEN && EMAIL && PASSWORD) {
          const loginData = await request(
            "/auth/login/",
            { method: "POST", body: JSON.stringify({ email: EMAIL, password: PASSWORD }) },
            ""
          );
          WEBSITE_TOKEN = loginData.access_token || loginData.accessToken || loginData.token;
          productRes = await request(
            `/public/buyers/products/?page=${page}&page_size=20&stockAvailability=in_stock`
          );
        } else {
          throw err;
        }
      }

      if (!productRes.results || productRes.results.length === 0) {
        console.log("No more products found.");
        break;
      }

      console.log(`Found ${productRes.results.length} products. Fetching /v1 supplier offers...`);

      const batchSize = 5;
      for (let i = 0; i < productRes.results.length; i += batchSize) {
        const batch = productRes.results.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (prod) => {
            try {
              const offersRes = await request(
                `/v1/buyers/products/${encodeURIComponent(prod.gtin)}/offers/?page_size=100`
              );
              const offers = offersRes.results || [];
              if (offers.length > 0) {
                // Remove old DEFAULT_ALLOCATION placeholder for this GTIN
                existingMap.delete(`off_${prod.gtin}_best`);
                for (const off of offers) {
                  const mapped = mapV1Offer(off, prod);
                  existingMap.set(mapped.offerQid, mapped);
                  uniqueSuppliers.add(mapped.supplierAllocationId);
                  newlySyncedCount++;
                }
                return;
              }
            } catch {
              // Try single product v1 endpoint as fallback
            }

            try {
              const prodV1 = await request(
                `/v1/buyers/products/${encodeURIComponent(prod.gtin)}/`
              );
              if (prodV1?.cheapest_offer) {
                existingMap.delete(`off_${prod.gtin}_best`);
                const mapped = mapV1Offer(prodV1.cheapest_offer, prod);
                existingMap.set(mapped.offerQid, mapped);
                uniqueSuppliers.add(mapped.supplierAllocationId);
                newlySyncedCount++;
              }
            } catch {
              // Keep existing entry if any
            }
          })
        );
      }

      const allOffers = Array.from(existingMap.values());
      fs.writeFileSync(CACHE_FILE, JSON.stringify(allOffers, null, 2), "utf-8");

      hasMore = !!productRes.next;
      page++;
    }

    console.log("\n==================================================");
    console.log(`🎉 v1 Sync Completed!`);
    console.log(`Offers added/updated in this run: ${newlySyncedCount}`);
    console.log(`Unique Supplier Allocation IDs:   ${uniqueSuppliers.size}`);
    console.log(`Total catalog offers now stored:  ${existingMap.size}`);
    console.log(`Data saved to: data/catalog.json`);
    console.log("==================================================");
  } catch (err) {
    console.error("\n❌ Sync failed:", err.message);
    process.exit(1);
  }
}

main();
