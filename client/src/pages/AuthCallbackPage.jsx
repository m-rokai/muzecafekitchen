import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { adminAPI } from '../utils/api';

export default function AuthCallbackPage() {
  const [destination] = useState(() => (
    new URLSearchParams(window.location.search).get('next') === '/kitchen' ? '/kitchen' : '/admin'
  ));
  const [linkError] = useState(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    return query.has('error') || query.has('error_code') || hash.has('error') || hash.has('error_code');
  });
  const [error, setError] = useState(null);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function completeSignIn() {
      try {
        if (linkError) throw new Error('This sign-in link has expired or is invalid. Request a new link below.');
        // The SDK consumes the email link and removes session tokens from the URL.
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session || data.session.user.is_anonymous) {
          throw new Error('This sign-in link is missing or invalid. Request a new link below.');
        }
        const result = await adminAPI.verifyToken();
        const roles = destination === '/admin' ? ['admin'] : ['admin', 'staff'];
        if (!roles.includes(result.auth?.role)) {
          throw new Error('This account does not have access to this page. Use an authorized work email.');
        }
        if (!cancelled) setVerified(true);
      } catch (signInError) {
        if (!cancelled) {
          window.history.replaceState(null, '', `/auth/callback?next=${encodeURIComponent(destination)}`);
          setError(signInError.status === 403
            ? 'This account does not have staff access. Use an authorized work email.'
            : signInError.message || 'Unable to complete sign-in. Please request a new link.');
        }
      }
    }
    completeSignIn();
    return () => { cancelled = true; };
  }, [destination, linkError]);

  if (verified) return <Navigate to={destination} replace />;

  return (
    <div className="min-h-screen bg-muze-dark flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8 text-center">
        {error ? (
          <>
            <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-4" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-muze-dark mb-3">Unable to sign in</h1>
            <p role="alert" className="text-gray-600 mb-6">{error}</p>
            <Link to={destination} className="btn btn-primary w-full">Request a new link</Link>
          </>
        ) : (
          <div role="status">
            <RefreshCw className="w-8 h-8 animate-spin text-muze-gold mx-auto mb-4" aria-hidden="true" />
            <h1 className="text-xl font-bold text-muze-dark">Completing your sign-in…</h1>
          </div>
        )}
      </div>
    </div>
  );
}
