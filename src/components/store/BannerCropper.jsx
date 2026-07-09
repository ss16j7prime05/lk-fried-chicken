import { useCallback, useEffect, useRef, useState } from "react";
import { X, Loader2, ZoomIn } from "lucide-react";
import { usePreferences } from "../../context/PreferencesContext";

/*
  Self-contained banner cropper — no external crop library.
  Loads the picked File, lets the user drag to reposition + zoom, then renders
  the visible 2:1 frame to a canvas and returns a JPEG Blob to the caller.
  The Blob is uploaded to the same storeBanner path, so no schema/collection change.
*/
const ASPECT = 2; // width / height (2:1 storefront banner)
const OUT_W = 1200;
const OUT_H = OUT_W / ASPECT; // 600

export default function BannerCropper({ file, onCancel, onCropped }) {
  const { t } = usePreferences();
  const frameRef = useRef(null);
  const dragRef = useRef(null);

  const [src, setSrc] = useState("");
  const [img, setImg] = useState(null); // { w, h, el }
  const [frameW, setFrameW] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);

  /* load the picked file → object URL + natural dimensions */
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSrc(url);
    const el = new Image();
    el.onload = () => setImg({ w: el.naturalWidth, h: el.naturalHeight, el });
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  /* measure the frame width so canvas math matches what the user sees */
  useEffect(() => {
    const measure = () => setFrameW(frameRef.current?.offsetWidth || 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [src]);

  const frameH = frameW / ASPECT;
  const baseScale = img && frameW ? Math.max(frameW / img.w, frameH / img.h) : 1;
  const dispW = img ? img.w * baseScale * zoom : 0;
  const dispH = img ? img.h * baseScale * zoom : 0;

  const clamp = useCallback(
    (o, w = dispW, h = dispH) => ({
      x: Math.min(0, Math.max(frameW - w, o.x)),
      y: Math.min(0, Math.max(frameH - h, o.y)),
    }),
    [frameW, frameH, dispW, dispH]
  );

  /* center the image once it's loaded and the frame is measured */
  useEffect(() => {
    if (!img || !frameW) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOffset({ x: (frameW - dispW) / 2, y: (frameH - dispH) / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, frameW]);

  /* zoom around the frame center so the focal point stays put */
  const applyZoom = (nz) => {
    if (!img || !frameW) { setZoom(nz); return; }
    const cx = frameW / 2, cy = frameH / 2;
    const fracX = dispW ? (cx - offset.x) / dispW : 0.5;
    const fracY = dispH ? (cy - offset.y) / dispH : 0.5;
    const nW = img.w * baseScale * nz;
    const nH = img.h * baseScale * nz;
    setZoom(nz);
    setOffset(clamp({ x: cx - fracX * nW, y: cy - fracY * nH }, nW, nH));
  };

  const onPointerDown = (e) => {
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const d = dragRef.current;
    setOffset(clamp({ x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) }));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const handleApply = () => {
    if (!img || !frameW) return;
    setBusy(true);
    const canvas = document.createElement("canvas");
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const k = OUT_W / frameW; // frame → output scale (same for both axes)
    ctx.drawImage(img.el, offset.x * k, offset.y * k, dispW * k, dispH * k);
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (blob) onCropped(blob);
      },
      "image/jpeg",
      0.9
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <p className="text-base font-black text-gray-900">{t("si.cropBanner")}</p>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t("si.cancel")}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* crop frame */}
        <div className="px-5 py-5 space-y-4 overflow-y-auto">
          <div
            ref={frameRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{ aspectRatio: `${ASPECT}` }}
            className="relative w-full overflow-hidden rounded-xl bg-gray-100 touch-none cursor-grab active:cursor-grabbing select-none"
          >
            {src && img && (
              <img
                src={src}
                alt="banner preview"
                draggable={false}
                style={{
                  position: "absolute",
                  left: offset.x,
                  top: offset.y,
                  width: dispW,
                  height: dispH,
                  maxWidth: "none",
                }}
              />
            )}
            {/* rule-of-thirds guide */}
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="border border-white/20" />
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-400 font-medium text-center">{t("si.dragHint")}</p>

          {/* zoom slider */}
          <div className="flex items-center gap-3">
            <ZoomIn size={16} className="text-gray-400 flex-shrink-0" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={(e) => applyZoom(parseFloat(e.target.value))}
              aria-label={t("si.zoom")}
              className="flex-1 accent-primary"
            />
          </div>
        </div>

        {/* actions */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-50">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 min-h-[44px] rounded-xl border-2 border-gray-200 text-gray-600 text-sm font-black hover:bg-gray-50 transition-colors"
          >
            {t("si.cancel")}
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={busy || !img}
            className="flex-1 py-3 min-h-[44px] rounded-xl bg-primary text-white text-sm font-black hover:bg-primary-dark disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {t("si.apply")}
          </button>
        </div>
      </div>
    </div>
  );
}
