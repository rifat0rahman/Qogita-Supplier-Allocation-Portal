import { SupplierOffer } from "@/types/qogita";

/**
 * Converts a list of SupplierOffer items into an enriched CSV string
 * with Supplier Allocation ID, Minimum Order Value, Cost, UPC/GTIN, etc.
 */
export function exportOffersToCsv(offers: SupplierOffer[]): string {
  const headers = [
    "Supplier Allocation ID",
    "Supplier Minimum Order ($$)",
    "Currency",
    "Supplier Cost",
    "GTIN / UPC",
    "Brand",
    "Product Description",
    "Category",
    "Available Inventory",
    "Offer QID",
    "Product URL",
  ];

  const escapeCsv = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return "";
    const str = String(val).trim();
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = offers.map((offer) => [
    escapeCsv(offer.supplierAllocationId),
    escapeCsv(Number(offer.mov || 0).toFixed(2)),
    escapeCsv(offer.currency || offer.movCurrency || "USD"),
    escapeCsv(Number(offer.price || 0).toFixed(2)),
    escapeCsv(offer.gtin),
    escapeCsv(offer.brand),
    escapeCsv(offer.productName),
    escapeCsv(offer.category),
    escapeCsv(offer.inventory),
    escapeCsv(offer.offerQid),
    escapeCsv(offer.productUrl || ""),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

/**
 * Parses simple CSV content to array of objects
 */
export function parseCsvRows(csvContent: string): Record<string, string>[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  // Parse header
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(cur.trim());
        cur = "";
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] || "";
    });
    rows.push(obj);
  }

  return rows;
}
