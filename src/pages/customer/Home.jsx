import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { Search, ShoppingCart } from "lucide-react";
import { db } from "../../firebase";
import { Loading } from "../../components/ui/Loading";
import { EmptyState } from "../../components/ui/EmptyState";
import { FoodCard } from "../../components/customer/FoodCard";
import { StoreHeader } from "../../components/customer/StoreHeader";
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
    <div className="space-y-6 pb-28 md:pb-10">
      {/* Store header — large cover + circular logo + info */}
      <StoreHeader />

      <StoreClosedBanner />

      {/* Search Bar — primary focus, stays visible while scrolling */}
      <div className="sticky top-2 z-30">
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("home.searchPlaceholder")}
            className="w-full bg-white h-[52px] pl-12 pr-14 rounded-full shadow-soft border border-gray-100 focus:border-primary focus:ring-2 ring-primary/15 transition-all duration-200 outline-none text-sm font-medium"
          />
        </div>
      </div>

      {/* Category chips — compact, horizontal, hidden scrollbar */}
      {categories.length > 1 && (
        <section className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 px-4 py-1.5 min-h-[34px] rounded-full text-sm font-bold border transition-all duration-200 active:scale-95 ${
                activeCategory === cat
                  ? "bg-primary text-white border-primary shadow-soft"
                  : "bg-white text-gray-600 border-gray-200 hover:border-primary"
              }`}
            >
              {cat === "All" ? t("home.all") : cat}
            </button>
          ))}
        </section>
      )}

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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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

      {/* Cart FAB — bottom-right, sits above the mobile bottom nav and respects the
          safe area; on md+ the nav is a sidebar so it drops to the viewport corner.
          Notification bell is fixed top-right (layout), so the two never overlap. */}
      <button
        onClick={() => setCartOpen(true)}
        aria-label={t("home.openCart")}
        className="fixed z-40 right-4 md:right-6 bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-6 w-14 h-14 flex items-center justify-center rounded-full bg-primary text-white shadow-premium hover:bg-primary-dark active:scale-90 transition-transform duration-200"
      >
        <ShoppingCart size={24} />
        {itemCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 flex items-center justify-center bg-secondary text-white text-xs font-black rounded-full border-2 border-white">
            {itemCount}
          </span>
        )}
      </button>
    </div>
  );
};
