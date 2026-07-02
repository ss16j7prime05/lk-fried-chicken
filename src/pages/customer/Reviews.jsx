import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import { Star } from "lucide-react";
import { db } from "../../firebase";
import { useAuth } from "../../AuthContext";
import { normalizeStatus } from "../../store/orderStatus";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { EmptyState } from "../../components/ui/EmptyState";

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

const OrderCardSkeleton = () => (
  <Card className="p-5 animate-pulse">
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="space-y-2">
        <div className="h-4 w-28 bg-gray-100 rounded" />
        <div className="h-3 w-32 bg-gray-100 rounded" />
      </div>
      <div className="h-8 w-28 bg-gray-100 rounded-2xl" />
    </div>
  </Card>
);

// Star picker used both to select a rating (interactive) and to display an
// already-submitted one (read-only).
const StarPicker = ({ value, onChange, readOnly = false, size = 28 }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        disabled={readOnly}
        onClick={() => onChange?.(n)}
        className={readOnly ? "cursor-default" : "cursor-pointer"}
        aria-label={`${n} star${n !== 1 ? "s" : ""}`}
      >
        <Star
          size={size}
          className={n <= value ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}
        />
      </button>
    ))}
  </div>
);

const ReviewModal = ({ order, open, onClose, onSubmitted }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setRating(5);
      setComment("");
      setError(null);
    }
  }, [open, order?.id]);

  if (!order) return null;

  const handleSubmit = async () => {
    if (rating < 1) {
      setError("Please select a star rating.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Exact existing `reviews` schema (src/TrackOrder.jsx's ReviewForm is the
      // single source of truth for this shape) — no new fields added.
      await addDoc(collection(db, "reviews"), {
        orderId: order.id,
        customerName: order.customerName || "",
        riderId: order.riderId || "",
        storeId: order.storeId || "",
        rating: Number(rating),
        comment: comment.trim(),
        createdAt: serverTimestamp(),
      });
      onSubmitted(order.id);
      onClose();
    } catch (err) {
      console.error("Failed to submit review:", err);
      setError("Failed to submit your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <div className="p-6 sm:p-8 space-y-6">
        <div>
          <h2 className="text-xl font-black text-gray-900">Rate Your Order</h2>
          <p className="text-sm text-gray-400 font-medium mt-1">{order.orderNo}</p>
        </div>

        <div className="flex justify-center">
          <StarPicker value={rating} onChange={setRating} size={36} />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Comment (optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="How was your order?"
            rows={4}
            className="w-full mt-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
          />
        </div>

        {error && <p className="text-sm font-bold text-secondary">{error}</p>}

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Review"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

const ReviewableOrderCard = ({ order, review, onWriteReview }) => {
  const itemCount = (order.items ?? []).reduce((sum, item) => sum + (item.qty ?? 0), 0);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-black text-gray-900">{order.orderNo}</p>
          <p className="text-xs font-medium text-gray-400 mt-0.5">
            {formatDateTime(order.createdAt)}
          </p>
        </div>
        <Badge color={review ? "blue" : "green"}>{review ? "Reviewed" : "Completed"}</Badge>
      </div>

      <p className="text-xs text-gray-400 font-medium mb-3">
        {itemCount} item{itemCount !== 1 ? "s" : ""} • ฿{order.grandTotal}
      </p>

      {review ? (
        <div className="space-y-2 pt-3 border-t border-gray-50">
          <StarPicker value={review.rating || 0} readOnly size={18} />
          {review.comment && <p className="text-sm text-gray-500">{review.comment}</p>}
        </div>
      ) : (
        <div className="pt-3 border-t border-gray-50">
          <Button variant="outline" className="w-full !py-2 text-sm" onClick={() => onWriteReview(order)}>
            <Star size={16} />
            Write a Review
          </Button>
        </div>
      )}
    </Card>
  );
};

export const Reviews = () => {
  const { profile } = useAuth();

  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryToken, setRetryToken] = useState(0);
  const [activeOrder, setActiveOrder] = useState(null);

  // Same query shape as src/pages/customer/Orders.jsx — no orderBy() on purpose:
  // where("phone","==") + orderBy("createdAt") needs a composite Firestore index
  // that doesn't exist for this project. Sort client-side instead.
  useEffect(() => {
    if (!profile?.phone) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const ordersQuery = query(collection(db, "orders"), where("phone", "==", profile.phone));

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
  }, [profile?.phone, retryToken]);

  const completedOrders = useMemo(
    () => orders.filter((o) => normalizeStatus(o.status) === "completed"),
    [orders]
  );

  const completedOrderIds = useMemo(
    () => completedOrders.map((o) => o.id),
    [completedOrders]
  );

  // Firestore "in" queries take at most 30 values — plenty for one customer's own
  // completed-order history.
  useEffect(() => {
    if (completedOrderIds.length === 0) {
      setReviews([]);
      return;
    }
    const reviewsQuery = query(
      collection(db, "reviews"),
      where("orderId", "in", completedOrderIds.slice(0, 30))
    );
    const unsubscribe = onSnapshot(reviewsQuery, (snapshot) => {
      setReviews(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [completedOrderIds]);

  const reviewByOrderId = useMemo(() => {
    const map = {};
    reviews.forEach((r) => {
      map[r.orderId] = r;
    });
    return map;
  }, [reviews]);

  const handleRetry = () => setRetryToken((t) => t + 1);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6">
      <h1 className="text-2xl font-black text-gray-900">Reviews</h1>

      {loading ? (
        <div className="space-y-4">
          <OrderCardSkeleton />
          <OrderCardSkeleton />
        </div>
      ) : error ? (
        <div className="space-y-6">
          <EmptyState icon="⚠️" title="Something went wrong" description={error} />
          <div className="flex justify-center">
            <Button variant="outline" onClick={handleRetry}>
              Retry
            </Button>
          </div>
        </div>
      ) : completedOrders.length === 0 ? (
        <EmptyState
          icon="⭐"
          title="No orders to review yet"
          description="Once an order is completed, you'll be able to rate it here."
        />
      ) : (
        <div className="space-y-4">
          {completedOrders.map((order) => (
            <ReviewableOrderCard
              key={order.id}
              order={order}
              review={reviewByOrderId[order.id] ?? null}
              onWriteReview={setActiveOrder}
            />
          ))}
        </div>
      )}

      <ReviewModal
        order={activeOrder}
        open={!!activeOrder}
        onClose={() => setActiveOrder(null)}
        onSubmitted={() => {}}
      />
    </div>
  );
};
