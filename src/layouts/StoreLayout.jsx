import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import {
  LayoutDashboard,
  ClipboardList,
  UtensilsCrossed,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  Store,
  ChevronRight,
  ChefHat,
} from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { STORE_ID } from "../config";

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/store/v2/dashboard" },
  { icon: ClipboardList,   label: "Orders",    path: "/store/v2/orders"   },
  { icon: ChefHat,         label: "Kitchen",   path: "/store/v2/kitchen"  },
  { icon: UtensilsCrossed, label: "Menu",      path: "/store/v2/menu"     },
  { icon: Settings,        label: "Settings",  path: "/store/v2/settings" },
];

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex flex-col items-end">
      <span className="text-sm font-black text-gray-800 tabular-nums tracking-tight">
        {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </span>
      <span className="text-[10px] font-medium text-gray-400 hidden sm:block">
        {now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
      </span>
    </div>
  );
}

export function StoreLayout() {
  const { logout, profile } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [unread, setUnread] = useState(0);
  const [storeName, setStoreName] = useState("LK Fried Chicken");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "stores", STORE_ID), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.isOpen !== undefined) setIsOpen(d.isOpen);
        if (d.storeName) setStoreName(d.storeName);
        if (d.unreadNotifications !== undefined) setUnread(d.unreadNotifications);
      }
    });
    return unsub;
  }, []);

  const toggleStore = async () => {
    const next = !isOpen;
    setIsOpen(next);
    try {
      await updateDoc(doc(db, "stores", STORE_ID), { isOpen: next });
    } catch {
      setIsOpen(!next);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay — only below md */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — always visible md+, drawer on mobile */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-30 flex flex-col w-64 bg-white border-r border-gray-100 shadow-sm transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
            <Store size={20} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-gray-900 truncate">{storeName}</p>
            <p className="text-xs text-gray-400 font-medium">Store Portal</p>
          </div>
          <button
            className="md:hidden text-gray-400 hover:text-gray-700 p-1"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Store open/close */}
        <div className="mx-4 my-3 p-4 rounded-2xl bg-gray-50 border border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Store Status</p>
              <p className={`text-sm font-black mt-0.5 ${isOpen ? "text-primary" : "text-gray-400"}`}>
                {isOpen ? "Open for orders" : "Closed"}
              </p>
            </div>
            <button
              onClick={toggleStore}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0
                ${isOpen ? "bg-primary" : "bg-gray-300"}`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200
                  ${isOpen ? "translate-x-7" : "translate-x-1"}`}
              />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ icon: Icon, label, path }) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold transition-colors group
                ${isActive
                  ? "bg-primary-light text-primary"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={20}
                    className={isActive ? "text-primary flex-shrink-0" : "text-gray-400 group-hover:text-gray-600 flex-shrink-0"}
                  />
                  <span className="flex-1 text-sm">{label}</span>
                  {isActive && <ChevronRight size={15} className="text-primary" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex-shrink-0">
          <p className="text-xs text-gray-400 font-medium mb-3 truncate">
            {profile?.name || profile?.email || "Store Manager"}
          </p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-bold text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="flex-shrink-0 h-14 bg-white border-b border-gray-100 flex items-center px-4 gap-3">
          {/* Hamburger — mobile only */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

          <LiveClock />

          <div className="flex-1" />

          {/* Status pill */}
          <button
            onClick={toggleStore}
            className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full transition-colors
              ${isOpen ? "bg-primary-light text-primary hover:bg-primary/20" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-primary animate-pulse" : "bg-gray-400"}`} />
            {isOpen ? "Open" : "Closed"}
          </button>

          {/* Notification bell */}
          <button className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors">
            <Bell size={20} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
