import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { CheckCircle, Clock, Coffee, ArrowLeft, Loader2, WifiOff, Laptop, XCircle } from 'lucide-react';
import { orderAPI } from '../utils/api';
import { formatPriceFromDollars, formatPickupNumber, formatTime } from '../utils/formatters';
import GradientMesh from '../components/glass/GradientMesh';
import GlassPanel from '../components/glass/GlassPanel';
import CancelReasonModal from '../components/CancelReasonModal';

const SOCKET_URL = import.meta.env.VITE_WS_URL ||
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001');

export default function ConfirmationPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelNotice, setCancelNotice] = useState(null);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  async function handleCustomerCancel(reason) {
    const result = await orderAPI.cancel(orderId, reason);
    setOrder(result.order);
    setShowCancelModal(false);
    localStorage.removeItem('muze_last_order');
  }

  useEffect(() => {
    loadOrder();

    function connectSocket() {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (socketRef.current) socketRef.current.disconnect();

      socketRef.current = io(SOCKET_URL, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        reconnectionAttempts: 10,
        timeout: 10000,
      });

      socketRef.current.on('connect', () => {
        setConnected(true);
        setReconnectAttempt(0);
        loadOrder();
      });
      socketRef.current.on('disconnect', () => setConnected(false));
      socketRef.current.on('connect_error', () => setConnected(false));
      socketRef.current.on('order-updated', (updatedOrder) => {
        if (updatedOrder.id === parseInt(orderId)) {
          setOrder(updatedOrder);
          if (updatedOrder.status === 'completed' || updatedOrder.status === 'cancelled') {
            localStorage.removeItem('muze_last_order');
          }
        }
      });
    }

    connectSocket();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      socketRef.current?.disconnect();
    };
  }, [orderId]);

  async function loadOrder() {
    try {
      const data = await orderAPI.get(orderId);
      setOrder(data);
      if (data.status === 'completed' || data.status === 'cancelled') {
        localStorage.removeItem('muze_last_order');
      }
    } catch (err) {
      console.error('Failed to load order:', err);
      setError('Order not found');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <GradientMesh />
        <Loader2 className="w-10 h-10 animate-spin text-muze-brown relative z-10" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <GradientMesh />
        <div className="text-center relative z-10">
          <p className="text-red-600 mb-4">{error || 'Order not found'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 rounded-full bg-muze-dark text-muze-gold font-semibold hover:bg-muze-brown hover:text-white transition-colors"
          >
            Return to Menu
          </button>
        </div>
      </div>
    );
  }

  const statusConfig = {
    pending:    { icon: Clock,       color: 'text-muze-brown', bg: 'bg-muze-gold/30',  label: 'Order Received', description: 'We\'re getting started on your order!' },
    preparing:  { icon: Coffee,      color: 'text-muze-brown', bg: 'bg-muze-brown/20', label: 'Preparing',       description: 'Your order is being prepared.' },
    ready:      { icon: CheckCircle, color: 'text-green-700',  bg: 'bg-green-100',     label: 'Ready for Pickup',description: 'Your order is ready! Come pick it up.' },
    completed:  { icon: CheckCircle, color: 'text-muze-dark/70', bg: 'bg-gray-100',    label: 'Completed',       description: 'Thank you for your order!' },
    cancelled:  { icon: XCircle,     color: 'text-red-600',    bg: 'bg-red-100',       label: 'Cancelled',       description: 'This order was cancelled. You weren\'t charged.' },
  };
  const status = statusConfig[order.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen pb-12 relative">
      <GradientMesh />

      {/* Header */}
      <header className="px-4 py-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-muze-dark/70 hover:text-muze-dark transition-colors text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Start a new order
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {/* Hero: Glass success card */}
        <GlassPanel intensity="hero" panelClassName="px-6 py-8 sm:px-8 sm:py-10 text-center" overLight>
          <div className={`w-20 h-20 rounded-full ${status.bg} mx-auto flex items-center justify-center mb-4`}>
            <StatusIcon className={`w-10 h-10 ${status.color}`} strokeWidth={1.8} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-muze-dark mb-1">
            Order Confirmed!
          </h1>
          <p className="text-muze-dark/70 mb-6">Thank you, {order.customer_name}.</p>

          <p className="text-muze-dark/60 uppercase text-xs tracking-[0.2em] mb-2">Pickup Number</p>
          <p className="text-7xl sm:text-8xl font-black text-muze-brown leading-none">
            {formatPickupNumber(order.pickup_number)}
          </p>

          <div className={`inline-flex items-center gap-2 mt-6 px-4 py-2 rounded-full ${status.bg} ${status.color}`}>
            <StatusIcon className="w-4 h-4" />
            <span className="font-bold text-sm">{status.label}</span>
          </div>
          <p className="text-muze-dark/70 mt-3 text-sm">{status.description}</p>

          {/* Live updates indicator */}
          <div className={`inline-flex items-center gap-2 mt-5 text-xs ${connected ? 'text-green-700' : 'text-muze-dark/40'}`}>
            {connected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                Live updates active
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 animate-pulse" />
                {reconnectAttempt > 0 ? `Reconnecting (${reconnectAttempt})…` : 'Reconnecting…'}
              </>
            )}
          </div>
        </GlassPanel>

        {/* Cancel order — only while still pending */}
        {order.status === 'pending' && (
          <div className="mt-4 rounded-2xl bg-white/85 backdrop-blur-sm border border-white/70 shadow-sm p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-muze-dark">Made a mistake?</p>
              <p className="text-xs text-muze-dark/60">You can cancel until the kitchen starts preparing it.</p>
            </div>
            <button
              onClick={() => setShowCancelModal(true)}
              className="px-4 py-2 rounded-full border border-red-300 text-red-700 text-sm font-semibold hover:bg-red-50 transition-colors flex-shrink-0"
            >
              Cancel order
            </button>
          </div>
        )}

        {/* "Too late" notice if customer tried to cancel after kitchen started */}
        {cancelNotice && (
          <div className="mt-4 rounded-2xl bg-yellow-50 border border-yellow-300 p-4 text-sm text-yellow-900">
            {cancelNotice}
          </div>
        )}

        {/* Order details — solid card */}
        <div className="rounded-2xl bg-white/85 backdrop-blur-sm border border-white/70 shadow-sm p-6 mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-muze-dark text-lg">Order Details</h3>
            <span className="text-sm text-muze-dark/60">{formatTime(order.created_at)}</span>
          </div>

          <div className="space-y-3">
            {order.items?.map((item, index) => (
              <div key={index} className="flex justify-between gap-3 pb-3 border-b border-muze-gold/10 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-semibold text-muze-dark">
                    {item.quantity}× {item.item_name}
                  </p>
                  {item.modifiers && (
                    <p className="text-sm text-muze-dark/60">{item.modifiers}</p>
                  )}
                  {item.special_instructions && (
                    <p className="text-sm text-muze-dark/40 italic">
                      "{item.special_instructions}"
                    </p>
                  )}
                </div>
                <span className="font-medium text-muze-dark whitespace-nowrap">
                  {formatPriceFromDollars(item.total_price)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-muze-gold/20 space-y-2">
            <div className="flex justify-between text-muze-dark/70">
              <span>Subtotal</span>
              <span>{formatPriceFromDollars(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muze-dark/70">
              <span>Tax</span>
              <span>{formatPriceFromDollars(order.tax)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-muze-gold/20">
              <span className="text-muze-dark">Total · Pay at pickup</span>
              <span className="text-muze-brown">{formatPriceFromDollars(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-2xl bg-white/85 border border-white/70 p-4 text-center">
            <Clock className="w-6 h-6 text-muze-brown mx-auto mb-2" strokeWidth={1.8} />
            <p className="text-xs text-muze-dark/60 uppercase tracking-wider">Estimated Wait</p>
            <p className="font-bold text-muze-dark mt-1">10–15 mins</p>
          </div>
          <div className="rounded-2xl bg-white/85 border border-white/70 p-4 text-center">
            <Coffee className="w-6 h-6 text-muze-brown mx-auto mb-2" strokeWidth={1.8} />
            <p className="text-xs text-muze-dark/60 uppercase tracking-wider">Pickup At</p>
            <p className="font-bold text-muze-dark mt-1">Muze Café</p>
          </div>
        </div>

        {/* Coworking pass */}
        <div className="rounded-2xl bg-gradient-to-r from-muze-gold/20 to-muze-peach/30 border border-muze-gold/30 p-4 mt-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muze-gold/40 flex items-center justify-center flex-shrink-0">
              <Laptop className="w-6 h-6 text-muze-dark" strokeWidth={1.8} />
            </div>
            <div>
              <p className="font-bold text-muze-dark">Complimentary Coworking</p>
              <p className="text-sm text-muze-dark/70">Your order includes 30 minutes of coworking space access.</p>
            </div>
          </div>
        </div>

        {/* New order */}
        <button
          onClick={() => navigate('/')}
          className="w-full mt-8 py-4 rounded-2xl border-2 border-muze-brown/30 text-muze-brown font-bold hover:bg-muze-brown hover:text-white hover:border-muze-brown transition-colors"
        >
          Start New Order
        </button>
      </main>

      {showCancelModal && (
        <CancelReasonModal
          audience="customer"
          pickupNumber={formatPickupNumber(order.pickup_number)}
          onConfirm={async (reason) => {
            try {
              await handleCustomerCancel(reason);
            } catch (err) {
              // Surface "too late" gracefully — if the kitchen started preparing
              // between modal open and confirm, refresh the page state so the
              // cancel UI hides itself and show a soft notice.
              if (/already being prepared/i.test(err.message)) {
                setCancelNotice('This order just started being prepared — please come to the counter for help.');
                setShowCancelModal(false);
                loadOrder();
                return;
              }
              throw err;
            }
          }}
          onClose={() => setShowCancelModal(false)}
        />
      )}
    </div>
  );
}
