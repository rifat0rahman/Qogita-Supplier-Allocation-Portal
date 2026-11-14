import { NextRequest, NextResponse } from "next/server";
import { getAllOffersForExport } from "@/lib/catalogStorage";
import { exportOffersToCsv } from "@/lib/csvHelper";
import { getUsdRates, offerToUsd } from "@/lib/currency";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const supplierAllocationId = searchParams.get("supplierAllocationId") || undefined;
    const movParam = searchParams.get("mov");
    const mov =
      movParam && movParam !== "ALL" ? parseFloat(movParam) : undefined;

    const [rawOffers, rates] = await Promise.all([
      getAllOffersForExport(supplierAllocationId, mov),
      getUsdRates(),
    ]);
    const offers = rawOffers.map((o) => offerToUsd(o, rates));
    const csvContent = exportOffersToCsv(offers);

    const movSuffix = mov ? `-MOV-${mov}` : "";
    const filename = supplierAllocationId && supplierAllocationId !== "ALL"
      ? `Qogita-Supplier-${supplierAllocationId}${movSuffix}-${new Date().toISOString().slice(0, 10)}.csv`
      : `Qogita-Catalog-With-Supplier-Allocations${movSuffix}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/export error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to export CSV",
      },
      { status: 500 }
    );
  }
}
