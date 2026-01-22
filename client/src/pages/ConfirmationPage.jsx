import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { CheckCircle, Clock, Coffee, ArrowLeft, Loader2, Wifi, WifiOff } from 'lucide-react';
import { orderAPI } from '../utils/api';
import { formatPriceFromDollars, formatPickupNumber, formatTime } from '../utils/formatters';

// In production, connect to same origin; in dev, use localhost:3001
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
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    loadOrder();

    // Connect to WebSocket with auto-reconnection
    function connectSocket() {
      // Clear any pending reconnect
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Disconnect existing socket if any
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      // Setup WebSocket with built-in reconnection options
      socketRef.current = io(SOCKET_URL, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        reconnectionAttempts: 10,
        timeout: 10000,
      });

      socketRef.current.on('connect', () => {
        console.log('Connected to server for order updates');
        setConnected(true);
        setReconnectAttempt(0);
        // Reload order when reconnecting to ensure we're in sync
        loadOrder();
      });

      socketRef.current.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        setConnected(false);
        // Socket.IO handles reconnection automatically with the configured settings
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('Connection error:', error.message);
        setConnected(false);
      });

      socketRef.current.on('order-updated', (updatedOrder) => {
        // Only update if it's our order
        if (updatedOrder.id === parseInt(orderId)) {
          console.log('Order status updated:', updatedOrder.status);
          setOrder(updatedOrder);

          // Clear saved order from localStorage if completed or cancelled
          if (updatedOrder.status === 'completed' || updatedOrder.status === 'cancelled') {
            localStorage.removeItem('muze_last_order');
          }
        }
      });
    }

    // Initial connection
    connectSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      socketRef.current?.disconnect();
    };
  }, [orderId]);

  async function loadOrder() {
    try {
      const data = await orderAPI.get(orderId);
      setOrder(data);

      // Clear saved order from localStorage if completed or cancelled
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
      <div className="min-h-screen bg-muze-cream flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muze-gold" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-muze-cream flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Order not found'}</p>
          <button onClick={() => navigate('/')} className="btn btn-primary">
            Return to Menu
          </button>
        </div>
      </div>
    );
  }

  const statusConfig = {
    pending: {
      icon: Clock,
      color: 'text-muze-gold',
      bg: 'bg-muze-gold/20',
      label: 'Order Received',
      description: 'We\'re getting started on your order!',
    },
    preparing: {
      icon: Coffee,
      color: 'text-muze-brown',
      bg: 'bg-muze-brown/20',
      label: 'Preparing',
      description: 'Your order is being prepared.',
    },
    ready: {
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-100',
      label: 'Ready for Pickup',
      description: 'Your order is ready! Come pick it up.',
    },
    completed: {
      icon: CheckCircle,
      color: 'text-gray-600',
      bg: 'bg-gray-100',
      label: 'Completed',
      description: 'Thank you for your order!',
    },
  };

  const status = statusConfig[order.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-muze-dark to-muze-brown">
      {/* Header */}
      <header className="p-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-muze-gold/80 hover:text-muze-gold transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          New Order
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Success Message */}
        <div className="text-center mb-8">
          <div className={`w-20 h-20 rounded-full ${status.bg} mx-auto flex items-center justify-center mb-4`}>
            <StatusIcon className={`w-10 h-10 ${status.color}`} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Order Confirmed!</h1>
          <p className="text-muze-gold/80">
            Thank you, {order.customer_name}!
          </p>
        </div>

        {/* Pickup Number */}
        <div className="card p-8 text-center mb-6">
          <p className="text-muze-brown/60 uppercase text-sm tracking-wider mb-2">Your Pickup Number</p>
          <p className="text-6xl font-bold text-muze-gold mb-4">
            {formatPickupNumber(order.pickup_number)}
          </p>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${status.bg} ${status.color}`}>
            <StatusIcon className="w-5 h-5" />
            <span className="font-medium">{status.label}</span>
          </div>
          <p className="text-muze-brown/70 mt-4">{status.description}</p>

          {/* Live Updates Indicator */}
          <div className={`inline-flex items-center gap-2 mt-4 text-sm ${connected ? 'text-green-600' : 'text-gray-400'}`}>
            {connected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Live updates active
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 animate-pulse" />
                {reconnectAttempt > 0 ? `Reconnecting (${reconnectAttempt})...` : 'Reconnecting...'}
              </>
            )}
          </div>
        </div>

        {/* Order Details */}
        <div className="card p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-muze-dark">Order Details</h3>
            <span className="text-sm text-muze-brown/60">
              {formatTime(order.created_at)}
            </span>
          </div>

          <div className="space-y-3">
            {order.items?.map((item, index) => (
              <div key={index} className="flex justify-between pb-3 border-b border-muze-gold/10 last:border-0 last:pb-0">
                <div>
                  <p className="font-medium text-muze-dark">
                    {item.quantity}x {item.item_name}
                  </p>
                  {item.modifiers && (
                    <p className="text-sm text-muze-brown/60">{item.modifiers}</p>
                  )}
                  {item.special_instructions && (
                    <p className="text-sm text-muze-brown/50 italic">
                      "{item.special_instructions}"
                    </p>
                  )}
                </div>
                <span className="font-medium text-muze-dark">
                  {formatPriceFromDollars(item.total_price)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-muze-gold/20 space-y-2">
            <div className="flex justify-between text-muze-brown/70">
              <span>Subtotal</span>
              <span>{formatPriceFromDollars(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muze-brown/70">
              <span>Tax</span>
              <span>{formatPriceFromDollars(order.tax)}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold pt-2 border-t border-muze-gold/20">
              <span className="text-muze-dark">Total (Pay at pickup)</span>
              <span className="text-muze-brown">{formatPriceFromDollars(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-4 text-center">
            <Clock className="w-6 h-6 text-muze-gold mx-auto mb-2" />
            <p className="text-sm text-muze-brown/60">Estimated Wait</p>
            <p className="font-semibold text-muze-dark">10-15 mins</p>
          </div>
          <div className="card p-4 text-center">
            <Coffee className="w-6 h-6 text-muze-gold mx-auto mb-2" />
            <p className="text-sm text-muze-brown/60">Pickup At</p>
            <p className="font-semibold text-muze-dark">Muze Café</p>
          </div>
        </div>

        {/* Start New Order */}
        <button
          onClick={() => navigate('/')}
          className="w-full mt-8 btn bg-white text-muze-brown border-2 border-muze-gold hover:bg-muze-gold hover:text-muze-dark py-4 transition-colors"
        >
          Start New Order
        </button>
      </main>
    </div>
  );
}
