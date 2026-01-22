import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Clock, ChefHat, CheckCircle, Bell, Volume2, VolumeX, RefreshCw, LogOut } from 'lucide-react';
import { orderAPI, adminAPI, isAuthenticated as checkAuth } from '../utils/api';
import { formatPickupNumber, formatTimeSince } from '../utils/formatters';
import PinEntry from '../components/PinEntry';

// In production, connect to same origin; in dev, use localhost:3001
const SOCKET_URL = import.meta.env.VITE_WS_URL ||
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001');

export default function KitchenDisplay() {
  const [authState, setAuthState] = useState('checking'); // 'checking' | 'authenticated' | 'unauthenticated'
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [connected, setConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [updateError, setUpdateError] = useState(null);
  const socketRef = useRef(null);
  const audioRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Verify authentication on mount
  useEffect(() => {
    verifyAuth();
  }, []);

  async function verifyAuth() {
    if (!checkAuth()) {
      setAuthState('unauthenticated');
      return;
    }

    try {
      // Verify token is still valid with server
      await adminAPI.verifyToken();
      setAuthState('authenticated');
    } catch (err) {
      // Token invalid or expired
      console.log('Token verification failed:', err.message);
      setAuthState('unauthenticated');
    }
  }

  // Update clock every second
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  function handleLogout() {
    adminAPI.logout();
    setAuthState('unauthenticated');
  }

  function handleAuthSuccess() {
    setAuthState('authenticated');
  }

  // Setup WebSocket and load orders when authenticated
  // FIX: Added authState to dependency array so socket connects after authentication
  useEffect(() => {
    if (authState !== 'authenticated') return;

    // Initialize Web Audio API for notification sound
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioRef.current = audioContext;

    // Load initial orders
    loadOrders();

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
        console.log('Connected to server');
        setConnected(true);
        setReconnectAttempt(0);
        // Reload orders when reconnecting to ensure we're in sync
        loadOrders();
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

      socketRef.current.on('new-order', (order) => {
        console.log('New order:', order);
        setOrders(prev => [order, ...prev]);
        playNotification();
      });

      socketRef.current.on('order-updated', (updatedOrder) => {
        console.log('Order updated:', updatedOrder);
        setOrders(prev =>
          prev.map(o => o.id === updatedOrder.id ? updatedOrder : o)
            .filter(o => o.status !== 'completed' && o.status !== 'cancelled')
        );
      });
    }

    // Initial connection
    connectSocket();

    // Refresh orders periodically as fallback
    const interval = setInterval(loadOrders, 30000);

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      socketRef.current?.disconnect();
      clearInterval(interval);
    };
  }, [authState]);

  async function loadOrders() {
    try {
      const data = await orderAPI.getActive();
      setOrders(data);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  }

  function playNotification() {
    if (soundEnabled && audioRef.current) {
      try {
        const audioContext = audioRef.current;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);

        // Play a second beep
        setTimeout(() => {
          const osc2 = audioContext.createOscillator();
          const gain2 = audioContext.createGain();
          osc2.connect(gain2);
          gain2.connect(audioContext.destination);
          osc2.frequency.value = 1000;
          osc2.type = 'sine';
          gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
          osc2.start(audioContext.currentTime);
          osc2.stop(audioContext.currentTime + 0.3);
        }, 200);
      } catch (err) {
        console.error('Audio error:', err);
      }
    }
  }

  async function updateStatus(orderId, newStatus) {
    setUpdatingOrderId(orderId);
    setUpdateError(null);
    try {
      console.log(`Updating order ${orderId} to ${newStatus}...`);
      await orderAPI.updateStatus(orderId, newStatus);
      console.log(`Order ${orderId} updated successfully`);
      // The WebSocket will update the UI
    } catch (err) {
      console.error('Failed to update status:', err);
      setUpdateError(`Failed to update order: ${err.message}`);
      // Reload orders to ensure UI is in sync
      loadOrders();
    } finally {
      setUpdatingOrderId(null);
    }
  }

  // Sort orders by created_at (oldest first) within each status group
  const sortByTime = (a, b) => new Date(a.created_at) - new Date(b.created_at);

  const pendingOrders = orders.filter(o => o.status === 'pending').sort(sortByTime);
  const preparingOrders = orders.filter(o => o.status === 'preparing').sort(sortByTime);
  const readyOrders = orders.filter(o => o.status === 'ready').sort(sortByTime);

  if (authState === 'checking') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-muze-gold" />
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return <PinEntry onSuccess={handleAuthSuccess} title="Kitchen Access" />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-muze-primary px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ChefHat className="w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold">Kitchen Display</h1>
            <p className="text-sm text-white/70">Muze Office</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
            connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`} />
            {connected ? 'Live' : reconnectAttempt > 0 ? `Reconnecting (${reconnectAttempt})` : 'Disconnected'}
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg ${soundEnabled ? 'bg-white/10' : 'bg-white/5 text-white/50'}`}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* Refresh */}
          <button
            onClick={loadOrders}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          {/* Time */}
          <div className="text-xl font-mono">
            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Orders Grid */}
      <main className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-[60vh]">
            <RefreshCw className="w-8 h-8 animate-spin text-white/50" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-white/50">
            <Bell className="w-16 h-16 mb-4" />
            <p className="text-xl">No active orders</p>
            <p className="text-sm">Orders will appear here when customers place them</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Error Message */}
            {updateError && (
              <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 flex items-center justify-between">
                <span className="text-red-300">{updateError}</span>
                <button
                  onClick={() => setUpdateError(null)}
                  className="text-red-300 hover:text-white"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Pending Orders Section */}
            {pendingOrders.length > 0 && (
              <section>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-yellow-400">
                  <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
                  Pending ({pendingOrders.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pendingOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      currentTime={currentTime}
                      onStart={() => updateStatus(order.id, 'preparing')}
                      isUpdating={updatingOrderId === order.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Preparing Orders Section */}
            {preparingOrders.length > 0 && (
              <section>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-400">
                  <span className="w-3 h-3 rounded-full bg-blue-400"></span>
                  Preparing ({preparingOrders.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {preparingOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      currentTime={currentTime}
                      onComplete={() => updateStatus(order.id, 'ready')}
                      isUpdating={updatingOrderId === order.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Ready Orders Section */}
            {readyOrders.length > 0 && (
              <section>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-green-400">
                  <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></span>
                  Ready for Pickup ({readyOrders.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {readyOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      currentTime={currentTime}
                      onPickup={() => updateStatus(order.id, 'completed')}
                      isUpdating={updatingOrderId === order.id}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Status Summary */}
      <footer className="fixed bottom-0 left-0 right-0 bg-muze-primary px-6 py-4">
        <div className="flex justify-center gap-8">
          <StatusBadge label="Pending" count={pendingOrders.length} color="yellow" />
          <StatusBadge label="Preparing" count={preparingOrders.length} color="blue" />
          <StatusBadge label="Ready" count={readyOrders.length} color="green" />
        </div>
      </footer>
    </div>
  );
}

function OrderCard({ order, currentTime, onStart, onComplete, onPickup, isUpdating }) {
  const statusColors = {
    pending: 'border-yellow-500 bg-yellow-500/10',
    preparing: 'border-blue-500 bg-blue-500/10',
    ready: 'border-green-500 bg-green-500/10 animate-pulse-soft',
  };

  // Calculate time since order was created (updates every second via currentTime prop)
  const timeSince = formatTimeSince(order.created_at);

  return (
    <div className={`rounded-2xl border-2 ${statusColors[order.status]} overflow-hidden`}>
      {/* Header */}
      <div className="bg-white/5 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-3xl font-bold">{formatPickupNumber(order.pickup_number)}</p>
          <p className="text-lg text-white/70">{order.customer_name}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-white/50">
            <Clock className="w-4 h-4" />
            <span className="text-sm">{timeSince}</span>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="p-4 space-y-3">
        {order.items?.map((item, i) => (
          <div key={i} className="text-lg">
            <p className="font-medium">
              <span className="text-white/50">{item.quantity}x</span> {item.item_name}
            </p>
            {item.modifiers && (
              <p className="text-sm text-white/50 ml-6">{item.modifiers}</p>
            )}
            {item.special_instructions && (
              <p className="text-sm text-yellow-400 ml-6 italic">
                ⚠️ {item.special_instructions}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Action Button */}
      <div className="p-4 pt-0">
        {order.status === 'pending' && (
          <button
            onClick={onStart}
            disabled={isUpdating}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg transition-colors flex items-center justify-center gap-2"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Updating...
              </>
            ) : (
              'Start Preparing'
            )}
          </button>
        )}
        {order.status === 'preparing' && (
          <button
            onClick={onComplete}
            disabled={isUpdating}
            className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg transition-colors flex items-center justify-center gap-2"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Mark Ready
              </>
            )}
          </button>
        )}
        {order.status === 'ready' && (
          <button
            onClick={onPickup}
            disabled={isUpdating}
            className="w-full py-3 rounded-xl bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg transition-colors flex items-center justify-center gap-2"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Updating...
              </>
            ) : (
              'Order Picked Up'
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ label, count, color }) {
  const colors = {
    yellow: 'bg-yellow-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
  };

  return (
    <div className="flex items-center gap-3">
      <span className={`w-3 h-3 rounded-full ${colors[color]}`} />
      <span className="text-white/70">{label}</span>
      <span className="text-2xl font-bold">{count}</span>
    </div>
  );
}
