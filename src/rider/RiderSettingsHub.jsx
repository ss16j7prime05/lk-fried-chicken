import { Link } from "react-router-dom";
import { User, BarChart3, Wallet, SlidersHorizontal, Smartphone, ChevronRight, LogOut } from "lucide-react";
import { useAuth } from "../AuthContext.jsx";
import { usePreferences } from "../context/PreferencesContext";
import { useRiderOrders } from "./useRiderOrders";
import { performanceRates, riderTier } from "./riderMetrics";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

const MenuRow = ({ icon: Icon, label, to }) => (
  <Link
    to={to}
    className="flex items-center gap-3 px-4 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
  >
    <span className="w-9 h-9 rounded-xl bg-primary-light text-primary flex items-center justify-center shrink-0">
      <Icon size={18} />
    </span>
    <span className="flex-1 font-bold text-gray-800 text-sm">{label}</span>
    <ChevronRight size={18} className="text-gray-300 shrink-0" />
  </Link>
);

// Rider Settings hub — profile header + entries to the five production sections. Uses real
// profile data; the level tier is derived from the rider's real completed-order count when
// the profile has no explicit riderLevel.
export default function RiderSettingsHub() {
  const { user, profile, logout } = useAuth();
  const { t } = usePreferences();
  const { orders } = useRiderOrders(user?.uid);

  const displayName = profile?.name || profile?.riderName || "-";
  const photo = profile?.photoURL || profile?.avatarUrl || profile?.profilePhoto || "";
  const riderCode = profile?.riderCode || user?.uid?.slice(0, 8).toUpperCase() || "-";
  const { completed } = performanceRates(orders);
  const level = profile?.riderLevel || t(`ro.tier.${riderTier(completed)}`);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-black text-gray-900">{t("ro.settings.title")}</h1>

      {/* profile header */}
      <Card className="p-5 flex items-center gap-4">
        {photo ? (
          <img src={photo} alt="" className="w-14 h-14 rounded-full object-cover ring-2 ring-primary-light shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-primary-light text-primary flex items-center justify-center text-xl font-black shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-lg font-black text-gray-900 truncate">{displayName}</p>
          <p className="text-xs font-bold text-gray-400">{riderCode}</p>
          <span className="inline-block mt-1 text-[11px] font-black text-primary bg-primary-light px-2 py-0.5 rounded-full uppercase">{level}</span>
        </div>
      </Card>

      {/* section menu */}
      <Card className="p-0 overflow-hidden">
        <MenuRow icon={User} label={t("ro.menu.account")} to="/rider/settings/account" />
        <MenuRow icon={BarChart3} label={t("ro.menu.workSummary")} to="/rider/settings/work-summary" />
        <MenuRow icon={Wallet} label={t("ro.menu.income")} to="/rider/settings/income" />
        <MenuRow icon={SlidersHorizontal} label={t("ro.menu.appSettings")} to="/rider/settings/app" />
        <MenuRow icon={Smartphone} label={t("ro.menu.deviceCheck")} to="/rider/settings/device" />
      </Card>

      <Button
        variant="outline"
        className="w-full text-secondary border-secondary/30 hover:border-secondary"
        onClick={logout}
      >
        <LogOut size={18} />
        {t("ro.logout")}
      </Button>
    </div>
  );
}
