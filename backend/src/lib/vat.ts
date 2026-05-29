// UAE VAT helpers. Keep all rounding + inclusive-vs-exclusive logic in one
// place so booking creation, walk-in creation, and any future quote
// endpoint stay consistent (and the FTA auditor only has one function to
// read when they ask "how do you compute VAT?").
//
// All amounts are integer AED. UAE doesn't use sub-AED currency on
// receipts, so we round to whole AED via Math.round (half-up). Storing the
// VAT and total explicitly means historical reports don't drift if rates
// change in future.

/** Standard UAE VAT rate at time of writing. */
export const UAE_VAT_RATE_PCT = 5;

export interface PricingLine {
  /** Gross amount the customer pays (incl VAT). */
  totalAed: number;
  /** VAT component baked into [totalAed]. */
  vatAed: number;
}

/**
 * Resolve a Service's stored price into the two numbers we record on a
 * Booking: the gross total the customer pays, and the VAT component of it.
 *
 * The Service.priceAed value means different things depending on its
 * vatInclusive flag — vatInclusive services have the 5% already baked in
 * (the common path in V1), while non-inclusive prices need VAT added
 * before charging.
 */
export function priceLineFromService(
  priceAed: number,
  vatInclusive: boolean,
  ratePct: number = UAE_VAT_RATE_PCT,
): PricingLine {
  if (vatInclusive) {
    const vatAed = Math.round((priceAed * ratePct) / (100 + ratePct));
    return { totalAed: priceAed, vatAed };
  }
  const vatAed = Math.round((priceAed * ratePct) / 100);
  return { totalAed: priceAed + vatAed, vatAed };
}
