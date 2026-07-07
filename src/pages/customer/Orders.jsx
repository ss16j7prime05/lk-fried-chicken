import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useAuth } from "../../AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { PROMPTPAY_ACCOUNT_NAME } from "../../config";
import { normalizeStatus } from "../../store/orderStatus";
import { useCustomerOrders } from "./useCustomerOrders";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { EmptyState } from "../../components/ui/EmptyState";
import PaymentStatusBadge from "../../payment/PaymentStatusBadge.jsx";

// Status enum is the one defined in src/store/orderStatus.js (single source of truth,
// shared with Store/Rider/Admin dashboards) — keyed by the canonical status value.
const STATUS_BADGE_COLOR = {
  pending: "orange",
  accepted: "blue",
  cooking: "blue",
  ready_for_delivery: "blue",
  picked_up: "blue",
  delivering: "blue",
  completed: "green",
  cancelled: "orange",
};

// Filter tabs (fixed 6-bucket set). "delivering" intentionally covers all three
// post-kitchen statuses since to the customer they all just mean "on the way".
const STATUS_FILTERS = ["all", "pending", "accepted", "cooking", "delivering", "completed", "cancelled"];

const matchesStatusFilter = (normalizedStatus, filterKey) => {
  if (filterKey === "all") return true;
  if (filterKey === "delivering") {
    return ["ready_for_delivery", "picked_up", "delivering"].includes(normalizedStatus);
  }
  return normalizedStatus === filterKey;
};

const formatDateTime = (timestamp, locale) => {
  if (!timestamp?.toDate) return "-";
  return timestamp.toDate().toLocaleString(locale === "th" ? "th-TH" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const OrderCard = ({ order, onViewDetails, onReorder, t, language }) => {
  const statusKey = normalizeStatus(order.status);
  const statusLabel = t(`status.${statusKey}`);
  const itemCount = (order.items ?? []).reduce(
    (sum, item) => sum + (item.qty ?? 0),
    0
  );

  return (
    <div onClick={() => onViewDetails?.(order)} className="cursor-pointer">
      <Card className="p-5 hover:shadow-premium transition-shadow">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="font-black text-gray-900">{order.orderNo}</p>
            <p className="text-xs font-medium text-gray-400 mt-0.5">
              {formatDateTime(order.createdAt, language)}
            </p>
          </div>
          <Badge color={STATUS_BADGE_COLOR[statusKey] ?? "blue"}>{statusLabel}</Badge>
        </div>

        <p className="text-sm font-bold text-gray-700">{PROMPTPAY_ACCOUNT_NAME}</p>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <p className="text-xs text-gray-400 font-medium">
            {itemCount} {itemCount !== 1 ? t("common.items") : t("common.item")} •{" "}
            {order.paymentMethod ? t(`payment.${order.paymentMethod}`) : "-"}
          </p>
          <PaymentStatusBadge status={order.payment?.status} />
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
          <span className="font-black text-lg text-primary">฿{order.grandTotal}</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="!px-4 !py-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails?.(order);
              }}
            >
              {t("common.viewDetails")}
            </Button>
            <Button
              className="!px-4 !py-2 text-xs opacity-50 cursor-not-allowed"
              disabled
              onClick={(e) => {
                e.stopPropagation();
                onReorder?.(order);
              }}
            >
              {t("orders.reorder")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

const OrderCardSkeleton = () => (
  <Card className="p-5 animate-pulse">
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="space-y-2">
        <div className="h-4 w-28 bg-gray-100 rounded" />
        <div className="h-3 w-32 bg-gray-100 rounded" />
      </div>
      <div className="h-5 w-16 bg-gray-100 rounded-full" />
    </div>
    <div className="h-3 w-24 bg-gray-100 rounded mb-1" />
    <div className="h-3 w-40 bg-gray-100 rounded" />
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
      <div className="h-6 w-16 bg-gray-100 rounded" />
      <div className="h-8 w-24 bg-gray-100 rounded-2xl" />
    </div>
  </Card>
);

export const Orders = () => {
  const { profile } = useAuth();
  const { t, language } = usePreferences();
  const navigate = useNavigate();

  const [retryToken, setRetryToken] = useState(0);
  const { orders, loading, error } = useCustomerOrders(profile?.phone, {
    retryToken,
    errorMessage: t("orders.ordersError"),
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      if (!matchesStatusFilter(normalizeStatus(order.status), statusFilter)) return false;
      if (q && !order.orderNo?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [orders, statusFilter, searchQuery]);

  const handleRetry = () => setRetryToken((t) => t + 1);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6">
      <h1 className="text-2xl font-black text-gray-900">{t("orders.title")}</h1>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <Input
          placeholder={t("orders.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="!pl-11"
        />
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((key) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-4 py-2 rounded-2xl text-sm font-bold whitespace-nowrap border transition-all ${
              statusFilter === key
                ? "bg-primary text-white border-primary"
                : "bg-white text-gray-500 border-gray-100 hover:border-primary"
            }`}
          >
            {t(`orders.filter.${key}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <OrderCardSkeleton />
          <OrderCardSkeleton />
          <OrderCardSkeleton />
        </div>
      ) : error ? (
        <div className="space-y-6">
          <EmptyState icon="⚠️" title={t("common.somethingWrong")} description={error} />
          <div className="flex justify-center">
            <Button variant="outline" onClick={handleRetry}>
              {t("common.retry")}
            </Button>
          </div>
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon="🧾"
          title={t("orders.noOrdersTitle")}
          description={t("orders.noOrdersDesc")}
        />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon="🔍"
          title={t("orders.noMatchTitle")}
          description={t("orders.noMatchDesc")}
        />
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              t={t}
              language={language}
              onViewDetails={(o) => navigate(`/shop/orders/${o.id}`)}
              onReorder={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
};
