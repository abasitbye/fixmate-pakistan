import { Banknote, ReceiptText } from "lucide-react";

function money(amountMinor: number, currencyCode = "PKR") {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

export function FinancialRecordList({
  records,
  kind,
}: {
  records: Array<Record<string, unknown>>;
  kind: "payments" | "receipts" | "earnings" | "payouts";
}) {
  return (
    <div className="card-list">
      {records.map((record) => {
        const id = String(record.id);
        const reference = String(
          record.payment_reference ??
            record.document_number ??
            record.payout_reference ??
            "Earning",
        );
        const amount = Number(
          record.amount_minor ??
            record.total_minor ??
            record.net_amount_minor ??
            0,
        );
        const status = String(
          record.status ?? record.document_type ?? "issued",
        );
        return (
          <article className="panel-card setting-row" key={id}>
            <span className="panel-icon">
              {kind === "receipts" ? (
                <ReceiptText size={20} />
              ) : (
                <Banknote size={20} />
              )}
            </span>
            <div>
              <h2>{reference}</h2>
              <p>
                {money(amount, String(record.currency_code ?? "PKR"))}
                {record.wording ? ` · ${String(record.wording)}` : ""}
              </p>
            </div>
            <span className="status-chip">{status.replaceAll("_", " ")}</span>
          </article>
        );
      })}
      {!records.length ? (
        <article className="panel-card">
          <h2>No {kind} yet</h2>
          <p>Verified financial activity will appear here.</p>
        </article>
      ) : null}
    </div>
  );
}
