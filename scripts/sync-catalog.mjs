#!/usr/bin/env node

/**
 * CLI script to batch-sync Qogita catalog offers into data/catalog.json (and MongoDB if configured).
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

// Parse CLI args
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

console.log("==================================================");
console.log("  🚀 Qogita Catalog Batch Sync CLI");
console.log("==================================================");
console.log(`API Target: ${BASE_URL}`);
console.log(`Email:      ${EMAIL ? EMAIL.replace(/^(.)(.*)(@.*)$/, "$1***$3") : "NOT SET"}`);
console.log(`Max Pages:  ${fetchAll ? "ALL AVAILABLE" : maxPages}`);
console.log("--------------------------------------------------");

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error("❌ Error: Missing credentials! Please configure QOGITA_EMAIL and QOGITA_PASSWORD in .env.local");
  process.exit(1);
}

async function request(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${BASE_URL}${cleanEndpoint.endsWith("/") ? cleanEndpoint : cleanEndpoint + "/"}`;

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(options.headers || {}),
  };

  if (TOKEN) {
    headers["Authorization"] = `Bearer ${TOKEN}`;
  }

  let res = await fetch(url, { ...options, headers });

  // Handle Rate Limiting (429) automatically
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "5", 10) || 5;
    console.log(`⏳ Rate limit reached (429). Waiting ${retryAfter}s before retrying...`);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return request(endpoint, options);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 300)}`);
  }

  return res.json();
}

async function authenticate() {
  if (TOKEN) {
    console.log("🔑 Using pre-configured JWT Bearer Token.");
    return;
  }
  console.log("🔐 Authenticating with Qogita...");
  const data = await request("/auth/login/", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  TOKEN = data.accessToken || data.access_token || data.token;
  if (!TOKEN) {
    throw new Error("No token returned in login response!");
  }
  console.log("✅ Authenticated successfully!");
}

async function main() {
  try {
    await authenticate();

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Load existing items into map so we upsert rather than overwrite
    const existingMap = new Map();
    if (fs.existsSync(CACHE_FILE)) {
      try {
        const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
        if (Array.isArray(raw)) {
          for (const item of raw) {
            if (item.offerQid) existingMap.set(item.offerQid, item);
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

    console.log(`\n⏳ Starting catalog pull (up to ${maxPages} pages)...`);

    while (hasMore && page <= maxPages) {
      process.stdout.write(`Fetching Page ${page}... `);
      const productRes = await request(`/public/buyers/products/?page=${page}&page_size=20&stockAvailability=in_stock`);

      if (!productRes.results || productRes.results.length === 0) {
        console.log("No more products found.");
        break;
      }

      console.log(`Found ${productRes.results.length} products.`);

      for (const prod of productRes.results) {
        let foundVariantOffers = false;

        if (prod.variantFid) {
          try {
            const variantRes = await request(`/buyers/variants/${prod.variantFid}/offers/`);
            if (variantRes.offers && variantRes.offers.length > 0) {
              for (const off of variantRes.offers) {
                const baseTier = off.tieredPrices?.[0];
                const rawPrice = baseTier?.tierPrice?.amount ?? prod.price?.amount ?? 0;
                const price = parseFloat(String(rawPrice)) || 0;
                const currency = baseTier?.tierPrice?.currency ?? prod.price?.currency ?? "EUR";
                const rawMov = baseTier?.tierMov?.amount ?? 0;
                const mov = parseFloat(String(rawMov)) || 0;
                const rawInventory = off.inventory ?? prod.inventory ?? 0;
                const inventory = parseInt(String(rawInventory), 10) || 0;

                const offer = {
                  offerQid: off.qid,
                  supplierAllocationId: off.seller || "UNKNOWN_SUPPLIER",
                  supplierAlias: `Supplier Allocation #${off.seller}`,
                  gtin: prod.gtin,
                  productName: prod.name,
                  brand: prod.brand,
                  category: prod.category,
                  price,
                  currency,
                  inventory,
                  mov,
                  movCurrency: baseTier?.tierMov?.currency ?? currency,
                  estimatedDeliveryTime: off.estimatedDeliveryTime,
                  productUrl: prod.productUrl,
                  imageUrl: prod.imageUrl,
                  updatedAt: new Date().toISOString(),
                };

                existingMap.set(offer.offerQid, offer);
                newlySyncedCount++;
              }
              foundVariantOffers = true;
            }
          } catch (e) {
            // Ignore individual variant failures, continue with fallback
          }
        }

        if (!foundVariantOffers && prod.price) {
          const offer = {
            offerQid: `off_${prod.gtin}_best`,
            supplierAllocationId: "DEFAULT_ALLOCATION",
            supplierAlias: "Best Offer Supplier",
            gtin: prod.gtin,
            productName: prod.name,
            brand: prod.brand,
            category: prod.category,
            price: parseFloat(String(prod.price.amount)) || 0,
            currency: prod.price.currency,
            inventory: parseInt(String(prod.inventory || 0), 10) || 0,
            mov: 500,
            movCurrency: prod.price.currency,
            productUrl: prod.productUrl,
            imageUrl: prod.imageUrl,
            updatedAt: new Date().toISOString(),
          };
          existingMap.set(offer.offerQid, offer);
          newlySyncedCount++;
        }
      }

      // Save incremental checkpoint every page
      const allOffers = Array.from(existingMap.values());
      fs.writeFileSync(CACHE_FILE, JSON.stringify(allOffers, null, 2), "utf-8");

      hasMore = !!productRes.next;
      page++;
    }

    console.log("\n==================================================");
    console.log(`🎉 Sync Completed!`);
    console.log(`Offers added/updated in this run: ${newlySyncedCount}`);
    console.log(`Total catalog offers now stored:   ${existingMap.size}`);
    console.log(`Data saved to: data/catalog.json`);
    console.log("==================================================");
  } catch (err) {
    console.error("\n❌ Sync failed:", err.message);
    process.exit(1);
  }
}

main();
