import { addMinorAmounts, assertMinorAmount } from "../money";
import type { OfferDraftInput } from "./schemas";

export function calculateOfferTotals(input: OfferDraftInput) {
  const itemTotal = input.items.reduce((total, item) => {
    const amount = Math.round(item.quantity * item.unitPriceMinor);
    return addMinorAmounts(total, assertMinorAmount(amount));
  }, 0);
  const componentTotal = addMinorAmounts(
    input.calloutFeeMinor,
    input.laborAmountMinor,
    input.materialEstimateMinor,
    input.inspectionFeeMinor,
  );
  return {
    itemTotalMinor: itemTotal,
    componentTotalMinor: componentTotal,
    totalAmountMinor: Math.max(itemTotal, componentTotal),
  };
}
