import Stripe from 'stripe';
import { SquareClient, SquareEnvironment, WebhooksHelper } from 'square';
import { formatPartnerDeadline, formatPartnerDeliveryDate } from '../lib/partnerSchedule.js';

export const PAYMENT_PROVIDERS = Object.freeze(['square', 'stripe']);
export const PAYMENT_STATUSES = Object.freeze([
  'unpaid', 'pending', 'authorized', 'paid', 'failed', 'refunded',
]);

const CHANNEL_PROVIDER = Object.freeze({ cafe: 'square', partner_meal: 'stripe' });

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
  } else {
    requiredEnvironment('stripe', ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'CLIENT_URL']);
  }
  return provider;
}

function applicationOrigin() {
  const configured = process.env.CLIENT_URL?.trim().replace(/\/$/, '');
  if (!configured) throw new PaymentProviderNotConfiguredError('stripe', ['CLIENT_URL']);
  const url = new URL(configured);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/') {
    throw new PaymentProviderNotConfiguredError('stripe', ['valid CLIENT_URL origin']);
  }
  return configured;
}

let stripeClient;
function stripe() {
  requiredEnvironment('stripe', ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'CLIENT_URL']);
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

export function buildStripeCheckoutParams(order, origin, now = Date.now()) {
  const deliveryLabel = formatPartnerDeliveryDate(order.preorder_delivery_date);
  const deadlineLabel = formatPartnerDeadline(order.preorder_deadline);
  const taxCopy = order.channel === 'partner_meal' ? 'Prices include Nevada sales tax.' : '';
  const preorderCopy = deliveryLabel && deadlineLabel
    ? `Weekly meal pre-order. Ordered by ${deadlineLabel}; delivered to Muze for pickup on ${deliveryLabel}. ${taxCopy}`
    : `Weekly meal pre-order for pickup at Muze. ${taxCopy}`.trim();
  const lineItems = order.items.map(item => ({
      quantity: item.quantity,
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(item.total_price_cents / item.quantity),
        product_data: {
          name: item.item_name,
          description: [preorderCopy, item.modifiers, item.special_instructions]
            .filter(Boolean)
            .join(' · ')
            .slice(0, 500),
        },
      },
    }));
  if (order.tax_cents > 0 && order.channel !== 'partner_meal') {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: order.tax_cents,
        product_data: { name: 'Nevada sales tax' },
      },
    });
  }
  return {
    mode: 'payment',
    customer_email: order.email,
    client_reference_id: order.public_id,
    line_items: lineItems,
    custom_text: {
      submit: { message: preorderCopy },
      after_submit: { message: `Your receipt will confirm this pre-order schedule. ${preorderCopy}` },
    },
    metadata: {
      order_public_id: order.public_id,
      order_channel: order.channel,
      preorder_deadline: order.preorder_deadline || '',
      preorder_delivery_date: order.preorder_delivery_date || '',
    },
    payment_intent_data: {
      description: `Muze weekly meal pre-order · ${deliveryLabel || 'Monday pickup'}`,
      receipt_email: order.email,
      metadata: {
        order_public_id: order.public_id,
        order_channel: order.channel,
        preorder_deadline: order.preorder_deadline || '',
        preorder_delivery_date: order.preorder_delivery_date || '',
      },
    },
    success_url: `${origin}/orders/${order.public_id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/partner-meals/checkout?payment=cancelled`,
    expires_at: Math.floor(now / 1000) + (31 * 60),
  };
}

async function createStripeCheckout({ order, idempotencyKey }) {
  const origin = applicationOrigin();
  try {
    const session = await stripe().checkout.sessions.create(
      buildStripeCheckoutParams(order, origin),
      { idempotencyKey },
    );
    if (!session.id || !session.url) throw new Error('Stripe did not return a checkout URL');
    return {
      provider: 'stripe',
      externalReference: session.id,
      status: stripeStatus(session),
      checkoutUrl: session.url,
      metadata: { stripe_payment_intent: session.payment_intent || null },
    };
  } catch (error) {
    if (error instanceof PaymentProviderNotConfiguredError) throw error;
    throw new PaymentProcessingError(
      'Stripe checkout is temporarily unavailable. Please retry.',
      'stripe',
      error,
      { status: 503, code: 'PAYMENT_PROVIDER_UNAVAILABLE' },
    );
  }
}

export async function createProviderCheckout({ order, sourceToken = null, idempotencyKey }) {
  const provider = providerForChannel(order.channel);
  if (provider === 'square') {
    return createSquarePayment({ order, sourceToken, idempotencyKey });
  }
  return createStripeCheckout({ order, idempotencyKey });
}

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
    stripe: {
      configured: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'CLIENT_URL'].every(name => Boolean(process.env[name]?.trim())),
    },
  };
}
