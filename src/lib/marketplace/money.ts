import type { Money } from "./contracts";

const MAX_MINOR_AMOUNT = 9_000_000_000_000;

export function assertMinorAmount(value: number, field = "amount") {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_MINOR_AMOUNT) {
    throw new RangeError(`${field} must be a non-negative safe integer in minor units.`);
  }
  return value;
}

export function addMinorAmounts(...values: number[]) {
  return assertMinorAmount(
    values.reduce((total, value) => total + assertMinorAmount(value), 0),
    "total",
  );
}

export function calculateBasisPointFee(
  amountMinor: number,
  basisPoints: number,
  fixedMinor = 0,
  minimumMinor?: number,
  maximumMinor?: number,
) {
  assertMinorAmount(amountMinor);
  assertMinorAmount(fixedMinor);
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) {
    throw new RangeError("basisPoints must be between 0 and 10,000.");
  }

  const percentage = Math.round((amountMinor * basisPoints) / 10_000);
  let fee = addMinorAmounts(percentage, fixedMinor);
  if (minimumMinor !== undefined) fee = Math.max(fee, assertMinorAmount(minimumMinor));
  if (maximumMinor !== undefined) fee = Math.min(fee, assertMinorAmount(maximumMinor));
  return assertMinorAmount(fee, "fee");
}

export function createMoney(amountMinor: number, currencyCode = "PKR"): Money {
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw new RangeError("Invalid ISO currency code.");
  return { amountMinor: assertMinorAmount(amountMinor), currencyCode };
}

export function formatMoney(
  money: Money,
  locale: "en" | "ur" | "ur-Latn" = "en",
) {
  const numberLocale = locale === "ur" ? "ur-PK" : "en-PK";
  return new Intl.NumberFormat(numberLocale, {
    style: "currency",
    currency: money.currencyCode,
    maximumFractionDigits: 0,
  }).format(money.amountMinor / 100);
}
