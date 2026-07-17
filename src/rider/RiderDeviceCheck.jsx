import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, MinusCircle, Info, RefreshCw } from "lucide-react";
import { usePreferences } from "../context/PreferencesContext";
import { APP_VERSION } from "../config";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

// Web-appropriate device readiness checks. Native-only items (Play Services, overlay,
// full-screen notification) are reported as "not applicable on web" honestly rather than
// faked. Notification permission / sound / network / version are checked for real.
function computeChecks() {
  const hasNotif = typeof Notification !== "undefined";
  const perm = hasNotif ? Notification.permission : "unsupported";
  let audioOk;
  try { audioOk = Boolean(window.AudioContext || window.webkitAudioContext); } catch { audioOk = false; }
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  let tz;
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { tz = ""; }
  return [
    { key: "playServices", status: "na" },
    { key: "notifPermission", status: !hasNotif ? "na" : perm === "granted" ? "ok" : perm === "denied" ? "error" : "warn", detail: perm },
    { key: "overlay", status: "na" },
    { key: "autoDateTime", status: "info", detail: tz },
    { key: "notifSound", status: audioOk ? "ok" : "warn" },
    { key: "fullScreen", status: "na" },
    { key: "network", status: online ? "ok" : "error" },
    { key: "appVersion", status: "info", detail: APP_VERSION },
  ];
}

const STATUS_UI = {
  ok: { Icon: CheckCircle2, cls: "text-primary" },
  warn: { Icon: AlertTriangle, cls: "text-amber-500" },
  error: { Icon: XCircle, cls: "text-secondary" },
  na: { Icon: MinusCircle, cls: "text-gray-300" },
  info: { Icon: Info, cls: "text-blue-500" },
};

export default function RiderDeviceCheck() {
  const navigate = useNavigate();
  const { t } = usePreferences();
  const [checks, setChecks] = useState(() => computeChecks());

  const recheck = () => setChecks(computeChecks());
  const requestNotif = () => {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().catch(() => {}).finally(recheck);
  };
  const needsPermission = checks.some((c) => c.key === "notifPermission" && c.status === "warn");

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <button onClick={() => navigate("/rider/settings")} className="flex items-center gap-2 text-lg font-black text-gray-900 hover:text-primary">
        <ArrowLeft size={20} /> {t("ro.menu.deviceCheck")}
      </button>

      <Card className="p-2">
        {checks.map(({ key, status, detail }) => {
          const { Icon, cls } = STATUS_UI[status] || STATUS_UI.info;
          return (
            <div key={key} className="flex items-center gap-3 px-3 py-3.5 border-b border-gray-50 last:border-0">
              <Icon size={20} className={`shrink-0 ${cls}`} />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-800 text-sm">{t(`ro.device.${key}`)}</p>
                {detail && <p className="text-xs font-medium text-gray-400 truncate">{key === "notifPermission" ? t(`ro.device.perm.${detail}`) : detail}</p>}
              </div>
              <span className={`text-[11px] font-black uppercase ${cls}`}>{t(`ro.device.status.${status}`)}</span>
            </div>
          );
        })}
      </Card>

      {needsPermission && (
        <Button variant="outline" className="w-full" onClick={requestNotif}>
          {t("ro.device.grantNotif")}
        </Button>
      )}

      <Button className="w-full" onClick={recheck}>
        <RefreshCw size={17} /> {t("ro.device.checkAgain")}
      </Button>
    </div>
  );
}
