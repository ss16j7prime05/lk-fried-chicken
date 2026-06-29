import { useMemo, useState, useEffect } from "react";
import { Star, Flame, Minus, Plus } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input } from "../ui/Input";
import { useCart } from "../../context/CartContext";

const CHICKEN_PARTS = ["Breast", "Thigh", "Wing", "Drumstick"];
const SPICE_LEVELS = ["Not Spicy", "Mild", "Medium", "Hot", "Very Hot"];
const SHAKE_POWDERS = ["Original", "Cheese", "BBQ", "Paprika", "Mala", "Seaweed"];
const SAUCES = ["None", "Korean", "Teriyaki", "Garlic", "Spicy Mayo"];

const OptionGroup = ({ title, options, value, onChange }) => (
  <div>
    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
      {title}
    </h4>
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-4 py-2 rounded-2xl text-sm font-bold border transition-all ${
            value === opt
              ? "bg-primary text-white border-primary"
              : "bg-gray-50 text-gray-600 border-gray-100 hover:border-primary"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  </div>
);

export const MenuDetailModal = ({ open, onClose, menu, onAddToCart }) => {
  const { addToCart } = useCart();
  const [chickenPart, setChickenPart] = useState(CHICKEN_PARTS[0]);
  const [spiceLevel, setSpiceLevel] = useState(SPICE_LEVELS[0]);
  const [shakePowder, setShakePowder] = useState(SHAKE_POWDERS[0]);
  const [sauce, setSauce] = useState(SAUCES[0]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setChickenPart(CHICKEN_PARTS[0]);
      setSpiceLevel(SPICE_LEVELS[0]);
      setShakePowder(SHAKE_POWDERS[0]);
      setSauce(SAUCES[0]);
      setQuantity(1);
      setNote("");
    }
  }, [open, menu]);

  const basePrice = menu?.price ?? 0;
  const totalPrice = useMemo(() => basePrice * quantity, [basePrice, quantity]);

  if (!menu) return null;

  const handleAddToCart = () => {
    const cartItem = {
      menu,
      chickenPart,
      spiceLevel,
      shakePowder,
      sauce,
      quantity,
      note,
      totalPrice,
    };
    addToCart(cartItem);
    onAddToCart?.(cartItem);
    onClose?.();
  };

  return (
    <Modal open={open} onClose={onClose} className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <div className="relative h-56 sm:h-64">
        <img
          src={menu.image}
          alt={menu.name}
          className="w-full h-full object-cover"
        />
        {menu.badge && (
          <div className="absolute top-4 left-4">
            <Badge color="orange">{menu.badge}</Badge>
          </div>
        )}
      </div>

      <div className="p-6 sm:p-8 space-y-8">
        <div>
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-2xl font-black text-gray-900">{menu.name}</h2>
            <span className="text-2xl font-black text-primary whitespace-nowrap">
              ฿{basePrice}
            </span>
          </div>
          {menu.description && (
            <p className="text-gray-500 mt-2">{menu.description}</p>
          )}
          <div className="flex items-center gap-4 mt-3 text-sm font-bold text-gray-400">
            {menu.rating != null && (
              <span className="flex items-center gap-1">
                <Star size={14} className="fill-yellow-400 text-yellow-400" />
                {menu.rating}
              </span>
            )}
            {menu.sold != null && (
              <span className="flex items-center gap-1">
                <Flame size={14} className="text-secondary" />
                {menu.sold}+ sold
              </span>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <OptionGroup
            title="Chicken Part"
            options={CHICKEN_PARTS}
            value={chickenPart}
            onChange={setChickenPart}
          />
          <OptionGroup
            title="Spice Level"
            options={SPICE_LEVELS}
            value={spiceLevel}
            onChange={setSpiceLevel}
          />
          <OptionGroup
            title="Shake Powder"
            options={SHAKE_POWDERS}
            value={shakePowder}
            onChange={setShakePowder}
          />
          <OptionGroup
            title="Sauce"
            options={SAUCES}
            value={sauce}
            onChange={setSauce}
          />

          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Quantity
            </h4>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <Minus size={18} />
              </button>
              <Input
                readOnly
                value={quantity}
                className="!w-20 text-center"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary-dark transition-colors"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Special Note
            </h4>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="E.g. less oil, no cilantro..."
              rows={3}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">Total</p>
            <p className="text-2xl font-black text-primary">฿{totalPrice}</p>
          </div>
          <Button className="flex-1" onClick={handleAddToCart}>
            Add To Cart
          </Button>
        </div>
      </div>
    </Modal>
  );
};
