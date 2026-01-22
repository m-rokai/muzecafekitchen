import { createContext, useContext, useReducer, useEffect } from 'react';

const CartContext = createContext();

const STORAGE_KEY = 'muze_cart';

const initialState = {
  items: [],
  customerName: '',
};

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const newItem = {
        ...action.payload,
        cartId: Date.now() + Math.random(),
      };
      return {
        ...state,
        items: [...state.items, newItem],
      };
    }

    case 'REMOVE_ITEM': {
      return {
        ...state,
        items: state.items.filter(item => item.cartId !== action.payload),
      };
    }

    case 'UPDATE_QUANTITY': {
      return {
        ...state,
        items: state.items.map(item =>
          item.cartId === action.payload.cartId
            ? { ...item, quantity: action.payload.quantity }
            : item
        ),
      };
    }

    case 'UPDATE_SPECIAL_INSTRUCTIONS': {
      return {
        ...state,
        items: state.items.map(item =>
          item.cartId === action.payload.cartId
            ? { ...item, specialInstructions: action.payload.instructions }
            : item
        ),
      };
    }

    case 'SET_CUSTOMER_NAME': {
      return {
        ...state,
        customerName: action.payload,
      };
    }

    case 'CLEAR_CART': {
      return {
        ...initialState,
      };
    }

    case 'LOAD_CART': {
      return {
        ...state,
        ...action.payload,
      };
    }

    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  // Load cart from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        dispatch({ type: 'LOAD_CART', payload: parsed });
      } catch (e) {
        console.error('Failed to load cart from storage:', e);
      }
    }
  }, []);

  // Save cart to localStorage on changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const addItem = (item) => {
    dispatch({ type: 'ADD_ITEM', payload: item });
  };

  const removeItem = (cartId) => {
    dispatch({ type: 'REMOVE_ITEM', payload: cartId });
  };

  const updateQuantity = (cartId, quantity) => {
    if (quantity <= 0) {
      removeItem(cartId);
    } else {
      dispatch({ type: 'UPDATE_QUANTITY', payload: { cartId, quantity } });
    }
  };

  const updateSpecialInstructions = (cartId, instructions) => {
    dispatch({ type: 'UPDATE_SPECIAL_INSTRUCTIONS', payload: { cartId, instructions } });
  };

  const setCustomerName = (name) => {
    dispatch({ type: 'SET_CUSTOMER_NAME', payload: name });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
    localStorage.removeItem(STORAGE_KEY);
  };

  const getItemTotal = (item) => {
    const basePrice = item.price * item.quantity;
    const modifiersPrice = (item.modifiers || []).reduce(
      (sum, mod) => sum + (mod.price_adjustment || 0),
      0
    ) * item.quantity;
    return basePrice + modifiersPrice;
  };

  const cartTotal = state.items.reduce(
    (sum, item) => sum + getItemTotal(item),
    0
  );

  const cartCount = state.items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        customerName: state.customerName,
        cartTotal,
        cartCount,
        addItem,
        removeItem,
        updateQuantity,
        updateSpecialInstructions,
        setCustomerName,
        clearCart,
        getItemTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
