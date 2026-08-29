import crypto from 'crypto';

export const PAYMENT_PROVIDERS = Object.freeze(['square', 'stripe']);
export const PAYMENT_STATUSES = Object.freeze([
  'unpaid',
  'pending',
  'authorized',
  'paid',
  'failed',
  'refunded',
]);

export class PaymentProviderNotConfiguredError extends Error {
  constructor(message = 'Payment provider is not configured') {
    super(message);
    this.name = 'PaymentProviderNotConfiguredError';
    this.code = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
  }
}

export class PaymentProviderNotImplementedError extends Error {
  constructor(provider) {
    super(`${provider} payment adapter is not enabled in this revival slice`);
    this.name = 'PaymentProviderNotImplementedError';
    this.code = 'PAYMENT_PROVIDER_NOT_IMPLEMENTED';
    this.provider = provider;
  }
}

function assertProvider(provider) {
  if (!PAYMENT_PROVIDERS.includes(provider)) {
    throw new PaymentProviderNotConfiguredError(
      'Set PAYMENT_PROVIDER to square or stripe when payment activation is ready',
    );
  }
  return provider;
}

/**
 * Provider-neutral boundary for the future Square/Stripe integration.
 * Deliberately does not import either SDK or perform network calls. A future
 * adapter should create its provider-side intent and return a normalized
 * status/reference pair before the order payment fields are updated.
 */
export function getPaymentProvider(provider = process.env.PAYMENT_PROVIDER) {
  const name = assertProvider(provider);
  return {
    name,
    async createPaymentIntent() {
      throw new PaymentProviderNotImplementedError(name);
    },
    async capturePayment() {
      throw new PaymentProviderNotImplementedError(name);
    },
    async refundPayment() {
      throw new PaymentProviderNotImplementedError(name);
    },
    normalizeWebhook() {
      throw new PaymentProviderNotImplementedError(name);
    },
  };
}

export function paymentActivationStatus() {
  const configured = process.env.PAYMENT_PROVIDER || null;
  return {
    configuredProvider: configured && PAYMENT_PROVIDERS.includes(configured) ? configured : null,
    active: false,
    supportedProviders: PAYMENT_PROVIDERS,
    reason: 'Payment activation is intentionally disabled until provider credentials and webhooks are configured.',
  };
}

/** Build a durable provider-neutral local payment attempt record. */
export function newPaymentAttempt({ orderId, amountCents, provider }) {
  assertProvider(provider);
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new Error('Payment amount must be a non-negative integer number of cents');
  }
  return {
    id: crypto.randomUUID(),
    orderId,
    provider,
    status: 'pending',
    amountCents,
    externalReference: null,
  };
}

