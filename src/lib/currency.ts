import { SupplierOffer, SupplierSummary } from "@/types/qogita";

export const DISPLAY_CURRENCY = "USD";

/** USD value of 1 unit of each currency. Used if the live FX lookup fails. */
const FALLBACK_USD_RATES: Record<string, number> = {
  USD: 1,
  EUR: Number(process.env.EUR_USD_RATE) || 1.08,
  GBP: Number(process.env.GBP_USD_RATE) || 1.27,
};

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
let cachedRates: { rates: Record<string, number>; fetchedAt: number } | null = null;

/**
 * Returns a map of currency -> USD value of 1 unit of that currency.
 * Live rates come from the free ECB-backed Frankfurter API and are cached for 12h.
 */
export async function getUsdRates(): Promise<Record<string, number>> {
  if (cachedRates && Date.now() - cachedRates.fetchedAt < CACHE_TTL_MS) {
    return cachedRates.rates;
  }

  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD", {
      signal: AbortSignal.timeout(3000),
      next: { revalidate: 43200 },
    });
    if (!res.ok) throw new Error(`FX API ${res.status}`);
    const data: { rates?: Record<string, number> } = await res.json();

    const rates: Record<string, number> = { ...FALLBACK_USD_RATES, USD: 1 };
    for (const [code, perUsd] of Object.entries(data.rates || {})) {
      if (perUsd > 0) rates[code] = 1 / perUsd; // invert: USD per 1 unit of `code`
    }
    cachedRates = { rates, fetchedAt: Date.now() };
    return rates;
  } catch (e) {
    console.warn("FX rate lookup failed, using fallback USD rates:", e);
    return FALLBACK_USD_RATES;
  }
}

function rateFor(currency: string | undefined, rates: Record<string, number>): number {
  const code = (currency || DISPLAY_CURRENCY).toUpperCase();
  return rates[code] ?? 1;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function offerToUsd(offer: SupplierOffer, rates: Record<string, number>): SupplierOffer {
  const priceCurrency = offer.currency || DISPLAY_CURRENCY;
  const movCurrency = offer.movCurrency || priceCurrency;
  return {
    ...offer,
    originalPrice: offer.price,
    originalCurrency: priceCurrency,
    price: round2((Number(offer.price) || 0) * rateFor(priceCurrency, rates)),
    currency: DISPLAY_CURRENCY,
    mov: round2((Number(offer.mov) || 0) * rateFor(movCurrency, rates)),
    movCurrency: DISPLAY_CURRENCY,
  };
}

export function supplierToUsd(
  supplier: SupplierSummary,
  rates: Record<string, number>
): SupplierSummary {
  const r = rateFor(supplier.currency, rates);
  return {
    ...supplier,
    mov: round2((Number(supplier.mov) || 0) * r),
    minPrice: round2((Number(supplier.minPrice) || 0) * r),
    maxPrice: round2((Number(supplier.maxPrice) || 0) * r),
    currency: DISPLAY_CURRENCY,
  };
}
