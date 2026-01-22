import { useState } from 'react';
import { Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { adminAPI } from '../utils/api';

export default function PinEntry({ onSuccess, title = 'Staff Access' }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const [verifying, setVerifying] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (pin.length < 4) {
      setError('Please enter your PIN');
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      const result = await adminAPI.verifyPin(pin);
      if (result.success) {
        // Token is automatically stored by adminAPI.verifyPin
        onSuccess();
      }
    } catch (err) {
      setError('Invalid PIN. Please try again.');
      setPin('');
    } finally {
      setVerifying(false);
    }
  }

  function handlePinChange(e) {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(value);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-muze-dark flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-muze-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-muze-gold" />
          </div>
          <h1 className="text-2xl font-bold text-muze-dark">{title}</h1>
          <p className="text-gray-500 mt-2">Enter your PIN to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={handlePinChange}
              placeholder="Enter PIN"
              className="w-full text-center text-3xl tracking-[0.5em] py-4 border-2 border-gray-200 rounded-xl focus:border-muze-gold focus:outline-none transition-colors"
              autoFocus
              disabled={verifying}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm justify-center">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={verifying || pin.length < 4}
            className="w-full btn btn-primary py-4 text-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {verifying ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Verifying...
              </>
            ) : (
              'Enter'
            )}
          </button>
        </form>

        <p className="text-center text-gray-400 text-sm mt-6">
          Contact your manager if you forgot the PIN
        </p>
      </div>
    </div>
  );
}
