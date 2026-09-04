import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, Coffee, ArrowLeft, Loader2, Laptop, XCircle } from 'lucide-react';
import { orderAPI } from '../utils/api';
import { formatPriceFromDollars, formatPickupNumber, formatTime } from '../utils/formatters';
import GradientMesh from '../components/glass/GradientMesh';
import GlassPanel from '../components/glass/GlassPanel';
import CancelReasonModal from '../components/CancelReasonModal';
import PortalHomeLink from '../components/PortalHomeLink';
import { getPartnerSchedule } from '../utils/partnerSchedule';

export default function ConfirmationPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelNotice, setCancelNotice] = useState(null);

  async function handleCustomerCancel(reason) {
    const result = await orderAPI.cancel(orderId, reason);
    setOrder(result.order);
    setShowCancelModal(false);
    localStorage.removeItem(`muze_last_order_${result.order.channel || 'cafe'}`);
  }

  const loadOrder = useCallback(async () => {
    try {
      const data = await orderAPI.get(orderId);
      setOrder(data);
      if (['paid', 'authorized'].includes(data.payment_status)) {
        localStorage.removeItem(`muze_cart_${data.channel || 'cafe'}`);
      }
      setError(null);
      if (data.status === 'completed' || data.status === 'cancelled') {
        localStorage.removeItem(`muze_last_order_${data.channel || 'cafe'}`);
      }
    } catch (err) {
      console.error('Failed to load order:', err);
      setError('Order not found');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    const initialLoad = setTimeout(loadOrder, 0);
    const poll = setInterval(loadOrder, 10000);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(poll);
    };
  }, [loadOrder]);

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
            Back to all menus
          </button>
        </div>
      </div>
    );
  }

  const isPartnerPreorder = order.channel === 'partner_meal';
  const preorderSchedule = isPartnerPreorder
    ? getPartnerSchedule(order.preorder_delivery_date)
    : null;
  const statusConfig = isPartnerPreorder ? {
    pending:    { icon: Clock,       color: 'text-muze-brown', bg: 'bg-muze-gold/30',  label: 'Pre-Order Reserved', description: 'Your weekly meal pre-order is reserved for Monday delivery to Muze.' },
    preparing:  { icon: Coffee,      color: 'text-muze-brown', bg: 'bg-muze-brown/20', label: 'Partner Preparing', description: 'Down to Earth Cuisine is preparing the weekly meal order.' },
    ready:      { icon: CheckCircle, color: 'text-green-700',  bg: 'bg-green-100',     label: 'Ready for Pickup', description: 'Your pre-ordered meal is ready at Muze.' },
    completed:  { icon: CheckCircle, color: 'text-muze-dark/70', bg: 'bg-gray-100',    label: 'Completed',       description: 'Thank you for your weekly meal pre-order!' },
    cancelled:  { icon: XCircle,     color: 'text-red-600',    bg: 'bg-red-100',       label: 'Cancelled',       description: 'This pre-order was cancelled.' },
  } : {
    pending:    { icon: Clock,       color: 'text-muze-brown', bg: 'bg-muze-gold/30',  label: 'Order Received', description: 'We\'re getting started on your order!' },
    preparing:  { icon: Coffee,      color: 'text-muze-brown', bg: 'bg-muze-brown/20', label: 'Preparing',       description: 'Your order is being prepared.' },
    ready:      { icon: CheckCircle, color: 'text-green-700',  bg: 'bg-green-100',     label: 'Ready for Pickup',description: 'Your order is ready! Come pick it up.' },
    completed:  { icon: CheckCircle, color: 'text-muze-dark/70', bg: 'bg-gray-100',    label: 'Completed',       description: 'Thank you for your order!' },
    cancelled:  { icon: XCircle,     color: 'text-red-600',    bg: 'bg-red-100',       label: 'Cancelled',       description: 'This order was cancelled. You weren\'t charged.' },
  };
  const paymentConfirmed = ['paid', 'authorized'].includes(order.payment_status);
  const status = paymentConfirmed
    ? (statusConfig[order.status] || statusConfig.pending)
    : {
        icon: Clock,
        color: 'text-muze-brown',
        bg: 'bg-muze-gold/30',
        label: order.payment_status === 'failed' ? 'Payment Failed' : 'Confirming Payment',
        description: order.payment_status === 'failed'
          ? 'Your order has not been sent for preparation.'
          : 'We are waiting for secure payment confirmation.',
      };
  const StatusIcon = status.icon;
  const storefrontPath = order.channel === 'partner_meal' ? '/partner-meals' : '/cafe';

  return (
    <div className="min-h-screen pb-12 relative">
      <GradientMesh />

      {/* Header */}
      <header className="px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <button
            onClick={() => navigate(storefrontPath)}
            className="flex items-center gap-2 text-muze-dark/70 hover:text-muze-dark transition-colors text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Start a new order
          </button>
          <PortalHomeLink label="Home" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {/* Hero: Glass success card */}
        <GlassPanel intensity="hero" panelClassName="px-6 py-8 sm:px-8 sm:py-10 text-center" overLight>
          <div className={`w-20 h-20 rounded-full ${status.bg} mx-auto flex items-center justify-center mb-4`}>
            <StatusIcon className={`w-10 h-10 ${status.color}`} strokeWidth={1.8} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-muze-dark mb-1">
            {paymentConfirmed ? (isPartnerPreorder ? 'Weekly Meal Pre-Order Confirmed!' : 'Order Confirmed!') : status.label}
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

          {/* Status is refreshed over the ownership-checked HTTP endpoint. */}
          <div className="inline-flex items-center gap-2 mt-5 text-xs text-muze-dark/40">
            Status refreshes automatically
          </div>
        </GlassPanel>

        {preorderSchedule ? (
          <div className="mt-6 rounded-2xl border-2 border-muze-gold bg-amber-50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muze-brown">Weekly meal pre-order schedule</p>
            <p className="mt-2 font-bold text-muze-dark">Delivered to Muze for pickup: {preorderSchedule.deliveryLabel}</p>
            <p className="mt-1 text-sm text-muze-dark/75">Order deadline: {preorderSchedule.deadlineLabel}</p>
            <p className="mt-2 text-sm text-muze-dark/65">This is a meal prepared ahead for Monday, not an immediate café order. Your email receipt includes this schedule.</p>
          </div>
        ) : null}

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
              <span>{isPartnerPreorder ? 'Subtotal before tax' : 'Subtotal'}</span>
              <span>{formatPriceFromDollars(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muze-dark/70">
              <span>{isPartnerPreorder ? 'Nevada tax (included)' : 'Tax'}</span>
              <span>{formatPriceFromDollars(order.tax)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-muze-gold/20">
              <span className="text-muze-dark">
                Total · {paymentConfirmed ? `Paid with ${order.payment_provider === 'stripe' ? 'Stripe' : 'Square'}` : 'Payment pending'}
              </span>
              <span className="text-muze-brown">{formatPriceFromDollars(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-2xl bg-white/85 border border-white/70 p-4 text-center">
            <Clock className="w-6 h-6 text-muze-brown mx-auto mb-2" strokeWidth={1.8} />
            <p className="text-xs text-muze-dark/60 uppercase tracking-wider">{preorderSchedule ? 'Delivery Day' : 'Estimated Wait'}</p>
            <p className="font-bold text-muze-dark mt-1">{preorderSchedule ? preorderSchedule.deliveryLabel : '10–15 mins'}</p>
          </div>
          <div className="rounded-2xl bg-white/85 border border-white/70 p-4 text-center">
            <Coffee className="w-6 h-6 text-muze-brown mx-auto mb-2" strokeWidth={1.8} />
            <p className="text-xs text-muze-dark/60 uppercase tracking-wider">Pickup At</p>
            <p className="font-bold text-muze-dark mt-1">{preorderSchedule ? 'Muze Office' : 'Muze Café'}</p>
          </div>
        </div>

        {/* Cancel order — card-sized button, only while still pending */}
        {order.status === 'pending' && order.payment_method === 'cash' && (
          <button
            onClick={() => setShowCancelModal(true)}
            className="w-full mt-4 rounded-2xl border-2 border-red-300 hover:border-red-500 hover:bg-red-50 transition-colors p-4 flex items-center gap-3 text-left"
          >
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <XCircle className="w-6 h-6 text-red-600" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-red-700">Cancel this order</p>
              <p className="text-sm text-red-700/70">You can cancel until the kitchen starts preparing it.</p>
            </div>
          </button>
        )}

        {/* "Too late" notice if customer tried to cancel after kitchen started */}
        {cancelNotice && (
          <div className="mt-4 rounded-2xl bg-yellow-50 border border-yellow-300 p-4 text-sm text-yellow-900">
            {cancelNotice}
          </div>
        )}

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
          onClick={() => navigate(storefrontPath)}
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
