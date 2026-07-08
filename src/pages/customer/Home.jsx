import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { Search, MapPin, Filter, Bell, ShoppingCart } from "lucide-react";
import { db } from "../../firebase";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Loading } from "../../components/ui/Loading";
import { EmptyState } from "../../components/ui/EmptyState";
import { FoodCard } from "../../components/customer/FoodCard";
import { MenuDetailModal } from "../../components/customer/MenuDetailModal";
import { CartDrawer } from "../../components/customer/CartDrawer";
import { StoreClosedBanner } from "../../components/customer/StoreClosedBanner";
import { useCart } from "../../context/CartContext";
import { usePreferences } from "../../context/PreferencesContext";

export const Home = () => {
  const navigate = useNavigate();
  const { itemCount } = useCart();
  const { t } = usePreferences();

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [menus, setMenus] = useState([]);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedMenu, setSelectedMenu] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const openDetail = (menu) => {
    setSelectedMenu(menu);
    setDetailOpen(true);
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "menus"),
      (snapshot) => {
        setMenus(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load menus:", err);
        setError("home.menuError");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "options"),
      (snapshot) => {
        setOptions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error("Failed to load menu options:", err);
      }
    );
    return () => unsubscribe();
  }, []);

  const availableMenus = useMemo(
    () => menus.filter((m) => m.available !== false),
    [menus]
  );

  const categories = useMemo(() => {
    const unique = Array.from(
      new Set(availableMenus.map((m) => m.category).filter(Boolean))
    );
    return ["All", ...unique];
  }, [availableMenus]);

  const filteredByCategory = useMemo(
    () =>
      activeCategory === "All"
        ? availableMenus
        : availableMenus.filter((m) => m.category === activeCategory),
    [availableMenus, activeCategory]
  );

  const recommended = useMemo(() => filteredByCategory.slice(0, 2), [filteredByCategory]);

  const popular = useMemo(
    () =>
      filteredByCategory.filter((item) =>
        (item.name || "").toLowerCase().includes(query.toLowerCase())
      ),
    [filteredByCategory, query]
  );

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-600">
          <MapPin size={18} className="text-primary" />
          <span>{t("home.deliverTo")}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="relative p-2 bg-white rounded-full shadow-soft">
            <Bell size={20} />
            <span className="absolute top-0 right-0 w-2 h-2 bg-secondary rounded-full border-2 border-white" />
          </button>
          <button
            onClick={() => setCartOpen(true)}
            className="relative p-2 bg-white rounded-full shadow-soft"
            aria-label={t("home.openCart")}
          >
            <ShoppingCart size={20} />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-primary text-white text-[10px] font-bold rounded-full border-2 border-white">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <StoreClosedBanner />

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("home.searchPlaceholder")}
          className="w-full bg-white border-none h-14 pl-12 pr-12 rounded-2xl shadow-soft focus:ring-2 ring-primary/20 transition-all outline-none"
        />
        <button className="absolute right-4 top-1/2 -translate-y-1/2 bg-gray-50 p-2 rounded-xl text-gray-500 hover:text-primary">
          <Filter size={18} />
        </button>
      </div>

      {/* Category Chips */}
      {categories.length > 1 && (
        <section className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`min-w-[88px] p-4 rounded-3xl shadow-soft flex flex-col items-center gap-2 border transition-all ${
                activeCategory === cat
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-gray-600 border-gray-50"
              }`}
            >
              <span className="text-2xl">🍗</span>
              <span className="text-xs font-bold">{cat === "All" ? t("home.all") : cat}</span>
            </button>
          ))}
        </section>
      )}

      {/* Promotion Banner */}
      <section className="relative bg-primary rounded-3xl p-8 text-white overflow-hidden shadow-premium">
        <div className="relative z-10 max-w-xs">
          <Badge color="orange">{t("home.limitedTime")}</Badge>
          <h2 className="text-2xl font-black mt-3">{t("home.promoTitle")}</h2>
          <p className="text-sm text-white/80 mt-2 mb-5">{t("home.promoDesc")}</p>
          <Button variant="secondary">{t("home.orderNow")}</Button>
        </div>
        <div className="absolute -right-6 -bottom-6 text-[140px] opacity-20 select-none">
          🍗
        </div>
      </section>

      {loading ? (
        <Loading text={t("home.loading")} />
      ) : error ? (
        <EmptyState icon="⚠️" title={t("common.somethingWrong")} description={t(error)} />
      ) : availableMenus.length === 0 ? (
        <EmptyState
          icon="🍗"
          title={t("home.noMenuTitle")}
          description={t("home.noMenuDesc")}
        />
      ) : (
        <>
          {/* Recommended */}
          {recommended.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-black text-gray-900">{t("home.recommended")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {recommended.map((item) => (
                  <FoodCard
                    key={item.id}
                    image={item.image}
                    name={item.name}
                    description={item.description}
                    price={item.price}
                    rating={item.rating}
                    sold={item.sold}
                    badge={item.badge}
                    onView={() => openDetail(item)}
                    onAdd={() => openDetail(item)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Popular */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-gray-900">{t("home.popular")}</h2>
            {popular.length === 0 ? (
              <EmptyState
                icon="🍗"
                title={t("home.noItemsTitle")}
                description={t("home.noItemsDesc")}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {popular.map((item) => (
                  <FoodCard
                    key={item.id}
                    image={item.image}
                    name={item.name}
                    description={item.description}
                    price={item.price}
                    rating={item.rating}
                    sold={item.sold}
                    badge={item.badge}
                    onView={() => openDetail(item)}
                    onAdd={() => openDetail(item)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <MenuDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        menu={selectedMenu}
        options={options}
      />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onCheckout={() => {
          setCartOpen(false);
          navigate("/shop/checkout");
        }}
      />
    </div>
  );
};
