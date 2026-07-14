import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, User, Bell, CreditCard, Star, MapPin, Settings as SettingsIcon, HelpCircle } from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';
import { NotificationBell } from '../components/notifications/NotificationBell';

export const CustomerLayout = () => {
  const { pathname } = useLocation();
  const { t } = usePreferences();
  const navItems = [
    { icon: Home, label: t('nav.home'), path: '/' },
    { icon: ShoppingBag, label: t('nav.orders'), path: '/shop/orders' },
    { icon: CreditCard, label: t('nav.checkout'), path: '/shop/checkout' },
    { icon: Bell, label: t('nav.notifications'), path: '/shop/notifications' },
    { icon: Star, label: t('nav.reviews'), path: '/shop/reviews' },
    { icon: User, label: t('nav.profile'), path: '/shop/profile' },
    { icon: MapPin, label: t('nav.addresses'), path: '/shop/addresses' },
    { icon: SettingsIcon, label: t('nav.settings'), path: '/shop/settings' },
    { icon: HelpCircle, label: t('nav.help'), path: '/shop/help' },
  ];

  const isActive = (path) =>
    pathname === path || (path !== '/' && pathname.startsWith(`${path}/`));

  return (
    <div className="min-h-screen pb-20 md:pb-0 md:pl-64">
      {/* Notification Center bell (Phase 3.7G) — floating, all breakpoints */}
      <div className="fixed top-3 right-3 z-[55]">
        <NotificationBell className="bg-white shadow-soft border border-gray-50" />
      </div>

      {/* Desktop Sidebar */}
      <nav className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-100 p-6">
        <h1 className="text-2xl font-black text-primary mb-12">LK Fried Chicken</h1>
        <div className="space-y-4">
          {navItems.map((item) => (
            <Link key={item.path} to={item.path} className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${isActive(item.path) ? 'bg-primary-light text-primary font-bold' : 'text-gray-400 hover:bg-gray-50'}`}>
              <item.icon size={22} /> {item.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-100 px-1 py-1.5 flex z-50 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {navItems.map((item) => (
          <Link key={item.path} to={item.path} aria-label={item.label} className={`flex-1 flex items-center justify-center min-h-[44px] rounded-xl transition-colors ${isActive(item.path) ? 'text-primary' : 'text-gray-300'}`}>
            <item.icon size={24} />
          </Link>
        ))}
      </nav>

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
};
