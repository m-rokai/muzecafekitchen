import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import MenuPage from './pages/MenuPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import ConfirmationPage from './pages/ConfirmationPage';
import KitchenDisplay from './pages/KitchenDisplay';
import AdminPage from './pages/AdminPage';

function App() {
  return (
    <CartProvider>
      <Router>
        <Routes>
          <Route path="/" element={<MenuPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/confirmation/:orderId" element={<ConfirmationPage />} />
          <Route path="/kitchen" element={<KitchenDisplay />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </Router>
    </CartProvider>
  );
}

export default App;
