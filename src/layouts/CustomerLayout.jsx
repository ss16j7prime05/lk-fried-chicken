import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, User, Bell, CreditCard, Star, Settings as SettingsIcon, HelpCircle } from 'lucide-react';

export const CustomerLayout = () => {
  const { pathname } = useLocation();
  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: ShoppingBag, label: 'Orders', path: '/shop/orders' },
    { icon: CreditCard, label: 'Checkout', path: '/shop/checkout' },
    { icon: Bell, label: 'Notifications', path: '/shop/notifications' },
    { icon: Star, label: 'Reviews', path: '/shop/reviews' },
    { icon: User, label: 'Profile', path: '/shop/profile' },
    { icon: SettingsIcon, label: 'Settings', path: '/shop/settings' },
    { icon: HelpCircle, label: 'Help', path: '/shop/help' },
  ];

  const isActive = (path) =>
    pathname === path || (path !== '/' && pathname.startsWith(`${path}/`));

  return (
    <div className="min-h-screen pb-20 md:pb-0 md:pl-64">
      {/* Desktop Sidebar */}
      <nav className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-100 p-6">
        <h1 className="text-2xl font-black text-primary mb-12">FoodFlow</h1>
        <div className="space-y-4">
          {navItems.map((item) => (
            <Link key={item.path} to={item.path} className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${isActive(item.path) ? 'bg-primary-light text-primary font-bold' : 'text-gray-400 hover:bg-gray-50'}`}>
              <item.icon size={22} /> {item.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-100 px-8 py-4 flex justify-between z-50">
        {navItems.map((item) => (
          <Link key={item.path} to={item.path} className={isActive(item.path) ? 'text-primary' : 'text-gray-300'}>
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
