import { Component } from "react";
import { logError } from "./errorCenter";

// Top-level error boundary (SSOT for render-time crash recovery). Without one, ANY render
// throw — or a failed lazy() chunk import, which is common on flaky mobile networks and after
// a redeploy when a stale tab requests an old chunk hash that now 404s — unmounts the whole
// React tree to a blank white screen with no way back. This catches those, logs through the
// ErrorCenter SSOT (no new logger), and shows a minimal reload prompt. Reloading re-fetches
// fresh chunks, which resolves the common chunk-load-error case.
//
// Styles are inline on purpose: the boundary must render even if the stylesheet itself failed
// to load. Bilingual copy (Thai primary + English) matches the app; no i18n/context is used
// because a boundary can't rely on context that may be part of what crashed.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    logError(error, "ErrorBoundary");
    if (info?.componentStack) console.error("[ErrorBoundary] componentStack", info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          padding: "24px",
          textAlign: "center",
          background: "#f9fafb",
          color: "#1f2937",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: "40px", lineHeight: 1 }}>🛠️</div>
        <p style={{ fontSize: "18px", fontWeight: 800, margin: 0 }}>เกิดข้อผิดพลาด กรุณาโหลดหน้าใหม่</p>
        <p style={{ fontSize: "13px", fontWeight: 500, color: "#6b7280", margin: 0 }}>
          Something went wrong. Please reload the page.
        </p>
        <button
          type="button"
          onClick={() => { try { window.location.reload(); } catch { /* ignore */ } }}
          style={{
            marginTop: "4px",
            padding: "10px 24px",
            borderRadius: "9999px",
            border: "none",
            background: "#00B14F",
            color: "#fff",
            fontWeight: 800,
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          โหลดใหม่ / Reload
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
