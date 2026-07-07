import { Star, Plus, Flame } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
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
    <Card className="group flex flex-col h-full">
      <div className="relative h-44 sm:h-48 overflow-hidden cursor-pointer" onClick={onView}>
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        {badge && (
          <div className="absolute top-3 left-3">
            <Badge color="orange">{badge}</Badge>
          </div>
        )}
        {rating != null && (
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1">
            <Star size={12} className="fill-yellow-400 text-yellow-400" />
            {rating}
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3
          className="font-bold text-gray-900 leading-snug cursor-pointer hover:text-primary transition-colors"
          onClick={onView}
        >
          {name}
        </h3>

        {description && (
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{description}</p>
        )}

        <div className="flex items-center gap-3 mt-2 text-xs font-bold text-gray-400">
          {sold != null && (
            <span className="flex items-center gap-1">
              <Flame size={14} className="text-secondary" />
              {t("food.sold", { n: sold })}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
          <span className="font-black text-lg text-primary">฿{price}</span>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="!px-4 !py-2 text-xs" onClick={onView}>
              {t("common.viewDetails")}
            </Button>
            <button
              onClick={onAdd}
              aria-label={t("food.addToCart")}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary-dark transition-colors shrink-0"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
};
