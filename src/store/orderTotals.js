// Single source of truth for order money math — shared by Checkout-created orders
// and the Store order editor (Phase 3.7F). No new collection; operates on the
// existing order fields (items/deliveryFee/discount/serviceCharge/grandTotal).

export const lineTotal = (it) => Number(it?.price || 0) * Number(it?.qty || 1);

export const calcSubtotal = (items) =>
  (items || []).reduce((sum, it) => sum + lineTotal(it), 0);

// Recompute the full money breakdown from an items array + the order's existing
// delivery/discount/service context. Delivery is unchanged by item edits.
export const recalcOrder = (items, base = {}) => {
  const subtotal = calcSubtotal(items);
  const deliveryFee = Number(base.deliveryFee || 0);
  const discount = Number(base.discount || 0);
  const serviceCharge = Number(base.serviceCharge || 0);
  const grandTotal = Math.max(0, subtotal + deliveryFee + serviceCharge - discount);
  return { subtotal, deliveryFee, discount, serviceCharge, grandTotal };
};

export const orderTotal = (order) =>
  Number(order?.grandTotal ?? order?.subtotal ?? 0);
