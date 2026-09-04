import { useEffect, useState } from 'react';
import { AlertCircle, CreditCard, Loader2 } from 'lucide-react';

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

export default function SquareCardField({ onReady }) {
  const applicationId = import.meta.env.VITE_SQUARE_APPLICATION_ID;
  const locationId = import.meta.env.VITE_SQUARE_LOCATION_ID;
  const environment = import.meta.env.VITE_SQUARE_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
  const configured = Boolean(applicationId && locationId);
  const [status, setStatus] = useState(configured ? 'loading' : 'error');
  const [error, setError] = useState(configured
    ? null
    : 'Square checkout is awaiting its application and location configuration.');

  useEffect(() => {
    let active = true;
    let card;
    if (!configured) {
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
      card?.destroy().catch(() => {});
    };
  }, [applicationId, configured, environment, locationId, onReady]);

  return (
    <div className="rounded-2xl bg-white border border-muze-gold/20 shadow-sm p-6 mb-5">
      <h3 className="font-bold text-muze-dark text-lg mb-1 flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-muze-brown" />
        Pay securely with Square
      </h3>
      <p className="text-sm text-muze-dark/60 mb-4">Your card details go directly to Square and are never stored by Muze.</p>
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
