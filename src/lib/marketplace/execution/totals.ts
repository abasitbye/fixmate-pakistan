import type { z } from "zod";

import type { quotationItemSchema } from "./schemas";

type Item = z.infer<typeof quotationItemSchema>;

export function calculateQuotationTotals(items: Item[]) {
  const totals = { labor: 0, materials: 0, other: 0, discount: 0 };
  for (const item of items) {
    const amount = Math.round(item.quantity * item.unitPriceMinor);
    if (!Number.isSafeInteger(amount)) throw new Error("Quotation amount exceeds the supported range.");
    if (item.itemType === "labor") totals.labor += amount;
    if (item.itemType === "material") totals.materials += amount;
    if (item.itemType === "other") totals.other += amount;
    if (item.itemType === "discount") totals.discount += amount;
  }
  return {
    ...totals,
    total: Math.max(0, totals.labor + totals.materials + totals.other - totals.discount),
  };
}
