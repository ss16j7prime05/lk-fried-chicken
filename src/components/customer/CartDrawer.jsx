import { Minus, Plus, Trash2, X } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { useCart } from "../../context/CartContext";
import { usePreferences } from "../../context/PreferencesContext";

const CartLine = ({ item, onIncrease, onDecrease, onRemove, t }) => (
  <Card className="flex gap-4 p-4">
    <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 bg-gray-50">
      <img
        src={item.menu?.image}
        alt={item.menu?.name}
        className="w-full h-full object-cover"
      />
    </div>

    <div className="flex-1 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-bold text-gray-900 truncate">{item.menu?.name}</h4>
        <button
          onClick={() => onRemove?.(item.id)}
          className="text-gray-300 hover:text-secondary transition-colors shrink-0"
          aria-label={t("cart.removeItem")}
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {item.topChicken && <Badge color="green">{item.topChicken}</Badge>}
        {item.spicy && <Badge color="orange">{item.spicy}</Badge>}
        {item.sauceMain?.name && <Badge color="green">{item.sauceMain.name}</Badge>}
        {item.sauceExtra?.name && <Badge color="green">{item.sauceExtra.name}</Badge>}
        {item.powder?.name && <Badge color="blue">{item.powder.name}</Badge>}
        {item.tableCheese?.name && <Badge color="blue">{item.tableCheese.name}</Badge>}
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onDecrease?.(item.id)}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <Minus size={14} />
          </button>
          <span className="font-bold text-sm w-5 text-center">{item.quantity}</span>
          <button
            onClick={() => onIncrease?.(item.id)}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary-dark transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="text-right">
          <p className="text-xs text-gray-400 font-medium">฿{item.unitPrice ?? item.menu?.price} ea.</p>
          <p className="font-black text-primary">฿{item.totalPrice}</p>
        </div>
      </div>
    </div>
  </Card>
);

export const CartDrawer = ({ open, onClose, onCheckout }) => {
  const {
    cartItems,
    increaseQuantity,
    decreaseQuantity,
    removeFromCart,
    subtotal,
    deliveryFee,
    grandTotal,
  } = useCart();
  const { t } = usePreferences();

  return (
    <Modal open={open} onClose={onClose} className="max-w-md ml-auto mr-0 h-full max-h-screen rounded-none sm:rounded-l-3xl flex flex-col">
      <div className="flex items-center justify-between p-6 border-b border-gray-100">
        <h2 className="text-xl font-black text-gray-900">{t("cart.title")}</h2>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-50 hover:bg-gray-100 transition-colors"
          aria-label={t("cart.close")}
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {cartItems.length === 0 ? (
          <EmptyState
            icon="🛒"
            title={t("cart.emptyTitle")}
            description={t("cart.emptyDesc")}
          />
        ) : (
          cartItems.map((item) => (
            <CartLine
              key={item.id}
              item={item}
              t={t}
              onIncrease={increaseQuantity}
              onDecrease={decreaseQuantity}
              onRemove={removeFromCart}
            />
          ))
        )}
      </div>

      {cartItems.length > 0 && (
        <div className="p-6 border-t border-gray-100 space-y-3 bg-white">
          <div className="flex justify-between text-sm font-medium text-gray-500">
            <span>{t("cart.subtotal")}</span>
            <span>฿{subtotal}</span>
          </div>
          <div className="flex justify-between text-sm font-medium text-gray-500">
            <span>{t("cart.deliveryFee")}</span>
            <span>฿{deliveryFee}</span>
          </div>
          <div className="flex justify-between text-lg font-black text-gray-900 pt-2 border-t border-gray-100">
            <span>{t("cart.grandTotal")}</span>
            <span className="text-primary">฿{grandTotal}</span>
          </div>

          <Button className="w-full mt-2" onClick={onCheckout}>
            {t("cart.checkout")}
          </Button>
        </div>
      )}
    </Modal>
  );
};
