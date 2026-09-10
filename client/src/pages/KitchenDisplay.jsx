import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, ChefHat, CheckCircle, Bell, Volume2, VolumeX, RefreshCw, LogOut, Lock, Unlock, X } from 'lucide-react';
import { orderAPI, adminAPI } from '../utils/api';
import { supabase } from '../lib/supabase';
import { formatPickupNumber, formatTimeSince } from '../utils/formatters';
import StaffSignIn from '../components/StaffSignIn';
import { useStaffAccess } from '../hooks/useStaffAccess';
import CancelReasonModal from '../components/CancelReasonModal';

export default function KitchenDisplay() {
  const { authState, authError } = useStaffAccess('staff');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [connected, setConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [updateError, setUpdateError] = useState(null);
  const [kitchenOpen, setKitchenOpen] = useState(true);
  const [kitchenClosedMessage, setKitchenClosedMessage] = useState('');
  const [kitchenToggling, setKitchenToggling] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeMessageDraft, setCloseMessageDraft] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null); // order to cancel
  const audioRef = useRef(null);
  const soundEnabledRef = useRef(soundEnabled);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Update clock every second
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  async function handleLogout() {
    await adminAPI.logout();
  }

  const loadOrders = useCallback(async () => {
    try {
      const data = await orderAPI.getActive();
      setOrders(data);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadKitchenStatus = useCallback(async () => {
    try {
      const status = await orderAPI.getKitchenStatus();
      setKitchenOpen(!!status.open);
      setKitchenClosedMessage(status.message || '');
    } catch (err) {
      console.error('Failed to load kitchen status:', err);
    }
  }, []);

  const playNotification = useCallback(() => {
    if (!soundEnabledRef.current || !audioRef.current) return;
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

      setTimeout(() => {
        if (audioContext.state === 'closed') return;
        const secondOscillator = audioContext.createOscillator();
        const secondGain = audioContext.createGain();
        secondOscillator.connect(secondGain);
        secondGain.connect(audioContext.destination);
        secondOscillator.frequency.value = 1000;
        secondOscillator.type = 'sine';
        secondGain.gain.setValueAtTime(0.3, audioContext.currentTime);
        secondGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        secondOscillator.start(audioContext.currentTime);
        secondOscillator.stop(audioContext.currentTime + 0.3);
      }, 200);
    } catch (err) {
      console.error('Audio error:', err);
    }
  }, []);

  // Subscribe to the private kitchen broadcast channel when authenticated.
  useEffect(() => {
    if (authState !== 'authenticated') return;

    // Initialize Web Audio API for notification sound
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioRef.current = audioContext;

    // Load initial orders + kitchen status
    const initialLoad = setTimeout(() => {
      loadOrders();
      loadKitchenStatus();
    }, 0);

    const refreshFromBroadcast = () => {
      loadOrders();
      loadKitchenStatus();
    };
    const channel = supabase
      .channel('kitchen', { config: { private: true } })
      .on('broadcast', { event: 'INSERT' }, () => {
        playNotification();
        refreshFromBroadcast();
      })
      .on('broadcast', { event: 'UPDATE' }, refreshFromBroadcast)
      .on('broadcast', { event: 'DELETE' }, refreshFromBroadcast)
      .subscribe(status => setConnected(status === 'SUBSCRIBED'));

    // Refresh orders periodically as fallback
    const interval = setInterval(loadOrders, 30000);

    return () => {
      setConnected(false);
      clearTimeout(initialLoad);
      supabase.removeChannel(channel);
      clearInterval(interval);
      audioContext.close();
    };
  }, [authState, loadKitchenStatus, loadOrders, playNotification]);

  async function toggleKitchen(open, message = '') {
    setKitchenToggling(true);
    setUpdateError(null);
    try {
      const status = await orderAPI.setKitchenStatus(open, message);
      setKitchenOpen(!!status.open);
      setKitchenClosedMessage(status.message || '');
      setShowCloseModal(false);
    } catch (err) {
      console.error('Failed to toggle kitchen:', err);
      setUpdateError(`Failed to update kitchen status: ${err.message}`);
    } finally {
      setKitchenToggling(false);
    }
  }

  async function updateStatus(order, newStatus) {
    setUpdatingOrderId(order.id);
    setUpdateError(null);
    try {
      console.log(`Updating order ${order.public_id} to ${newStatus}...`);
      await orderAPI.updateStatus(order.public_id, newStatus);
      console.log(`Order ${order.public_id} updated successfully`);
      await loadOrders();
    } catch (err) {
      console.error('Failed to update status:', err);
      setUpdateError(`Failed to update order: ${err.message}`);
      // Reload orders to ensure UI is in sync
      loadOrders();
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function staffCancelOrder(reason) {
    if (!cancelTarget) return;
    setUpdatingOrderId(cancelTarget.id);
    try {
      await orderAPI.updateStatus(cancelTarget.public_id, 'cancelled', reason);
      setCancelTarget(null);
    } catch (err) {
      console.error('Failed to cancel order:', err);
      setUpdateError(`Failed to cancel order: ${err.message}`);
      throw err;
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
    return <StaffSignIn title="Kitchen Access" destination="/kitchen" authError={authError} />;
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
            {connected ? 'Live' : 'Disconnected'}
          </div>

          {/* Kitchen Open/Closed Toggle */}
          <button
            onClick={() => kitchenOpen ? setShowCloseModal(true) : toggleKitchen(true)}
            disabled={kitchenToggling}
            title={kitchenOpen ? 'Close ordering — customers can\'t place new orders' : 'Re-open ordering'}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              kitchenOpen
                ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                : 'bg-red-500/30 text-red-200 hover:bg-red-500/40 ring-1 ring-red-400/50'
            }`}
          >
            {kitchenOpen ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {kitchenOpen ? 'Ordering Open' : 'Ordering Closed'}
          </button>

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

      {/* Closed Banner */}
      {!kitchenOpen && (
        <div className="bg-red-600 text-white px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5" />
            <div>
              <p className="font-semibold">Online ordering is closed</p>
              <p className="text-sm text-red-100">
                {kitchenClosedMessage || 'Customers cannot place new orders right now. Existing orders can still be processed.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleKitchen(true)}
            disabled={kitchenToggling}
            className="px-4 py-2 rounded-lg bg-white text-red-600 font-semibold hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {kitchenToggling ? 'Opening...' : 'Re-open ordering'}
          </button>
        </div>
      )}

      {/* Close Kitchen Confirmation Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl max-w-md w-full p-6 border border-white/10">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-lg bg-red-500/20">
                <Lock className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Close online ordering?</h3>
                <p className="text-sm text-white/70 mt-1">
                  Customers won't be able to place new orders until you re-open. Orders already in the queue keep flowing.
                </p>
              </div>
            </div>

            <label className="block text-sm font-medium text-white/80 mb-2 mt-4">
              Message for customers (optional)
            </label>
            <textarea
              value={closeMessageDraft}
              onChange={(e) => setCloseMessageDraft(e.target.value.slice(0, 200))}
              placeholder="e.g. We're catching up on orders — back in 15 min!"
              className="w-full p-3 rounded-lg bg-gray-900 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-red-500"
              rows={3}
              maxLength={200}
            />
            <p className="text-xs text-white/40 mt-1">{closeMessageDraft.length}/200</p>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowCloseModal(false); setCloseMessageDraft(''); }}
                className="flex-1 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 transition-colors"
                disabled={kitchenToggling}
              >
                Cancel
              </button>
              <button
                onClick={() => toggleKitchen(false, closeMessageDraft)}
                disabled={kitchenToggling}
                className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {kitchenToggling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Close ordering
              </button>
            </div>
          </div>
        </div>
      )}

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
                      onStart={() => updateStatus(order, 'preparing')}
                      isUpdating={updatingOrderId === order.id}
                      onCancel={() => setCancelTarget(order)}
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
                      onComplete={() => updateStatus(order, 'ready')}
                      isUpdating={updatingOrderId === order.id}
                      onCancel={() => setCancelTarget(order)}
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
                      onPickup={() => updateStatus(order, 'completed')}
                      isUpdating={updatingOrderId === order.id}
                      onCancel={() => setCancelTarget(order)}
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

      {cancelTarget && (
        <CancelReasonModal
          audience="staff"
          pickupNumber={formatPickupNumber(cancelTarget.pickup_number)}
          onConfirm={staffCancelOrder}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </div>
  );
}

function OrderCard({ order, onStart, onComplete, onPickup, onCancel, isUpdating }) {
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

        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isUpdating}
            className="mt-2 w-full py-2 rounded-lg text-red-300 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4" />
            Cancel order
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
