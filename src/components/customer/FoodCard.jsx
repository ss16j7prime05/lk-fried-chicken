import { Star, Plus, Flame } from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { usePreferences } from "../../context/PreferencesContext";

export const FoodCard = ({
  image,
  name,
  description,
  price,
  rating,
  sold,
  badge,
  onView,
  onAdd,
}) => {
  const { t } = usePreferences();
  return (
    <Card className="group flex flex-col h-full transition-shadow duration-200 hover:shadow-premium">
      <div className="relative aspect-[4/3] overflow-hidden cursor-pointer" onClick={onView}>
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {badge && (
          <div className="absolute top-2.5 left-2.5">
            <Badge color="orange">{badge}</Badge>
          </div>
        )}
        {rating != null && (
          <div className="absolute top-2.5 right-2.5 bg-white/90 backdrop-blur px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
            <Star size={12} className="fill-yellow-400 text-yellow-400" />
            {rating}
          </div>
        )}
      </div>

      <div className="p-3 sm:p-4 flex flex-col flex-1">
        <h3
          className="font-bold text-gray-900 leading-snug cursor-pointer hover:text-primary transition-colors duration-150 line-clamp-2"
          onClick={onView}
        >
          {name}
        </h3>

        {description && (
          <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2">{description}</p>
        )}

        {sold != null && (
          <span className="flex items-center gap-1 mt-2 text-xs font-bold text-gray-400">
            <Flame size={14} className="text-secondary" />
            {t("food.sold", { n: sold })}
          </span>
        )}

        {/* Price and add-button aligned on one baseline */}
        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-50">
          <span className="font-black text-lg text-primary">฿{price}</span>
          <button
            onClick={onAdd}
            aria-label={t("food.addToCart")}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary-dark active:scale-95 transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
    </Card>
  );
};
