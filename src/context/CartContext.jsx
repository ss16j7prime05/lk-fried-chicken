/* eslint-disable react-refresh/only-export-components -- context module ตั้งใจ export ทั้ง Provider (component) และ useCart (hook) จากไฟล์เดียว */
import { createContext, useContext, useMemo, useState, useCallback } from "react";
import { calcDeliveryFee } from "../location/locationUtils";

const CartContext = createContext(undefined);

// ค่าจัดส่งฐาน = สูตรเดียวกับ Checkout (calcDeliveryFee ที่ระยะ 0 กม.) เพื่อให้ Cart
// กับ Checkout ใช้ source เดียวกัน ไม่คิดค่าส่งคนละสูตร
const BASE_DELIVERY_FEE = calcDeliveryFee(0);

let nextId = 1;

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  // ค่าจัดส่งจริงถูกอัปเดตจาก Checkout ผ่าน setDeliveryFee(calcDeliveryFee(km)) เมื่อปักหมุด
  // ปลายทาง — Cart Drawer และ Checkout จึงอ่านค่าเดียวกันเสมอ
  const [deliveryFee, setDeliveryFee] = useState(BASE_DELIVERY_FEE);

  // unitPrice = menu price + any priced options (set by MenuDetailModal) — always
  // recomputed here (not trusted from the caller) so totalPrice never drifts from
  // quantity x unitPrice across add/increase/decrease.
  const addToCart = useCallback((item) => {
    const quantity = item.quantity ?? 1;
    const unitPrice = item.unitPrice ?? item.menu?.price ?? 0;
    setCartItems((prev) => [
      ...prev,
      {
        ...item,
        id: `cart_${nextId++}`,
        quantity,
        unitPrice,
        totalPrice: unitPrice * quantity,
      },
    ]);
  }, []);

  const removeFromCart = useCallback((id) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const increaseQuantity = useCallback((id) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const quantity = item.quantity + 1;
        return {
          ...item,
          quantity,
          totalPrice: (item.unitPrice ?? item.menu?.price ?? 0) * quantity,
        };
      })
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
          totalPrice: (item.unitPrice ?? item.menu?.price ?? 0) * quantity,
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
    setDeliveryFee,
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
