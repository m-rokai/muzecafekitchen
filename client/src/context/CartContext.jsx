import { createContext, useContext, useReducer, useEffect } from 'react';

const CartContext = createContext();

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

function loadStoredCart(storageKey) {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return initialState;
  try {
    const parsed = JSON.parse(saved);
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      customerName: typeof parsed.customerName === 'string' ? parsed.customerName : '',
    };
  } catch (error) {
    console.error('Failed to load cart from storage:', error);
    return initialState;
  }
}

export function CartProvider({ children }) {
  const channel = 'cafe';
  const storageKey = 'muze_cart_cafe';
  const [state, dispatch] = useReducer(cartReducer, storageKey, loadStoredCart);

  useEffect(() => {
    const wrongChannel = state.items.some(item => item.channel && item.channel !== channel);
    if (wrongChannel) {
      dispatch({ type: 'CLEAR_CART' });
      localStorage.removeItem(storageKey);
    }
  }, [channel, state.items, storageKey]);

  // Keep the existing café storage key so saved carts survive the portal removal.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save cart to storage:', error);
    }
  }, [state, storageKey]);

  const addItem = (item) => {
    dispatch({ type: 'ADD_ITEM', payload: { ...item, channel } });
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
    localStorage.removeItem(storageKey);
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
        channel,
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

// The provider and hook intentionally share this module for the existing API.
// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
