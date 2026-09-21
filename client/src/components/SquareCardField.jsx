import { useEffect, useState } from 'react';
import { AlertCircle, CreditCard, Loader2, TestTube2 } from 'lucide-react';

let squareSdkPromise;

function loadSquareSdk(environment) {
  if (globalThis.Square) return Promise.resolve(globalThis.Square);
  if (squareSdkPromise) return squareSdkPromise;
  const source = environment === 'production'
    ? 'https://web.squarecdn.com/v1/square.js'
    : 'https://sandbox.web.squarecdn.com/v1/square.js';
  squareSdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${source}"]`);
    const script = existing || document.createElement('script');
    script.addEventListener('load', () => resolve(globalThis.Square), { once: true });
    script.addEventListener('error', () => reject(new Error('Square payment form failed to load')), { once: true });
    if (!existing) {
      script.src = source;
      script.async = true;
      document.head.appendChild(script);
    }
  });
  return squareSdkPromise;
}

export default function SquareCardField({
  total,
  onReady,
  onApplePayStart,
  onApplePayToken,
  onPaymentError,
  disabled = false,
}) {
  const applicationId = import.meta.env.VITE_SQUARE_APPLICATION_ID;
  const locationId = import.meta.env.VITE_SQUARE_LOCATION_ID;
  const environment = import.meta.env.VITE_SQUARE_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
  const configured = Boolean(applicationId && locationId);
  const environmentMismatch = configured && (
    (environment === 'sandbox' && !applicationId.startsWith('sandbox-'))
    || (environment === 'production' && applicationId.startsWith('sandbox-'))
  );
  const canInitialize = configured && !environmentMismatch;
  const [status, setStatus] = useState(canInitialize ? 'loading' : 'error');
  const [error, setError] = useState(() => {
    if (!configured) return 'Square checkout is awaiting its application and location configuration.';
    if (environmentMismatch) return 'Square checkout is blocked because its application and environment do not match.';
    return null;
  });
  const [applePay, setApplePay] = useState(null);
  const [applePayBusy, setApplePayBusy] = useState(false);

  useEffect(() => {
    let active = true;
    let card;
    let applePayMethod;
    if (!canInitialize) {
      onReady(null);
      return undefined;
    }
    loadSquareSdk(environment)
      .then(async Square => {
        if (!Square || !active) return;
        const payments = Square.payments(applicationId, locationId);
        card = await payments.card();
        if (!active) {
          await card.destroy();
          return;
        }
        await card.attach('#square-card-container');
        onReady(card);
        setStatus('ready');

        // Apple Pay initialization is expected to fail on unsupported browsers,
        // devices without Wallet, and domains that have not been registered.
        // Keep card checkout available and only reveal Apple Pay when Square says
        // the current buyer can use it.
        try {
          const paymentRequest = payments.paymentRequest({
            countryCode: 'US',
            currencyCode: 'USD',
            total: {
              amount: Number(total).toFixed(2),
              label: 'Cuss Worthy Café at Muze',
            },
          });
          applePayMethod = await payments.applePay(paymentRequest);
          if (!active) {
            await applePayMethod.destroy();
            return;
          }
          setApplePay(applePayMethod);
        } catch {
          if (active) setApplePay(null);
        }
      })
      .catch(loadError => {
        console.error('Square card initialization failed:', loadError);
        if (!active) return;
        onReady(null);
        setError('Secure card entry could not be loaded. Please refresh and try again.');
        setStatus('error');
      });
    return () => {
      active = false;
      onReady(null);
      setApplePay(null);
      card?.destroy().catch(() => {});
      applePayMethod?.destroy().catch(() => {});
    };
  }, [applicationId, canInitialize, environment, locationId, onReady, total]);

  const handleApplePayClick = async (event) => {
    event.preventDefault();
    if (!applePay || applePayBusy || disabled) return;

    // Apple requires tokenize() to be invoked directly from the click handler,
    // with no awaited work between the buyer gesture and this call.
    const tokenPromise = applePay.tokenize();
    onApplePayStart?.();
    setApplePayBusy(true);
    try {
      const tokenResult = await tokenPromise;
      if (tokenResult.status !== 'OK' || !tokenResult.token) {
        const detail = tokenResult.errors?.[0]?.detail;
        throw new Error(detail || 'Apple Pay was not completed. Please try again.');
      }
      await onApplePayToken(tokenResult.token);
    } catch (paymentError) {
      onPaymentError(paymentError);
    } finally {
      setApplePayBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white border border-muze-gold/20 shadow-sm p-6 mb-5">
      <h3 className="font-bold text-muze-dark text-lg mb-1 flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-muze-brown" />
        Pay securely with Square
      </h3>
      {environment === 'sandbox' ? (
        <div className="my-4 rounded-xl border border-sky-200 bg-sky-50 p-3 flex gap-2 text-sm text-sky-900">
          <TestTube2 className="w-5 h-5 flex-shrink-0" />
          <span><strong>Test mode:</strong> only Square sandbox cards work, and no real charges can be created.</span>
        </div>
      ) : null}
      <p className="text-sm text-muze-dark/60 mb-4">Your payment details go directly to Square and are never stored by Muze.</p>
      {applePay ? (
        <>
          <button
            type="button"
            className="apple-pay-button apple-pay-button-black w-full"
            aria-label={`Pay ${Number(total).toFixed(2)} dollars with Apple Pay`}
            onClick={handleApplePayClick}
            disabled={disabled || applePayBusy}
          >
            <span className="sr-only">
              {applePayBusy ? 'Completing Apple Pay' : `Pay $${Number(total).toFixed(2)} with Apple Pay`}
            </span>
          </button>
          <div className="flex items-center gap-3 my-5" aria-hidden="true">
            <span className="h-px flex-1 bg-muze-gold/20" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muze-dark/45">or pay by card</span>
            <span className="h-px flex-1 bg-muze-gold/20" />
          </div>
        </>
      ) : null}
      {status === 'loading' ? (
        <div className="h-20 rounded-xl bg-muze-cream/60 flex items-center justify-center gap-2 text-muze-dark/60">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading secure payment…
        </div>
      ) : null}
      <div id="square-card-container" className={status === 'ready' ? 'min-h-20' : 'hidden'} />
      {status === 'error' ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-2 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" /> {error}
        </div>
      ) : null}
    </div>
  );
}
