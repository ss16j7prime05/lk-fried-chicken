import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../AuthContext";
import { PROMPTPAY_ACCOUNT_NAME } from "../../config";
import { normalizeStatus } from "../../store/orderStatus";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Loading } from "../../components/ui/Loading";

// Status enum is the one defined in src/store/orderStatus.js (single source of truth,
// shared with Store/Rider/Admin dashboards) — values here must match exactly.
const STATUS_BADGE_COLOR = {
  Pending: "orange",
  Accepted: "blue",
  Preparing: "blue",
  "Ready for Pickup": "blue",
  "Rider Picked Up": "blue",
  "On The Way": "blue",
  Completed: "green",
  Cancelled: "orange",
};

const STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  cooking: "Preparing",
  ready_for_delivery: "Ready for Pickup",
  picked_up: "Rider Picked Up",
  delivering: "On The Way",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PAYMENT_LABELS = {
  cash: "Cash",
  promptpay: "PromptPay",
};

// normalizeStatus maps legacy Thai statuses (written by the old customer/store
// checkout) onto the canonical English enum, so orders placed before Module 1
// still show a proper label instead of the raw Thai string.
const formatStatus = (status) =>
  STATUS_LABELS[normalizeStatus(status)] ?? status ?? "Pending";

const formatPayment = (method) => PAYMENT_LABELS[method] ?? method ?? "-";

const formatDateTime = (timestamp) => {
  if (!timestamp?.toDate) return "-";
  return timestamp.toDate().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const OrderCard = ({ order, onViewDetails, onReorder }) => {
  const statusLabel = formatStatus(order.status);
  const itemCount = (order.items ?? []).reduce(
    (sum, item) => sum + (item.qty ?? 0),
    0
  );

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-black text-gray-900">{order.orderNo}</p>
          <p className="text-xs font-medium text-gray-400 mt-0.5">
            {formatDateTime(order.createdAt)}
          </p>
        </div>
        <Badge color={STATUS_BADGE_COLOR[statusLabel] ?? "blue"}>{statusLabel}</Badge>
      </div>

      <p className="text-sm font-bold text-gray-700">{PROMPTPAY_ACCOUNT_NAME}</p>
      <p className="text-xs text-gray-400 font-medium mt-1">
        {itemCount} item{itemCount !== 1 ? "s" : ""} • {formatPayment(order.paymentMethod)}
      </p>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
        <span className="font-black text-lg text-primary">฿{order.grandTotal}</span>
        <div className="flex gap-2">
          <Button variant="outline" className="!px-4 !py-2 text-xs" onClick={() => onViewDetails?.(order)}>
            View Details
          </Button>
          <Button
            className="!px-4 !py-2 text-xs opacity-50 cursor-not-allowed"
            disabled
            onClick={() => onReorder?.(order)}
          >
            Reorder
          </Button>
        </div>
      </div>
    </Card>
  );
};

export const Orders = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Orders are keyed by phone (legacy schema, matches firestore.rules' myPhone()
    // check) — there is no customerId field on order documents.
    if (!profile?.phone) {
      setOrders([]);
      setLoading(false);
      return;
    }

    // No orderBy() here on purpose: where("phone","==") + orderBy("createdAt") needs
    // a composite Firestore index that doesn't exist for this project, which made
    // this query fail outright. Sort client-side instead (same approach the legacy
    // CustomerOrderHistory.jsx page already uses for this exact query shape).
    const ordersQuery = query(
      collection(db, "orders"),
      where("phone", "==", profile.phone)
    );

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => {
          const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return tb - ta;
        });
        setOrders(data);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load orders:", err);
        setError("Unable to load your orders right now. Please try again later.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profile?.phone]);

  if (loading) {
    return <Loading text="Loading your orders..." />;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6">
      <h1 className="text-2xl font-black text-gray-900">My Orders</h1>

      {error ? (
        <EmptyState icon="⚠️" title="Something went wrong" description={error} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="No orders yet"
          description="Your past and current orders will show up here once you place one."
        />
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onViewDetails={(o) => navigate(`/shop/orders/${o.id}`)}
              onReorder={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
};
