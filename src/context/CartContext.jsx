import { createContext, useContext, useMemo, useState, useCallback } from "react";

const CartContext = createContext(undefined);

const DEFAULT_DELIVERY_FEE = 20;

let nextId = 1;

export const CartProvider = ({ children, deliveryFee = DEFAULT_DELIVERY_FEE }) => {
  const [cartItems, setCartItems] = useState([]);

  const addToCart = useCallback((item) => {
    setCartItems((prev) => [
      ...prev,
      {
        id: `cart_${nextId++}`,
        quantity: 1,
        totalPrice: item.menu?.price ?? 0,
        ...item,
      },
    ]);
  }, []);

  const removeFromCart = useCallback((id) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const increaseQuantity = useCallback((id) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: item.quantity + 1,
              totalPrice: (item.menu?.price ?? 0) * (item.quantity + 1),
            }
          : item
      )
    );
  }, []);

  const decreaseQuantity = useCallback((id) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const quantity = Math.max(1, item.quantity - 1);
        return {
          ...item,
          quantity,
          totalPrice: (item.menu?.price ?? 0) * quantity,
        };
      })
    );
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + (item.totalPrice ?? 0), 0),
    [cartItems]
  );

  const itemCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + (item.quantity ?? 0), 0),
    [cartItems]
  );

  const resolvedDeliveryFee = cartItems.length === 0 ? 0 : deliveryFee;
  const grandTotal = subtotal + resolvedDeliveryFee;

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    increaseQuantity,
    decreaseQuantity,
    clearCart,
    subtotal,
    deliveryFee: resolvedDeliveryFee,
    grandTotal,
    itemCount,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (ctx === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
};
