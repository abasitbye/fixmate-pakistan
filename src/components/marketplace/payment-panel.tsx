"use client";

import {
  Banknote,
  CircleCheck,
  LoaderCircle,
  ReceiptText,
  ShieldAlert,
} from "lucide-react";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import type { ApiEnvelope } from "@/lib/api/response";

type Payment = {
  id: string;
  payment_reference: string;
  method_type: string;
  currency_code: string;
  amount_minor: number;
  platform_fee_minor: number;
  professional_amount_minor: number;
  status: string;
  paid_at: string | null;
  payment_transactions?: Array<{
    id: string;
    transaction_type: string;
    status: string;
    processed_at: string | null;
  }>;
  refunds?: Array<{
    id: string;
    refund_reference: string;
    amount_minor: number;
    reason: string;
    status: string;
  }>;
  transaction_documents?: Array<{
    id: string;
    document_type: string;
    document_number: string;
    total_minor: number;
    wording: string;
    issued_at: string;
  }>;
};

function money(amountMinor: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

export function PaymentPanel({
  jobId,
  role,
  amountDueMinor,
  payment,
}: {
  jobId: string;
  role: "customer" | "professional";
  amountDueMinor: number;
  payment: Payment | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");

  async function command(
    path: string,
    body: unknown,
    action: string,
    idempotent = false,
  ) {
    setPending(action);
    setError("");
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (idempotent)
      headers["idempotency-key"] = `${action}:${crypto.randomUUID()}`;
    const response = await fetch(path, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as ApiEnvelope<
      Record<string, unknown>
    >;
    setPending("");
    if (!result.success) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  async function create(methodType: "cash" | "manual_bank_transfer") {
    if (
      !window.confirm(
        `Create a ${methodType === "cash" ? "cash" : "manual transfer"} payment acknowledgement for ${money(amountDueMinor)}?`,
      )
    )
      return;
    await command(
      `/api/v1/jobs/${jobId}/payment-intents`,
      { methodType, paymentMethodId: null },
      "payment-create",
      true,
    );
  }

  async function report() {
    const note =
      window.prompt("Optional note about the payment received:")?.trim() ?? "";
    await command(
      `/api/v1/payments/${payment?.id}/report-cash`,
      { note },
      "payment-report",
    );
  }

  async function confirm() {
    if (
      !window.confirm(
        `Confirm that you paid ${payment ? money(payment.amount_minor) : ""}? This creates the accounting record and payment acknowledgement.`,
      )
    )
      return;
    await command(
      `/api/v1/payments/${payment?.id}/confirm-cash`,
      {},
      "payment-confirm",
      true,
    );
  }

  async function disagree() {
    const reason = window
      .prompt("Explain why you disagree with the reported payment:")
      ?.trim();
    if (reason)
      await command(
        `/api/v1/payments/${payment?.id}/disagree`,
        { reason },
        "payment-disagree",
      );
  }

  async function refund() {
    const raw = window
      .prompt("Refund amount in PKR (for example 2500):")
      ?.trim();
    const reason = window.prompt("Reason for the refund request:")?.trim();
    const amountMinor = raw ? Math.round(Number(raw) * 100) : 0;
    if (!reason || !Number.isSafeInteger(amountMinor) || amountMinor <= 0)
      return;
    await command(
      `/api/v1/payments/${payment?.id}/refunds`,
      { amountMinor, reason },
      "refund-create",
      true,
    );
  }

  return (
    <div className="card-list">
      <section className="panel-card">
        <h2>
          <Banknote size={19} /> Payment
        </h2>
        {!payment ? (
          <>
            <p>
              Amount due: <strong>{money(amountDueMinor)}</strong>
            </p>
            {role === "customer" ? (
              <div className="stacked-actions">
                <button
                  className="button button--primary"
                  onClick={() => create("cash")}
                  disabled={Boolean(pending)}
                >
                  Pay cash after service
                </button>
                <button
                  className="button button--ghost"
                  onClick={() => create("manual_bank_transfer")}
                  disabled={Boolean(pending)}
                >
                  Record manual bank transfer
                </button>
              </div>
            ) : (
              <p>The customer has not selected a payment method yet.</p>
            )}
          </>
        ) : (
          <>
            <div className="financial-summary">
              <div>
                <span>Reference</span>
                <strong>{payment.payment_reference}</strong>
              </div>
              <div>
                <span>Amount</span>
                <strong>{money(payment.amount_minor)}</strong>
              </div>
              <div>
                <span>Method</span>
                <strong>{payment.method_type.replaceAll("_", " ")}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{payment.status.replaceAll("_", " ")}</strong>
              </div>
            </div>
            <p>
              Platform fee is configuration-driven:{" "}
              {money(payment.platform_fee_minor)}. Professional share:{" "}
              {money(payment.professional_amount_minor)}.
            </p>
            {role === "professional" && payment.status === "cash_due" ? (
              <button
                className="button button--primary"
                onClick={report}
                disabled={Boolean(pending)}
              >
                Report payment received
              </button>
            ) : null}
            {role === "customer" && payment.status === "cash_reported" ? (
              <div className="stacked-actions">
                <button
                  className="button button--primary"
                  onClick={confirm}
                  disabled={Boolean(pending)}
                >
                  <CircleCheck size={17} /> Confirm payment
                </button>
                <button
                  className="button button--ghost"
                  onClick={disagree}
                  disabled={Boolean(pending)}
                >
                  <ShieldAlert size={17} /> I disagree
                </button>
              </div>
            ) : null}
            {role === "customer" &&
            ["cash_confirmed", "paid", "partially_refunded"].includes(
              payment.status,
            ) ? (
              <button
                className="button button--ghost"
                onClick={refund}
                disabled={Boolean(pending)}
              >
                Request refund
              </button>
            ) : null}
          </>
        )}
        {pending ? (
          <p>
            <LoaderCircle className="spin" size={16} /> Saving the financial
            record…
          </p>
        ) : null}
        {error ? (
          <div className="form-alert form-alert--error" role="alert">
            {error}
          </div>
        ) : null}
      </section>
      {payment?.transaction_documents?.map((document) => (
        <section className="panel-card" key={document.id}>
          <h2>
            <ReceiptText size={19} /> {document.document_number}
          </h2>
          <p>
            <strong>{money(document.total_minor)}</strong> ·{" "}
            {new Date(document.issued_at).toLocaleString("en-PK", {
              timeZone: "Asia/Karachi",
            })}
          </p>
          <p>{document.wording}</p>
        </section>
      ))}
      {payment?.refunds?.length ? (
        <section className="panel-card">
          <h2>Refunds</h2>
          {payment.refunds.map((refund) => (
            <div className="setting-row" key={refund.id}>
              <div>
                <strong>{refund.refund_reference}</strong>
                <p>{refund.reason}</p>
              </div>
              <span className="status-chip">
                {money(refund.amount_minor)} · {refund.status}
              </span>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
