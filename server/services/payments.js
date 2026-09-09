import Stripe from 'stripe';
import { SquareClient, SquareEnvironment, WebhooksHelper } from 'square';

export const PAYMENT_PROVIDERS = Object.freeze(['square', 'stripe']);
export const PAYMENT_STATUSES = Object.freeze([
  'unpaid', 'pending', 'authorized', 'paid', 'failed', 'refunded',
]);

const CHANNEL_PROVIDER = Object.freeze({ cafe: 'square' });

export class PaymentProviderNotConfiguredError extends Error {
  constructor(provider, missing) {
    super(`${provider} payment processing is not configured`);
    this.name = 'PaymentProviderNotConfiguredError';
    this.code = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
    this.status = 503;
    this.provider = provider;
    this.missing = missing;
  }
}

export class PaymentProcessingError extends Error {
  constructor(message, provider, cause = null, { status = 402, code = 'PAYMENT_PROCESSING_FAILED' } = {}) {
    super(message);
    this.name = 'PaymentProcessingError';
    this.code = code;
    this.status = status;
    this.provider = provider;
    this.cause = cause;
  }
}

function requiredEnvironment(provider, names) {
  const missing = names.filter(name => !process.env[name]?.trim());
  if (missing.length) throw new PaymentProviderNotConfiguredError(provider, missing);
}

export function providerForChannel(channel) {
  const provider = CHANNEL_PROVIDER[channel];
  if (!provider) throw new PaymentProviderNotConfiguredError('unknown', ['valid order channel']);
  return provider;
}

export function assertProviderConfigured(channel) {
  const provider = providerForChannel(channel);
  if (provider === 'square') {
    requiredEnvironment('square', [
      'SQUARE_ACCESS_TOKEN',
      'SQUARE_LOCATION_ID',
      'SQUARE_WEBHOOK_SIGNATURE_KEY',
      'SQUARE_WEBHOOK_URL',
    ]);
  }
  return provider;
}

let stripeClient;
function stripe() {
  requiredEnvironment('stripe', ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']);
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY.trim(), {
      maxNetworkRetries: 2,
      timeout: 15_000,
    });
  }
  return stripeClient;
}

let squareClient;
function square() {
  requiredEnvironment('square', ['SQUARE_ACCESS_TOKEN', 'SQUARE_LOCATION_ID']);
  if (!squareClient) {
    squareClient = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN.trim(),
      environment: process.env.SQUARE_ENVIRONMENT === 'production'
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox,
      timeoutInSeconds: 15,
      maxRetries: 2,
    });
  }
  return squareClient;
}

export function squareStatus(status) {
  switch (String(status || '').toUpperCase()) {
    case 'COMPLETED': return 'paid';
    case 'APPROVED': return 'authorized';
    case 'PENDING': return 'pending';
    case 'CANCELED':
    case 'FAILED': return 'failed';
    default: return 'pending';
  }
}

export function stripeStatus(session) {
  if (session?.payment_status === 'paid' || session?.payment_status === 'no_payment_required') return 'paid';
  if (session?.status === 'expired') return 'failed';
  return 'pending';
}

async function createSquarePayment({ order, sourceToken, idempotencyKey }) {
  if (!sourceToken) {
    const error = new PaymentProcessingError('Square payment details are required', 'square');
    error.code = 'PAYMENT_SOURCE_REQUIRED';
    throw error;
  }
  try {
    const response = await square().payments.create({
      sourceId: sourceToken,
      idempotencyKey,
      amountMoney: { amount: BigInt(order.total_cents), currency: 'USD' },
      autocomplete: true,
      locationId: process.env.SQUARE_LOCATION_ID.trim(),
      referenceId: order.public_id,
      buyerEmailAddress: order.email,
      note: `Muze Café pickup #${String(order.pickup_number).padStart(3, '0')}`,
    });
    const payment = response.payment;
    if (!payment?.id) throw new Error('Square did not return a payment reference');
    return {
      provider: 'square',
      externalReference: payment.id,
      status: squareStatus(payment.status),
      checkoutUrl: null,
      metadata: { square_status: payment.status || null },
    };
  } catch (error) {
    if (error instanceof PaymentProviderNotConfiguredError || error instanceof PaymentProcessingError) throw error;
    const statusCode = Number(error.statusCode || error.status || 0);
    const definitiveRejection = statusCode >= 400 && statusCode < 500;
    throw new PaymentProcessingError(
      definitiveRejection
        ? 'Square declined this payment. Please review the card details or try another card.'
        : 'Square payment confirmation is temporarily unavailable. Please retry this same checkout.',
      'square',
      error,
      definitiveRejection
        ? undefined
        : { status: 503, code: 'PAYMENT_PROVIDER_UNAVAILABLE' },
    );
  }
}

export async function createProviderCheckout({ order, sourceToken = null, idempotencyKey }) {
  providerForChannel(order.channel);
  return createSquarePayment({ order, sourceToken, idempotencyKey });
}

// Retained to reconcile signed payment events for historical meal orders.
export function verifyStripeWebhook(rawBody, signature) {
  requiredEnvironment('stripe', ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']);
  return stripe().webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET.trim(),
  );
}

export async function verifySquareWebhook(rawBody, signature) {
  requiredEnvironment('square', ['SQUARE_WEBHOOK_SIGNATURE_KEY', 'SQUARE_WEBHOOK_URL']);
  return WebhooksHelper.verifySignature({
    requestBody: rawBody.toString('utf8'),
    signatureHeader: signature || '',
    signatureKey: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY.trim(),
    notificationUrl: process.env.SQUARE_WEBHOOK_URL.trim(),
  });
}

export function paymentActivationStatus() {
  return {
    square: {
      configured: [
        'SQUARE_ACCESS_TOKEN',
        'SQUARE_LOCATION_ID',
        'SQUARE_WEBHOOK_SIGNATURE_KEY',
        'SQUARE_WEBHOOK_URL',
      ].every(name => Boolean(process.env[name]?.trim())),
    },
  };
}
