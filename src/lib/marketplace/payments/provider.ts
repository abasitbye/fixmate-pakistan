export type ProviderPaymentRequest = {
  paymentIntentId: string;
  paymentReference: string;
  amountMinor: number;
  currencyCode: string;
  returnUrl: string;
};

export type ProviderPaymentResult = {
  providerReference: string;
  status: "pending" | "requires_action" | "authorized" | "paid" | "failed";
  redirectUrl?: string;
};

export type VerifiedWebhook = {
  providerEventId: string;
  eventType: string;
  payloadHash: string;
};

export interface PaymentProviderAdapter {
  readonly code: string;
  readonly supportsOnlinePayment: boolean;
  createPayment(request: ProviderPaymentRequest, idempotencyKey: string): Promise<ProviderPaymentResult>;
  verifyPayment(providerReference: string): Promise<ProviderPaymentResult>;
  verifyWebhook(rawBody: string, signature: string | null): Promise<VerifiedWebhook>;
  createRefund(providerReference: string, amountMinor: number, idempotencyKey: string): Promise<ProviderPaymentResult>;
}

export class OnlineProviderUnavailableError extends Error {
  constructor() {
    super("No verified online payment provider is configured.");
  }
}

/**
 * Cash/manual settlement uses the controlled report + customer confirmation
 * commands and never pretends to be an online gateway.
 */
export class ManualSettlementAdapter implements PaymentProviderAdapter {
  readonly code = "manual";
  readonly supportsOnlinePayment = false;

  async createPayment(): Promise<ProviderPaymentResult> {
    throw new OnlineProviderUnavailableError();
  }
  async verifyPayment(): Promise<ProviderPaymentResult> {
    throw new OnlineProviderUnavailableError();
  }
  async verifyWebhook(): Promise<VerifiedWebhook> {
    throw new OnlineProviderUnavailableError();
  }
  async createRefund(): Promise<ProviderPaymentResult> {
    throw new OnlineProviderUnavailableError();
  }
}

const manualAdapter = new ManualSettlementAdapter();

export function getPaymentProvider(code: string): PaymentProviderAdapter | null {
  if (code === "manual" || code === "cash") return manualAdapter;
  // Add verified provider adapters here only after account approval, credentials,
  // signature verification, sandbox tests, and authorized production tests.
  return null;
}
