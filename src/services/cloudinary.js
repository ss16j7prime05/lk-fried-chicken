// Cloudinary image upload service (unsigned) — the ONE upload path for the whole app.
//
// Every image in the app (menu photos, store logo/cover, PromptPay QR, payment
// slips, customer/rider avatars, registration documents) goes through
// `uploadImage()`. It uploads directly from the browser to Cloudinary using an
// *unsigned* upload preset, so no API secret ever ships to the client, and it
// persists only the returned CDN `secure_url` to Firestore.
//
// Firebase Storage is intentionally NOT used — this project has no Storage bucket
// provisioned, so uploadBytes() 404s/hangs. Cloudinary is the single source.
//
// What this service guarantees for mobile + desktop:
//   • Accepts JPG/JPEG/PNG/WEBP/GIF and HEIC/HEIF (iPhone) — by MIME or extension.
//   • Converts HEIC/HEIF and shrinks oversized photos client-side to a compressed
//     JPEG (canvas), honouring EXIF orientation so iPhone photos aren't sideways.
//     Formats already web-friendly and small are left untouched (quality preserved).
//   • Uploads via XMLHttpRequest so callers get real upload progress (onProgress).
//   • Per-attempt timeout + automatic retry with backoff on transient network/5xx
//     errors, so slow mobile networks recover instead of failing.
//   • Always settles (resolve or reject) — it can never leave a caller hanging.
//   • Clear Error messages (with a `.kind` tag) so callers can show useful text.
//
// Config lives in src/config.js (CLOUDINARY_CLOUD_NAME / CLOUDINARY_UPLOAD_PRESET).
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "../config";

const UPLOAD_ENDPOINT = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// Accepted inputs. HEIC/HEIF included for iPhone; some mobile browsers report an
// empty or generic MIME for HEIC, so we also accept by file extension.
const ACCEPTED_MIME = [
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "image/gif", "image/heic", "image/heif", "image/bmp",
];
const ACCEPTED_EXT = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "bmp"];

// Formats the browser can reliably decode into a canvas for client-side
// compression. (HEIC decodes on Apple/WebKit; elsewhere createImageBitmap simply
// throws and we upload the original, which is fine.)
const WEB_FORMATS = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

// Downscale/compress thresholds — generous so we only touch genuinely large photos.
const MAX_DIMENSION = 2000;                 // px, longest edge
const COMPRESS_OVER_BYTES = 2 * 1024 * 1024; // 2 MB
const JPEG_QUALITY = 0.9;                    // high — preserve slip/QR readability

// Upload resilience.
const DEFAULT_TIMEOUT_MS = 60 * 1000; // per attempt — slow mobile friendly
const DEFAULT_RETRIES = 2;            // => up to 3 attempts total
const RETRYABLE_KINDS = new Set(["network", "timeout", "server"]);

const extOf = (name = "") => (name.includes(".") ? name.split(".").pop().toLowerCase() : "");

function makeErr(kind, message, status) {
  const e = new Error(message);
  e.kind = kind;
  if (status != null) e.status = status;
  return e;
}

function isHeic(file) {
  const type = (file.type || "").toLowerCase();
  return type.includes("heic") || type.includes("heif") || ["heic", "heif"].includes(extOf(file.name));
}

function isAcceptedImage(file) {
  const type = (file.type || "").toLowerCase();
  if (type && ACCEPTED_MIME.includes(type)) return true;
  const ext = extOf(file.name);
  if (ext && ACCEPTED_EXT.includes(ext)) return true;
  // In-app generated blobs (e.g. the banner cropper) may carry no name/type; a
  // Blob typed as an image, or a bare Blob from our own canvas, is trusted.
  if (type.startsWith("image/")) return true;
  if (!type && !file.name) return true;
  return false;
}

