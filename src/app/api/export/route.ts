import { NextRequest, NextResponse } from "next/server";
import { getAllOffersForExport } from "@/lib/catalogStorage";
import { exportOffersToCsv } from "@/lib/csvHelper";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const supplierAllocationId = searchParams.get("supplierAllocationId") || undefined;

    const offers = await getAllOffersForExport(supplierAllocationId);
    const csvContent = exportOffersToCsv(offers);

    const filename = supplierAllocationId && supplierAllocationId !== "ALL"
      ? `Qogita-Supplier-${supplierAllocationId}-${new Date().toISOString().slice(0, 10)}.csv`
      : `Qogita-Catalog-With-Supplier-Allocations-${new Date().toISOString().slice(0, 10)}.csv`;

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
