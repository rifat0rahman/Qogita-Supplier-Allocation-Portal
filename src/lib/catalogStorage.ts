import fs from "fs";
import path from "path";
import { connectToDatabase } from "./mongodb";
import { CatalogItem } from "@/models/CatalogItem";
import { SupplierOffer, SupplierSummary } from "@/types/qogita";

const DATA_DIR = path.join(process.cwd(), "data");
const CACHE_FILE = path.join(DATA_DIR, "catalog.json");

// In-memory fallback
let memoryOffers: Map<string, SupplierOffer> = new Map();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

import { SAMPLE_OFFERS } from "./sampleData";

function normalizeOffer(offer: Partial<SupplierOffer>): SupplierOffer {
  return {
    ...offer,
    price:
      typeof offer.price === "number"
        ? offer.price
        : parseFloat(String(offer.price || 0)) || 0,
    mov:
      typeof offer.mov === "number"
        ? offer.mov
        : parseFloat(String(offer.mov || 0)) || 0,
    inventory:
      typeof offer.inventory === "number"
        ? offer.inventory
        : parseInt(String(offer.inventory || 0), 10) || 0,
  } as SupplierOffer;
}

function loadLocalCache() {
  ensureDataDir();
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const raw = fs.readFileSync(CACHE_FILE, "utf-8");
      const list: SupplierOffer[] = JSON.parse(raw);
      if (list && list.length > 0) {
        memoryOffers = new Map(
          list.map((item) => {
            const normalized = normalizeOffer(item);
            return [normalized.offerQid, normalized];
          })
        );
        return;
      }
    } catch (e) {
      console.error("Error loading local catalog cache:", e);
    }
  }

  // Seed default sample data so app is immediately visual and functional
  memoryOffers = new Map(
    SAMPLE_OFFERS.map((item) => {
      const normalized = normalizeOffer(item);
      return [normalized.offerQid, normalized];
    })
  );
  saveLocalCache();
}

