import { useState } from 'react';
import { X, RefreshCw, AlertTriangle } from 'lucide-react';

const CUSTOMER_REASONS = [
  'Ordered by accident',
  'Changed my mind',
  'Wrong item',
  'Waiting too long',
  'Other',
];

const STAFF_REASONS = [
  'Out of stock',
  'Customer no-show',
  'Duplicate order',
  'Customer request (in person)',
  'Equipment issue',
  'Other',
];

/**
 * Reason-capture modal used for both customer-initiated cancellation
 * (rendered light over the menu/glass aesthetic) and staff-initiated
 * cancellation from the kitchen display (rendered dark to match the KDS).
 *
 * Props:
 *   audience: 'customer' | 'staff'   — picks preset list + visual theme
 *   pickupNumber: string             — shown in the heading for confirmation
 *   onConfirm: (reason) => Promise   — called with final reason string
 *   onClose: () => void
 */
export default function CancelReasonModal({ audience, pickupNumber, onConfirm, onClose }) {
  const presets = audience === 'staff' ? STAFF_REASONS : CUSTOMER_REASONS;
  const [selected, setSelected] = useState(presets[0]);
  const [other, setOther] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isOther = selected === 'Other';
  const otherValid = !isOther || other.trim().length > 0;
  const reasonToSend = isOther ? other.trim() : selected;

  async function handleConfirm() {
    if (submitting || !otherValid) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(reasonToSend);
    } catch (err) {
      setError(err.message || 'Failed to cancel order');
      setSubmitting(false);
    }
  }

  const staff = audience === 'staff';
  const overlay = staff ? 'bg-black/70' : 'bg-muze-dark/60';
  const card = staff
    ? 'bg-gray-800 border border-white/10 text-white'
    : 'bg-white/95 backdrop-blur-sm border border-white/70 text-muze-dark';
  const inputBg = staff
    ? 'bg-gray-900 border border-white/10 text-white placeholder-white/30 focus:ring-red-500'
    : 'bg-white border border-muze-gold/30 text-muze-dark placeholder-muze-dark/30 focus:ring-muze-brown';
  const presetIdle = staff
    ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white/80'
    : 'border-muze-gold/30 bg-white hover:bg-muze-cream text-muze-dark';
  const presetActive = staff
    ? 'border-red-400 bg-red-500/20 text-white'
    : 'border-muze-brown bg-muze-brown/10 text-muze-brown';
  const cancelBtn = staff
    ? 'bg-white/10 hover:bg-white/15 text-white'
    : 'border border-muze-brown/30 text-muze-brown hover:bg-muze-brown/10';
  const confirmBtn = 'bg-red-600 hover:bg-red-700 text-white';

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${overlay}`}>
      <div className={`rounded-2xl max-w-md w-full p-6 shadow-xl ${card}`}>
        <div className="flex items-start gap-3 mb-4">
          <div className={`p-2 rounded-lg ${staff ? 'bg-red-500/20' : 'bg-red-100'}`}>
            <AlertTriangle className={`w-6 h-6 ${staff ? 'text-red-400' : 'text-red-600'}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold">
              {staff ? 'Cancel this order?' : 'Cancel your order?'}
            </h3>
            <p className={`text-sm mt-1 ${staff ? 'text-white/70' : 'text-muze-dark/70'}`}>
              {staff
                ? `Pickup #${pickupNumber}. The customer will be notified by email if one was provided.`
                : `Pickup #${pickupNumber}. You won't be charged. We'll send a confirmation to your email.`}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className={`p-1 rounded-lg ${staff ? 'hover:bg-white/10 text-white/60' : 'hover:bg-muze-cream text-muze-dark/60'}`}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <label className={`block text-sm font-medium mb-2 ${staff ? 'text-white/80' : 'text-muze-dark/80'}`}>
          Reason
        </label>
        <div className="grid grid-cols-1 gap-2">
          {presets.map(reason => (
            <button
              key={reason}
              onClick={() => setSelected(reason)}
              disabled={submitting}
              className={`text-left px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                selected === reason ? presetActive : presetIdle
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {reason}
            </button>
          ))}
        </div>

        {isOther && (
          <div className="mt-3">
            <input
              autoFocus
              type="text"
              value={other}
              onChange={(e) => setOther(e.target.value.slice(0, 200))}
              placeholder="Tell us briefly…"
              maxLength={200}
              className={`w-full p-3 rounded-lg focus:outline-none focus:ring-2 ${inputBg}`}
            />
            <p className={`text-xs mt-1 ${staff ? 'text-white/40' : 'text-muze-dark/40'}`}>{other.length}/200</p>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-500">{error}</p>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={submitting}
            className={`flex-1 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 ${cancelBtn}`}
          >
            Keep order
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting || !otherValid}
            className={`flex-1 py-2.5 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${confirmBtn}`}
          >
            {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
            {submitting ? 'Cancelling…' : 'Cancel order'}
          </button>
        </div>
      </div>
    </div>
  );
}
