import { useMemo, useState, useEffect } from "react";
import { Star, Flame, Minus, Plus } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input } from "../ui/Input";
import { useCart } from "../../context/CartContext";

// Real menu-option rules — mirrors src/App.jsx's legacy checkout (single source of
// truth): which Firestore `options/{id}` doc applies to which item, and which
// selections are mandatory, is driven by the item's real category/name, not a
// fixed list of items.
const RICE_TOPPED_CATEGORY = "ข้าวหน้าไก่ทอด";
const SPICY_SALAD_NAME = "ข้าวยำไก่แซ่บ";
const EXTRA_OPTION_CATEGORIES = ["อาหารทานเล่น", "เซ็ตรวม"];

const findOption = (options, id) => options.find((item) => item.id === id);

const ChoiceGroup = ({ title, choices, value, onChange }) => {
  if (!choices || choices.length === 0) return null;
  return (
    <div>
      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
        {title}
      </h4>
      <div className="flex flex-wrap gap-2">
        {choices.map((choice) => {
          const active = value?.name === choice.name;
          return (
            <button
              key={choice.name}
              type="button"
              onClick={() => onChange(choice)}
              className={`px-4 py-2 rounded-2xl text-sm font-bold border transition-all ${
                active
                  ? "bg-primary text-white border-primary"
                  : "bg-gray-50 text-gray-600 border-gray-100 hover:border-primary"
              }`}
            >
              {choice.name}
              {choice.price > 0 && <span className="ml-1 opacity-70">+฿{choice.price}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const MenuDetailModal = ({ open, onClose, menu, options = [], onAddToCart }) => {
  const { addToCart } = useCart();

  const [topChicken, setTopChicken] = useState(null);
  const [spicy, setSpicy] = useState(null);
  const [sauceMain, setSauceMain] = useState(null);
  const [sauceExtra, setSauceExtra] = useState(null);
  const [powder, setPowder] = useState(null);
  const [tableCheese, setTableCheese] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (open) {
      setTopChicken(null);
      setSpicy(null);
      setSauceMain(null);
      setSauceExtra(null);
      setPowder(null);
      setTableCheese(null);
      setQuantity(1);
      setNote("");
      setValidationError("");
    }
  }, [open, menu]);

  const needsTopChicken = menu?.category === RICE_TOPPED_CATEGORY;
  const needsSpicy = menu?.name === SPICY_SALAD_NAME;
  const showExtraOptions = EXTRA_OPTION_CATEGORIES.includes(menu?.category);

  // Doc IDs match the real production `options` collection (see src/App.jsx).
  const topChickenOption = useMemo(() => findOption(options, "top_chicken"), [options]);
  const spicyOption = useMemo(() => findOption(options, "spicy"), [options]);
  const sauceMainOption = useMemo(() => findOption(options, "Sauce"), [options]);
  const sauceExtraOption = useMemo(() => findOption(options, "sauce"), [options]);
  const powderOption = useMemo(() => findOption(options, "poewder"), [options]);
  const tableCheeseOption = useMemo(() => findOption(options, "table cheese"), [options]);

  const basePrice = menu?.price ?? 0;
  const optionsTotal =
    (sauceMain?.price || 0) +
    (sauceExtra?.price || 0) +
    (powder?.price || 0) +
    (tableCheese?.price || 0);
  const unitPrice = basePrice + optionsTotal;
  const totalPrice = useMemo(() => unitPrice * quantity, [unitPrice, quantity]);

  if (!menu) return null;

  const handleAddToCart = () => {
    if (needsTopChicken && !topChicken) {
      setValidationError("Please select a chicken topping.");
      return;
    }
    if (needsSpicy && !spicy) {
      setValidationError("Please select a spice level.");
      return;
    }
    setValidationError("");

    const cartItem = {
      menu,
      topChicken: topChicken?.name || "",
      spicy: spicy?.name || "",
      sauceMain: sauceMain || "",
      sauceExtra: sauceExtra || "",
      powder: powder || "",
      tableCheese: tableCheese || "",
      note,
      quantity,
      unitPrice,
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
          {needsTopChicken && (
            <ChoiceGroup
              title="Chicken Topping"
              choices={topChickenOption?.choices}
              value={topChicken}
              onChange={setTopChicken}
            />
          )}

          {needsSpicy && (
            <ChoiceGroup
              title="Spice Level"
              choices={spicyOption?.choices}
              value={spicy}
              onChange={setSpicy}
            />
          )}

          {showExtraOptions && (
            <>
              <ChoiceGroup
                title="Sauce"
                choices={sauceMainOption?.choices}
                value={sauceMain}
                onChange={setSauceMain}
              />
              <ChoiceGroup
                title="Extra Sauce"
                choices={sauceExtraOption?.choices}
                value={sauceExtra}
                onChange={setSauceExtra}
              />
              <ChoiceGroup
                title="Shake Powder"
                choices={powderOption?.choices}
                value={powder}
                onChange={setPowder}
              />
              <ChoiceGroup
                title="Extra Cheese"
                choices={tableCheeseOption?.choices}
                value={tableCheese}
                onChange={setTableCheese}
              />
            </>
          )}

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

        {validationError && (
          <p className="text-sm font-bold text-secondary">{validationError}</p>
        )}

        <div className="sticky bottom-0 -mx-6 sm:-mx-8 px-6 sm:px-8 pt-4 pb-1 bg-white/95 backdrop-blur border-t border-gray-100 flex items-center justify-between gap-4">
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
