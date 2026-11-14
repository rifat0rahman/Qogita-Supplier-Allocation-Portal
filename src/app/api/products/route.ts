import { NextRequest, NextResponse } from "next/server";
import { getOffers, getStats, clearAllOffers } from "@/lib/catalogStorage";
import { getUsdRates, offerToUsd } from "@/lib/currency";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const supplierAllocationId = searchParams.get("supplierAllocationId") || undefined;
    const movParam = searchParams.get("mov");
    const mov =
      movParam && movParam !== "ALL" ? parseFloat(movParam) : undefined;
    const brand = searchParams.get("brand") || undefined;
    const search = searchParams.get("search") || undefined;
    const minPrice = searchParams.get("minPrice")
      ? parseFloat(searchParams.get("minPrice")!)
      : undefined;
    const maxPrice = searchParams.get("maxPrice")
      ? parseFloat(searchParams.get("maxPrice")!)
      : undefined;
    const page = searchParams.get("page")
      ? parseInt(searchParams.get("page")!, 10)
      : 1;
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : 50;

    const data = await getOffers({
      supplierAllocationId,
      mov,
      brand,
      search,
      minPrice,
      maxPrice,
      page,
      limit,
    });

    const stats = await getStats();
    const rates = await getUsdRates();

    return NextResponse.json({
      success: true,
      ...data,
      results: data.results.map((o) => offerToUsd(o, rates)),
      stats,
    });
  } catch (error) {
    console.error("GET /api/products error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await clearAllOffers();
    return NextResponse.json({
      success: true,
      message: "All catalog data cleared",
    });
  } catch (error) {
    console.error("DELETE /api/products error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to clear catalog data",
      },
      { status: 500 }
    );
  }
}
