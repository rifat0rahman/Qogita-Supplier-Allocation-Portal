import { NextRequest, NextResponse } from "next/server";
import { QogitaApiClient } from "@/lib/qogitaApi";
import { upsertOffers } from "@/lib/catalogStorage";
import { SupplierOffer } from "@/types/qogita";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password, token, maxPages = 3, brandName } = body;

    const tokenToUse =
      (token && typeof token === "string" && token.trim()) ||
      process.env.QOGITA_TOKEN ||
      process.env.QOGITA_ACCESS_TOKEN ||
      undefined;

    const emailToUse =
      (email && typeof email === "string" && email.trim()) ||
      process.env.QOGITA_EMAIL;

    const passwordToUse =
      (password && typeof password === "string" && password) ||
      process.env.QOGITA_PASSWORD;

    const client = new QogitaApiClient(tokenToUse);

    if (!tokenToUse) {
      if (!emailToUse || !passwordToUse) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Missing Qogita credentials. Please enter email & password in the sync dialog or set QOGITA_EMAIL and QOGITA_PASSWORD in your .env.local file.",
          },
          { status: 400 }
        );
      }
      await client.login(emailToUse, passwordToUse);
    }

    const offersToInsert: SupplierOffer[] = [];
    let page = 1;
    let hasMore = true;

    // Fetch product catalog pages
    while (hasMore && page <= maxPages) {
      const productRes = await client.searchProducts({
        page,
        pageSize: 20,
        stockAvailability: "in_stock",
        brandName: brandName ? [brandName] : undefined,
      });

      if (!productRes.results || productRes.results.length === 0) {
        break;
      }

      for (const prod of productRes.results) {
        // If product has a variantFid, fetch multi-supplier offers
        if (prod.variantFid) {
          try {
            const variantOffersRes = await client.getVariantOffers(prod.variantFid);
            if (variantOffersRes.offers && variantOffersRes.offers.length > 0) {
              for (const off of variantOffersRes.offers) {
                const baseTier = off.tieredPrices?.[0];
                const rawPrice = baseTier?.tierPrice?.amount ?? prod.price?.amount ?? 0;
                const price = parseFloat(String(rawPrice)) || 0;
                const currency = baseTier?.tierPrice?.currency ?? prod.price?.currency ?? "EUR";
                const rawMov = baseTier?.tierMov?.amount ?? 0;
                const mov = parseFloat(String(rawMov)) || 0;
                const movCurrency = baseTier?.tierMov?.currency ?? currency;
                const rawInventory = off.inventory ?? prod.inventory ?? 0;
                const inventory = parseInt(String(rawInventory), 10) || 0;

                offersToInsert.push({
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
                  movCurrency,
                  estimatedDeliveryTime: off.estimatedDeliveryTime,
                  productUrl: prod.productUrl,
                  imageUrl: prod.imageUrl,
                  updatedAt: new Date().toISOString(),
                });
              }
              continue;
            }
          } catch (e) {
            console.warn(`Could not fetch offers for variant ${prod.variantFid}:`, e);
          }
        }

        // Fallback for product listing with best offer
        if (prod.price) {
          offersToInsert.push({
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
            mov: 500, // Default fallback MOV
            movCurrency: prod.price.currency,
            productUrl: prod.productUrl,
            imageUrl: prod.imageUrl,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      page++;
      hasMore = !!productRes.next;
    }

    if (offersToInsert.length > 0) {
      await upsertOffers(offersToInsert);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${offersToInsert.length} supplier offers from Qogita`,
      totalSynced: offersToInsert.length,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Sync failed",
      },
      { status: 500 }
    );
  }
}
