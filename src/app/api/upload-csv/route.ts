import { NextRequest, NextResponse } from "next/server";
import { parseCsvRows } from "@/lib/csvHelper";
import { upsertOffers } from "@/lib/catalogStorage";
import { SupplierOffer } from "@/types/qogita";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file uploaded" },
        { status: 400 }
      );
    }

    const text = await file.text();
    const rows = parseCsvRows(text);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "CSV file is empty or format invalid" },
        { status: 400 }
      );
    }

    const offers: SupplierOffer[] = rows.map((row, idx) => {
      // Check column names with case-insensitive matching
      const getVal = (...keys: string[]) => {
        for (const k of keys) {
          const found = Object.keys(row).find(
            (col) => col.trim().toLowerCase() === k.toLowerCase()
          );
          if (found && row[found]) return row[found].trim();
        }
        return "";
      };

      const gtin = getVal("gtin", "upc", "barcode", "ean") || `GTIN-${idx}`;
      const name = getVal("product description", "description", "product name", "name", "title") || "Untitled Product";
      const brand = getVal("brand", "brand name") || "Unknown Brand";
      const category = getVal("category", "category name") || "General";
      const priceStr = getVal("supplier cost", "cost", "price", "unit price") || "0";
      const price = parseFloat(priceStr.replace(/[^0-9.]/g, "")) || 0;
      const inventoryStr = getVal("available inventory", "inventory", "stock", "qty") || "50";
      const inventory = parseInt(inventoryStr.replace(/[^0-9]/g, ""), 10) || 50;

      // Extract or assign Supplier Allocation ID
      let supplierAllocationId = getVal("supplier allocation id", "supplier id", "allocation id", "seller");
      if (!supplierAllocationId) {
        // Deterministically assign to a supplier cohort if missing from original file
        const supplierCohorts = ["SUP-AL-1084", "SUP-AL-2041", "SUP-AL-3920", "SUP-AL-4105", "SUP-AL-5512"];
        const cohortIndex = Math.abs(gtin.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) % supplierCohorts.length;
        supplierAllocationId = supplierCohorts[cohortIndex];
      }

      // Extract or assign Supplier MOV
      let movStr = getVal("supplier minimum order ($$)", "minimum order value", "mov", "mnq", "minimum");
      let mov = parseFloat(movStr.replace(/[^0-9.]/g, ""));
      if (!mov || isNaN(mov)) {
        const movMap: Record<string, number> = {
          "SUP-AL-1084": 1000,
          "SUP-AL-2041": 500,
          "SUP-AL-3920": 2500,
          "SUP-AL-4105": 750,
          "SUP-AL-5512": 1500,
        };
        mov = movMap[supplierAllocationId] || 1000;
      }

      return {
        offerQid: `off_imported_${gtin}_${supplierAllocationId}`,
        supplierAllocationId,
        supplierAlias: `Supplier Allocation #${supplierAllocationId}`,
        gtin,
        productName: name,
        brand,
        category,
        price,
        currency: "EUR",
        inventory,
        mov,
        movCurrency: "EUR",
        updatedAt: new Date().toISOString(),
      };
    });

    await upsertOffers(offers);

    return NextResponse.json({
      success: true,
      message: `Enriched and imported ${offers.length} rows with Supplier Allocation IDs and Minimum Order Values`,
      count: offers.length,
    });
  } catch (error) {
    console.error("Upload CSV error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to parse CSV",
      },
      { status: 500 }
    );
  }
}
