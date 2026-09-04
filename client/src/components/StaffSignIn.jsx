import { useState } from 'react';
import { AlertCircle, Lock, RefreshCw } from 'lucide-react';
import { adminAPI } from '../utils/api';

export default function StaffSignIn({ onSuccess, title = 'Staff Access' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [verifying, setVerifying] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setVerifying(true);
    setError(null);
    try {
      await adminAPI.signIn(email.trim(), password);
      onSuccess();
    } catch (signInError) {
      setError(signInError.message || 'Sign in failed');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="min-h-screen bg-muze-dark flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-muze-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-muze-gold" />
          </div>
          <h1 className="text-2xl font-bold text-muze-dark">{title}</h1>
          <p className="text-gray-500 mt-2">Sign in with your staff account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="staff-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="staff-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={event => setEmail(event.target.value)}
              className="input w-full"
              required
              autoFocus
              disabled={verifying}
            />
          </div>
          <div>
            <label htmlFor="staff-password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="staff-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              className="input w-full"
              required
              disabled={verifying}
            />
          </div>

          {error && (
            <div role="alert" className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={verifying || !email.trim() || !password}
            className="w-full btn btn-primary py-4 text-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {verifying ? <RefreshCw className="w-5 h-5 animate-spin" /> : null}
            {verifying ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-gray-400 text-sm mt-6">
          Contact an administrator if you cannot access your account.
        </p>
      </div>
    </div>
  );
}