function saveLocalCache() {
  ensureDataDir();
  try {
    const list = Array.from(memoryOffers.values());
    fs.writeFileSync(CACHE_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving local catalog cache:", e);
  }
}

// Initial load of local cache
loadLocalCache();

export async function upsertOffers(offers: SupplierOffer[]): Promise<number> {
  const normalizedOffers = offers.map(normalizeOffer);
  const db = await connectToDatabase();
  if (db) {
    const bulkOps = normalizedOffers.map((offer) => ({
      updateOne: {
        filter: { offerQid: offer.offerQid },
        update: { $set: { ...offer, updatedAt: new Date() } },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await CatalogItem.bulkWrite(bulkOps);
    }
  }

  // Always keep in-memory/file cache in sync as well
  for (const o of normalizedOffers) {
    memoryOffers.set(o.offerQid, { ...o, updatedAt: new Date().toISOString() });
  }
  saveLocalCache();

  return normalizedOffers.length;
}

export interface GetOffersFilter {
  supplierAllocationId?: string;
  brand?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
}

export async function getOffers(filter: GetOffersFilter) {
  const {
    supplierAllocationId,
    brand,
    search,
    minPrice,
    maxPrice,
    page = 1,
    limit = 50,
  } = filter;

  const db = await connectToDatabase();

  if (db) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {};
    if (supplierAllocationId && supplierAllocationId !== "ALL") {
      query.supplierAllocationId = supplierAllocationId;
    }
    if (brand && brand !== "ALL") {
      query.brand = brand;
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined) query.price.$gte = minPrice;
      if (maxPrice !== undefined) query.price.$lte = maxPrice;
    }
    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [{ productName: regex }, { gtin: regex }, { brand: regex }];
    }

    const total = await CatalogItem.countDocuments(query);
    const results = await CatalogItem.find(query)
      .sort({ price: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      results: results as unknown as SupplierOffer[],
    };
  }

  // In-memory / file query
  let items = Array.from(memoryOffers.values());

  if (supplierAllocationId && supplierAllocationId !== "ALL") {
    items = items.filter(
      (item) => item.supplierAllocationId === supplierAllocationId
    );
  }

  if (brand && brand !== "ALL") {
    items = items.filter((item) => item.brand === brand);
  }

  if (minPrice !== undefined) {
    items = items.filter((item) => item.price >= minPrice);
  }

  if (maxPrice !== undefined) {
    items = items.filter((item) => item.price <= maxPrice);
  }

  if (search) {
    const s = search.toLowerCase();
    items = items.filter(
      (item) =>
        item.productName.toLowerCase().includes(s) ||
        item.gtin.toLowerCase().includes(s) ||
        item.brand.toLowerCase().includes(s)
    );
  }

  const total = items.length;
  items.sort((a, b) => a.price - b.price);
  const paginated = items.slice((page - 1) * limit, page * limit);

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: paginated,
  };
}

export async function getSuppliersSummary(): Promise<SupplierSummary[]> {
  const db = await connectToDatabase();

  if (db) {
    const agg = await CatalogItem.aggregate([
      {
        $group: {
          _id: "$supplierAllocationId",
          mov: { $first: "$mov" },
          currency: { $first: "$movCurrency" },
          productCount: { $sum: 1 },
          brands: { $addToSet: "$brand" },
          totalInventory: { $sum: "$inventory" },
          minPrice: { $min: "$price" },
          maxPrice: { $max: "$price" },
        },
      },
      {
        $project: {
          supplierAllocationId: "$_id",
          mov: 1,
          currency: 1,
          productCount: 1,
          brands: 1,
          totalInventory: 1,
          minPrice: 1,
          maxPrice: 1,
          _id: 0,
        },
      },
      { $sort: { productCount: -1 } },
    ]);

    return agg;
  }

  // In-memory summary
  const map = new Map<string, SupplierSummary>();
  for (const item of memoryOffers.values()) {
    const sid = item.supplierAllocationId;
    if (!map.has(sid)) {
      map.set(sid, {
        supplierAllocationId: sid,
        mov: item.mov,
        currency: item.movCurrency || item.currency || "EUR",
        productCount: 0,
        brands: [],
        totalInventory: 0,
        minPrice: item.price,
        maxPrice: item.price,
      });
    }

    const s = map.get(sid)!;
    s.productCount += 1;
    s.totalInventory += item.inventory || 0;
    if (!s.brands.includes(item.brand)) {
      s.brands.push(item.brand);
    }
    s.minPrice = Math.min(s.minPrice, item.price);
    s.maxPrice = Math.max(s.maxPrice, item.price);
  }

  return Array.from(map.values()).sort(
    (a, b) => b.productCount - a.productCount
  );
}

export async function getAllOffersForExport(
  supplierAllocationId?: string
): Promise<SupplierOffer[]> {
  const db = await connectToDatabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: any = {};
  if (supplierAllocationId && supplierAllocationId !== "ALL") {
    query.supplierAllocationId = supplierAllocationId;
  }

  if (db) {
    return (await CatalogItem.find(query)
      .sort({ supplierAllocationId: 1, brand: 1, price: 1 })
      .lean()) as unknown as SupplierOffer[];
  }

  let items = Array.from(memoryOffers.values());
  if (supplierAllocationId && supplierAllocationId !== "ALL") {
    items = items.filter(
      (item) => item.supplierAllocationId === supplierAllocationId
    );
  }
  return items.sort((a, b) => {
    if (a.supplierAllocationId !== b.supplierAllocationId) {
      return a.supplierAllocationId.localeCompare(b.supplierAllocationId);
    }
    return a.price - b.price;
  });
}

export async function getStats() {
  const suppliers = await getSuppliersSummary();
  const all = await getAllOffersForExport();
  const uniqueBrands = new Set(all.map((item) => item.brand));

  return {
    totalProducts: all.length,
    totalSuppliers: suppliers.length,
    totalBrands: uniqueBrands.size,
    totalInventory: all.reduce((sum, item) => sum + (item.inventory || 0), 0),
  };
}
