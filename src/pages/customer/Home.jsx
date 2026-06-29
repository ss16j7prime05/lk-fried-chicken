import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { Search, MapPin, Filter, Bell } from "lucide-react";
import { db } from "../../firebase";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Loading } from "../../components/ui/Loading";
import { EmptyState } from "../../components/ui/EmptyState";

const FALLBACK_IMAGE = "https://picsum.photos/seed/lkfc-fallback/600/400";

const FoodCard = ({ item }) => (
  <Card className="group cursor-pointer">
    <div className="relative h-44 overflow-hidden">
      <img
        src={item.image || FALLBACK_IMAGE}
        alt={item.name}
        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
      />
      {item.rating != null && (
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold">
          ★ {item.rating}
        </div>
      )}
      {item.promo && (
        <div className="absolute bottom-3 left-0 bg-secondary text-white px-4 py-1 rounded-r-lg font-bold text-sm">
          {item.promo}
        </div>
      )}
    </div>
    <div className="p-4">
      <h3 className="font-bold text-gray-900">{item.name}</h3>
      {item.tags && item.tags.length > 0 && (
        <p className="text-xs text-gray-500 mt-1 mb-3">{item.tags.join(" • ")}</p>
      )}
      <div className="flex items-center justify-between">
        <span className="font-black text-primary">฿{item.price}</span>
        <span className="text-xs font-bold text-gray-400">{item.time || "15-25 min"}</span>
      </div>
    </div>
  </Card>
);

export const Home = () => {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        setError("Unable to load the menu right now. Please try again later.");
        setLoading(false);
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
          <span>Deliver to: 123 Sukhumvit, Bangkok</span>
        </div>
        <button className="relative p-2 bg-white rounded-full shadow-soft">
          <Bell size={20} />
          <span className="absolute top-0 right-0 w-2 h-2 bg-secondary rounded-full border-2 border-white" />
        </button>
      </header>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for chicken, sides, drinks..."
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
              <span className="text-xs font-bold">{cat}</span>
            </button>
          ))}
        </section>
      )}

      {/* Promotion Banner */}
      <section className="relative bg-primary rounded-3xl p-8 text-white overflow-hidden shadow-premium">
        <div className="relative z-10 max-w-xs">
          <Badge color="orange">Limited Time</Badge>
          <h2 className="text-2xl font-black mt-3">Free Delivery on Orders Over ฿299</h2>
          <p className="text-sm text-white/80 mt-2 mb-5">
            Crispy. Juicy. Delivered hot to your door.
          </p>
          <Button variant="secondary">Order Now</Button>
        </div>
        <div className="absolute -right-6 -bottom-6 text-[140px] opacity-20 select-none">
          🍗
        </div>
      </section>

      {loading ? (
        <Loading text="Finding tasty recommendations..." />
      ) : error ? (
        <EmptyState icon="⚠️" title="Something went wrong" description={error} />
      ) : availableMenus.length === 0 ? (
        <EmptyState
          icon="🍗"
          title="No menu items yet"
          description="The store hasn't added any menu items yet. Please check back soon."
        />
      ) : (
        <>
          {/* Recommended */}
          {recommended.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-black text-gray-900">Recommended for You</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {recommended.map((item) => (
                  <FoodCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          )}

          {/* Popular */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-gray-900">Popular Now</h2>
            {popular.length === 0 ? (
              <EmptyState
                icon="🍗"
                title="No items found"
                description="Try a different search term or browse our categories above."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {popular.map((item) => (
                  <FoodCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
