// Shared rider presentational primitives — extracted from RiderProfile / RiderEarnings /
// RiderSettings / RiderNotifications where they were duplicated byte-for-byte. One source
// so spacing, radius and typography stay identical across every rider screen.
import { Card } from "../components/ui/Card";

// Section heading used above grouped content on the rider screens.
export const SectionTitle = ({ children, className = "" }) => (
  <h2 className={`text-base font-black text-gray-900 ${className}`}>{children}</h2>
);

// Icon + label + value stat tile (Profile stats, Earnings buckets).
export const StatCard = ({ icon: Icon, label, value }) => (
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