// Convert HEIC/HEIF and shrink oversized photos to a compressed JPEG. Returns the
// original file untouched when it's already a small web-friendly image, or when
// the browser can't decode it (then Cloudinary receives the original).
async function processImage(file) {
  const type = (file.type || "").toLowerCase();
  const heic = isHeic(file);
  const webFriendly = WEB_FORMATS.includes(type);
  const tooBig = file.size > COMPRESS_OVER_BYTES;

  // Already a small web format that doesn't need conversion → keep as-is (no
  // re-encode, so quality is preserved exactly).
  if (webFriendly && !tooBig && !heic) return file;

  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;

  let bitmap;
  try {
    // imageOrientation:"from-image" bakes in EXIF rotation (iPhone photos).
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Some engines reject the options arg — retry plain before giving up, so we
    // still convert HEIC (just without the EXIF-orientation fix).
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      return file; // genuinely undecodable (e.g. HEIC on Android) → upload original
    }
  }

  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", JPEG_QUALITY));
    if (!blob) return file;
    // If we didn't NEED to convert (not HEIC) and the re-encode saved nothing,
    // keep the original to avoid a pointless quality loss.
    if (!heic && blob.size >= file.size) return file;

    const base = (file.name || "image").replace(/\.[^.]+$/, "");
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  } finally {
    bitmap.close?.();
  }
}

// One upload attempt over XHR (so we get upload-progress events, unlike fetch).
function uploadOnce(file, { onProgress, folder, publicId, timeoutMs, signal }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(makeErr("aborted", "Upload cancelled"));
      return;
    }

    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    if (folder) form.append("folder", folder);
    if (publicId) form.append("public_id", publicId);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", UPLOAD_ENDPOINT, true);
    xhr.timeout = timeoutMs;

    const onAbort = () => xhr.abort();
    signal?.addEventListener("abort", onAbort);
    const cleanup = () => signal?.removeEventListener("abort", onAbort);

    if (xhr.upload && typeof onProgress === "function") {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      };
    }

    xhr.onload = () => {
      cleanup();
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* non-JSON body */ }
      if (xhr.status >= 200 && xhr.status < 300 && data?.secure_url) {
        onProgress?.(100);
        resolve(data.secure_url);
        return;
      }
      const detail = data?.error?.message || `HTTP ${xhr.status || 0}`;
      // 4xx = our request (bad file/preset) → don't retry; else treat as server.
      const kind = xhr.status >= 400 && xhr.status < 500 ? "client" : "server";
      reject(makeErr(kind, `Cloudinary upload failed: ${detail}`, xhr.status));
    };
    xhr.onerror = () => { cleanup(); reject(makeErr("network", "Cloudinary upload failed: network error")); };
    xhr.ontimeout = () => { cleanup(); reject(makeErr("timeout", "Cloudinary upload timed out")); };
    xhr.onabort = () => { cleanup(); reject(makeErr("aborted", "Upload cancelled")); };

    xhr.send(form);
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Upload an image File/Blob to Cloudinary and return its https `secure_url`.
 *
 * @param {File|Blob} file  Image from a file input, camera, or a cropper blob.
 * @param {object} [opts]
 * @param {(percent:number)=>void} [opts.onProgress] Upload progress 0–100.
 * @param {string}   [opts.folder]    Cloudinary folder (only if the preset allows it).
 * @param {string}   [opts.publicId]  Optional public_id for the asset.
 * @param {AbortSignal} [opts.signal] Cancel the upload.
 * @param {number}   [opts.timeoutMs] Per-attempt timeout (default 60s).
 * @param {number}   [opts.retries]   Retries on transient errors (default 2).
 * @param {boolean}  [opts.compress]  Client-side convert/compress (default true).
 * @returns {Promise<string>} The uploaded asset's https `secure_url`.
 * @throws {Error} With a `.kind` of client|network|timeout|server|aborted.
 */
export async function uploadImage(file, opts = {}) {
  if (!file) throw makeErr("client", "uploadImage: no file provided");
  if (!isAcceptedImage(file)) {
    throw makeErr("client", `Unsupported image type: ${file.type || extOf(file.name) || "unknown"}`);
  }

  const {
    onProgress, folder, publicId, signal,
    timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES, compress = true,
  } = opts;

  const toUpload = compress ? await processImage(file) : file;

  let attempt = 0;
  for (;;) {
    try {
      return await uploadOnce(toUpload, { onProgress, folder, publicId, timeoutMs, signal });
    } catch (err) {
      attempt += 1;
      if (attempt > retries || !RETRYABLE_KINDS.has(err?.kind)) throw err;
      onProgress?.(0); // reset the bar for the retry
      await wait(Math.min(8000, 1000 * 2 ** (attempt - 1))); // 1s, 2s, 4s…
    }
  }
}
