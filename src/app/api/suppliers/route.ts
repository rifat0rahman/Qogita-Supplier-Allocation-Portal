import { NextResponse } from "next/server";
import { getSuppliersSummary } from "@/lib/catalogStorage";

export async function GET() {
  try {
    const suppliers = await getSuppliersSummary();
    return NextResponse.json({
      success: true,
      suppliers,
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
