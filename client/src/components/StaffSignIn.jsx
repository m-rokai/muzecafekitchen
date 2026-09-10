import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Mail, RefreshCw } from 'lucide-react';
import { adminAPI } from '../utils/api';

export default function StaffSignIn({ title = 'Staff Access', destination = '/admin', authError }) {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [retryIn, setRetryIn] = useState(0);
  const retryUntil = useRef(0);

  useEffect(() => {
    if (!retryIn) return;
    const timer = setTimeout(() => {
      setRetryIn(Math.max(0, Math.ceil((retryUntil.current - Date.now()) / 1000)));
    }, 1000);
    return () => clearTimeout(timer);
  }, [retryIn]);

  function startCooldown() {
    retryUntil.current = Date.now() + 60_000;
    setRetryIn(60);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (sending || retryIn) return;
    setSending(true);
    setError(null);
    try {
      await adminAPI.sendSignInLink(email, destination);
      setSentTo(email.trim());
      startCooldown();
    } catch (signInError) {
      if (signInError.status === 429 || signInError.code === 'over_email_send_rate_limit') {
        startCooldown();
        setError('Please wait a minute before requesting another sign-in link.');
      } else {
        setError('We could not send a sign-in link. Check your email address and try again, or contact an administrator.');
      }
    } finally {
      setSending(false);
    }
  }

  const visibleError = error || (!sentTo && authError);

  return (
    <div className="min-h-screen bg-muze-dark flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-muze-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-muze-gold" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-muze-dark">{title}</h1>
          <p className="text-gray-500 mt-2">We’ll email you a link to sign in. No password needed.</p>
        </div>

        {sentTo && (
          <div role="status" className="mb-5 rounded-lg bg-green-50 p-4 text-sm text-green-800">
            <p className="font-semibold">Check your inbox</p>
            <p className="mt-1 break-words">
              If {sentTo} is eligible, a sign-in link is on its way. Check your spam folder too, and use the newest link.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="staff-email" className="block text-sm font-medium text-gray-700 mb-1">Work email</label>
            <input
              id="staff-email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={event => {
                setEmail(event.target.value);
                setSentTo('');
                setError(null);
              }}
              className="input w-full"
              required
              autoFocus
              disabled={sending}
            />
          </div>

          {visibleError && (
            <div role="alert" className="flex items-start gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>{visibleError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={sending || retryIn > 0 || !email.trim()}
            className="w-full btn btn-primary py-4 text-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {sending && <RefreshCw className="w-5 h-5 animate-spin" aria-hidden="true" />}
            {sending ? 'Sending link…' : retryIn ? `Try again in ${retryIn}s` : sentTo ? 'Send another link' : 'Email me a sign-in link'}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-6">
          Use your @muzeoffice.com email, an approved partner email, or an existing staff account.
        </p>
      </div>
    </div>
  );
}
