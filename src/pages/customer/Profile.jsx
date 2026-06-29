import { useState } from "react";
import {
  Home as HomeIcon,
  Briefcase,
  Banknote,
  QrCode,
  Bell,
  Globe,
  Moon,
  LogOut,
  ShoppingBag,
  Wallet,
  Heart,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";

const MOCK_PROFILE = {
  name: "Somchai Prasert",
  phone: "081-234-5678",
  email: "somchai.p@example.com",
  memberSince: "Jan 2024",
  avatar: "https://i.pravatar.cc/150?u=somchai",
  stats: {
    totalOrders: 48,
    totalSpent: 12480,
    favoriteMenu: "Signature Fried Chicken Bucket",
  },
  addresses: [
    { label: "Home", detail: "123 Sukhumvit Rd, Klongtoey, Bangkok 10110" },
    { label: "Work", detail: "Central Tower, Floor 22, Thong Lo, Bangkok" },
  ],
};

const SectionTitle = ({ children }) => (
  <h2 className="text-base font-black text-gray-900 mb-4">{children}</h2>
);

const StatCard = ({ icon: Icon, label, value }) => (
  <Card className="p-5 flex items-center gap-4">
    <div className="p-3 rounded-2xl bg-primary-light text-primary shrink-0">
      <Icon size={22} />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-bold text-gray-400 uppercase truncate">{label}</p>
      <p className="text-lg font-black text-gray-900 truncate">{value}</p>
    </div>
  </Card>
);

const SettingRow = ({ icon: Icon, label, control }) => (
  <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
    <div className="flex items-center gap-3">
      <Icon size={18} className="text-gray-400" />
      <span className="font-bold text-gray-700 text-sm">{label}</span>
    </div>
    {control}
  </div>
);

const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`w-11 h-6 rounded-full relative transition-colors ${
      checked ? "bg-primary" : "bg-gray-200"
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-soft transition-transform ${
        checked ? "translate-x-5" : "translate-x-0"
      }`}
    />
  </button>
);

export const Profile = () => {
  const [fullName, setFullName] = useState(MOCK_PROFILE.name);
  const [phone, setPhone] = useState(MOCK_PROFILE.phone);
  const [email, setEmail] = useState(MOCK_PROFILE.email);

  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState("English");

  const [logoutOpen, setLogoutOpen] = useState(false);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6">
      {/* Profile Header */}
      <Card className="p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
        <img
          src={MOCK_PROFILE.avatar}
          alt={MOCK_PROFILE.name}
          className="w-20 h-20 rounded-full object-cover shrink-0 ring-4 ring-primary-light"
        />
        <div className="flex-1">
          <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
            <h1 className="text-xl font-black text-gray-900">{MOCK_PROFILE.name}</h1>
            <Badge color="orange">Gold Member</Badge>
          </div>
          <p className="text-sm text-gray-500 font-medium mt-1">{MOCK_PROFILE.phone}</p>
          <p className="text-xs text-gray-400 font-medium mt-1">
            Member since {MOCK_PROFILE.memberSince}
          </p>
        </div>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={ShoppingBag} label="Total Orders" value={MOCK_PROFILE.stats.totalOrders} />
        <StatCard icon={Wallet} label="Total Spent" value={`฿${MOCK_PROFILE.stats.totalSpent.toLocaleString()}`} />
        <StatCard icon={Heart} label="Favorite Menu" value={MOCK_PROFILE.stats.favoriteMenu} />
      </div>

      {/* Personal Information */}
      <Card className="p-6">
        <SectionTitle>Personal Information</SectionTitle>
        <div className="space-y-4">
          <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button className="w-full sm:w-auto">Save Changes</Button>
        </div>
      </Card>

      {/* Delivery Addresses */}
      <Card className="p-6">
        <SectionTitle>Delivery Addresses</SectionTitle>
        <div className="space-y-3">
          {MOCK_PROFILE.addresses.map((addr) => (
            <div
              key={addr.label}
              className="flex items-start gap-3 p-4 rounded-2xl bg-gray-50"
            >
              <div className="p-2 rounded-xl bg-white text-primary shrink-0">
                {addr.label === "Home" ? <HomeIcon size={18} /> : <Briefcase size={18} />}
              </div>
              <div>
                <p className="font-bold text-sm text-gray-900">{addr.label}</p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{addr.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Payment Methods */}
      <Card className="p-6">
        <SectionTitle>Payment Methods</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50">
            <Banknote size={20} className="text-primary" />
            <span className="font-bold text-sm text-gray-700">Cash</span>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50">
            <QrCode size={20} className="text-primary" />
            <span className="font-bold text-sm text-gray-700">PromptPay</span>
          </div>
        </div>
      </Card>

      {/* Settings */}
      <Card className="p-6">
        <SectionTitle>Settings</SectionTitle>
        <SettingRow
          icon={Bell}
          label="Notifications"
          control={<Toggle checked={notifications} onChange={setNotifications} />}
        />
        <SettingRow
          icon={Globe}
          label="Language"
          control={
            <button
              type="button"
              onClick={() => setLanguage((l) => (l === "English" ? "ไทย" : "English"))}
              className="text-sm font-bold text-primary"
            >
              {language}
            </button>
          }
        />
        <SettingRow
          icon={Moon}
          label="Dark Mode"
          control={<Toggle checked={darkMode} onChange={setDarkMode} />}
        />
      </Card>

      {/* Danger Zone */}
      <Card className="p-6">
        <SectionTitle>Danger Zone</SectionTitle>
        <Button
          variant="outline"
          className="w-full text-secondary border-secondary/30 hover:border-secondary"
          onClick={() => setLogoutOpen(true)}
        >
          <LogOut size={18} />
          Logout
        </Button>
      </Card>

      <ConfirmDialog
        open={logoutOpen}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmText="Logout"
        cancelText="Cancel"
        onConfirm={() => setLogoutOpen(false)}
        onCancel={() => setLogoutOpen(false)}
      />
    </div>
  );
};
