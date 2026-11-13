import { NextResponse } from "next/server";
import { getSuppliersSummary } from "@/lib/catalogStorage";
import { getUsdRates, supplierToUsd } from "@/lib/currency";

export async function GET() {
  try {
    const [suppliers, rates] = await Promise.all([getSuppliersSummary(), getUsdRates()]);
    return NextResponse.json({
      success: true,
      suppliers: suppliers.map((s) => supplierToUsd(s, rates)),
    });
  } catch (error) {
    console.error("GET /api/suppliers error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
