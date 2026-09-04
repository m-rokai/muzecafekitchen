import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Navigate, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { CLOSED } from './config/closure';

const MenuPage = lazy(() => import('./pages/MenuPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const ConfirmationPage = lazy(() => import('./pages/ConfirmationPage'));
const KitchenDisplay = lazy(() => import('./pages/KitchenDisplay'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const ClosurePage = lazy(() => import('./pages/ClosurePage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const PartnerMealsPage = lazy(() => import('./pages/PartnerMealsPage'));

function App() {
  return (
    <Router>
      <Suspense fallback={<div className="min-h-screen bg-muze-dark" aria-label="Loading" />}>
        <Routes>
            {CLOSED ? (
              <>
                {/* Café offline — staff routes stay reachable, everything else
                    falls through to the closure screen. Toggle in config/closure.js. */}
                <Route path="/kitchen" element={<KitchenDisplay />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="*" element={<ClosurePage />} />
              </>
            ) : (
              <>
                <Route path="/" element={<LandingPage />} />
                <Route path="/cafe" element={<CartProvider channel="cafe"><MenuPage basePath="/cafe" /></CartProvider>} />
                <Route path="/cafe/cart" element={<CartProvider channel="cafe"><CartPage basePath="/cafe" channel="cafe" paymentProvider="Square" /></CartProvider>} />
                <Route path="/cafe/checkout" element={<CartProvider channel="cafe"><CheckoutPage basePath="/cafe" channel="cafe" paymentProvider="Square" /></CartProvider>} />
                <Route path="/partner-meals" element={<CartProvider channel="partner_meal"><PartnerMealsPage /></CartProvider>} />
                <Route path="/partner-meals/cart" element={<CartProvider channel="partner_meal"><CartPage basePath="/partner-meals" channel="partner_meal" paymentProvider="Stripe" /></CartProvider>} />
                <Route path="/partner-meals/checkout" element={<CartProvider channel="partner_meal"><CheckoutPage basePath="/partner-meals" channel="partner_meal" paymentProvider="Stripe" /></CartProvider>} />
                <Route path="/orders/:orderId" element={<ConfirmationPage />} />
                <Route path="/confirmation/:orderId" element={<ConfirmationPage />} />
                <Route path="/cart" element={<Navigate to="/cafe/cart" replace />} />
                <Route path="/checkout" element={<Navigate to="/cafe/checkout" replace />} />
                <Route path="/kitchen" element={<KitchenDisplay />} />
                <Route path="/admin" element={<AdminPage />} />
              </>
            )}
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
