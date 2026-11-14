import { NextRequest, NextResponse } from "next/server";
import { QogitaApiClient, QogitaV1Offer } from "@/lib/qogitaApi";
import { upsertOffers } from "@/lib/catalogStorage";
import { SupplierOffer } from "@/types/qogita";

function toMajorUnits(minorAmount: unknown): number {
  const num = parseFloat(String(minorAmount ?? 0)) || 0;
  return Math.round(num) / 100;
}

function mapV1OfferToSupplierOffers(
  off: QogitaV1Offer,
  prod: {
    gtin: string;
    name: string;
    brand: string;
    category: string;
    productUrl?: string;
    imageUrl?: string;
    price?: { amount: number; currency: string };
    inventory?: number;
  }
): SupplierOffer[] {
  const rawInventory = off.inventory ?? prod.inventory ?? 0;
  const inventory = parseInt(String(rawInventory), 10) || 0;
  const supplierId = off.supplier || "UNKNOWN_SUPPLIER";
  const delivery =
    off.estimated_delivery_weeks != null
      ? `${off.estimated_delivery_weeks} weeks`
      : undefined;

  const tiers =
    off.tier_prices && off.tier_prices.length > 0
      ? off.tier_prices
      : [
          {
            mov: off.minimum_order_value || { amount: 0, currency: "USD" },
            unit_price: {
              amount: (prod.price?.amount || 0) * 100,
              currency: prod.price?.currency || "USD",
            },
          },
        ];

  return tiers.map((tier, idx) => {
    const price = toMajorUnits(tier.unit_price?.amount);
    const currency =
      tier.unit_price?.currency ??
      off.minimum_order_value?.currency ??
      prod.price?.currency ??
      "USD";

    const movMinor =
      tier.mov?.amount && tier.mov.amount > 0
        ? tier.mov.amount
        : off.minimum_order_value?.amount ?? 0;
    const mov = toMajorUnits(movMinor);
    const movCurrency =
      tier.mov?.currency ?? off.minimum_order_value?.currency ?? currency;

    const suffix = tiers.length > 1 ? `_t${idx}_${mov}` : "";

    return {
      offerQid: `off_${prod.gtin}_${supplierId}_${off.unit_size || 1}${suffix}`,
      supplierAllocationId: supplierId,
      supplierAlias: `Supplier #${supplierId}`,
      gtin: prod.gtin,
      productName: prod.name,
      brand: prod.brand,
      category: prod.category,
      price,
      currency,
      inventory,
      mov,
      movCurrency,
      estimatedDeliveryTime: delivery,
      productUrl: prod.productUrl,
      imageUrl: prod.imageUrl,
      updatedAt: new Date().toISOString(),
    };
  });
}

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

    const hasClientCreds = !!(
      process.env.QOGITA_CLIENT_ID &&
      process.env.QOGITA_CLIENT_SECRET &&
      process.env.QOGITA_TOKEN_SCOPE
    );

    const client = new QogitaApiClient(tokenToUse);

    if (!tokenToUse) {
      if (!hasClientCreds && (!emailToUse || !passwordToUse)) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Missing Qogita credentials. Enter your email & password in the sync dialog or configure QOGITA_EMAIL and QOGITA_PASSWORD in .env.local.",
          },
          { status: 400 }
        );
      }
      // Performs Part 1 (create/load API credential) + Part 2 (OAuth2 access_token exchange)
      await client.authenticateV1(emailToUse, passwordToUse);
    }

    const offersToInsert: SupplierOffer[] = [];
    const uniqueSupplierIds = new Set<string>();
    let page = 1;
    let hasMore = true;

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

      // Fetch /v1/buyers/products/:gtin/offers/ in parallel batches of 5
      const batchSize = 5;
      for (let i = 0; i < productRes.results.length; i += batchSize) {
        const batch = productRes.results.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (prod) => {
            try {
              const v1Offers = await client.getProductOffersV1(prod.gtin);
              if (v1Offers.length > 0) {
                for (const off of v1Offers) {
                  for (const mapped of mapV1OfferToSupplierOffers(off, prod)) {
                    offersToInsert.push(mapped);
                    uniqueSupplierIds.add(mapped.supplierAllocationId);
                  }
                }
                return;
              }
            } catch (e) {
              console.warn(
                `Could not fetch /v1 offers for GTIN ${prod.gtin}:`,
                e
              );
            }

            // Fallback: try /v1/buyers/products/:gtin/ for cheapest_offer
            try {
              const prodV1 = await client.getProductV1(prod.gtin);
              if (prodV1?.cheapest_offer) {
                for (const mapped of mapV1OfferToSupplierOffers(
                  prodV1.cheapest_offer,
                  prod
                )) {
                  offersToInsert.push(mapped);
                  uniqueSupplierIds.add(mapped.supplierAllocationId);
                }
                return;
              }
            } catch {
              // Ignore and fall through
            }

            // Final fallback if /v1 is unavailable for this GTIN
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
                currency: prod.price.currency || "USD",
                inventory: parseInt(String(prod.inventory || 0), 10) || 0,
                mov: 500,
                movCurrency: prod.price.currency || "USD",
                productUrl: prod.productUrl,
                imageUrl: prod.imageUrl,
                updatedAt: new Date().toISOString(),
              });
            }
          })
        );
      }

      page++;
      hasMore = !!productRes.next;
    }

    if (offersToInsert.length > 0) {
      await upsertOffers(offersToInsert);
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${offersToInsert.length} offers across ${uniqueSupplierIds.size} Supplier Allocation IDs from Qogita v1 API`,
      totalSynced: offersToInsert.length,
      totalSuppliers: uniqueSupplierIds.size,
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
