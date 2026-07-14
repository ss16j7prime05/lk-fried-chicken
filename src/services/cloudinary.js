// Cloudinary image upload service (unsigned) — reusable across the app.
//
// Uploads directly from the browser to Cloudinary using an *unsigned* upload
// preset, so no API secret ever ships to the client.
//
// This function NEVER throws for network/HTTP errors — it returns a structured
// result so the caller can surface full debug info (URL, status, response body,
// error message) in the UI and always clear its loading state.
//
// Config lives in src/config.js (CLOUDINARY_CLOUD_NAME / CLOUDINARY_UPLOAD_PRESET).
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "../config";

// Exported so callers (and the on-screen debug panel) can show the exact values.
export const UPLOAD_ENDPOINT = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
export const CLOUD_NAME = CLOUDINARY_CLOUD_NAME;
export const UPLOAD_PRESET = CLOUDINARY_UPLOAD_PRESET;

/**
 * @typedef {Object} CloudinaryResult
 * @property {boolean} ok            Whether the upload succeeded.
 * @property {string}  url           The upload endpoint that was POSTed to.
 * @property {string}  cloudName     Cloud name used.
 * @property {string}  uploadPreset  Upload preset used.
 * @property {number}  status        HTTP status (0 if fetch() itself threw).
 * @property {*}       body          Parsed JSON (or raw text) of the response.
 * @property {string}  secureUrl     https CDN URL on success (else "").
 * @property {string}  errorMessage  Human-readable failure reason (else "").
 */

/**
 * Upload an image File/Blob to Cloudinary (unsigned).
 * @param {File|Blob} file
 * @param {{ folder?: string, publicId?: string, signal?: AbortSignal }} [opts]
 * @returns {Promise<CloudinaryResult>}
 */
export async function uploadImage(file, opts = {}) {
  /** @type {CloudinaryResult} */
  const result = {
    ok: false,
    url: UPLOAD_ENDPOINT,
    cloudName: CLOUDINARY_CLOUD_NAME,
    uploadPreset: CLOUDINARY_UPLOAD_PRESET,
    status: 0,
    body: null,
    secureUrl: "",
    errorMessage: "",
  };

  if (!file) {
    result.errorMessage = "no file provided";
    return result;
  }

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  if (opts.folder) form.append("folder", opts.folder);
  if (opts.publicId) form.append("public_id", opts.publicId);

  // Log exactly what we're about to POST so a misconfigured cloud name / preset is
  // obvious in the browser console before the request goes out.
  console.info("[cloudinary] upload URL    =", UPLOAD_ENDPOINT);
  console.info("[cloudinary] cloud_name    =", CLOUDINARY_CLOUD_NAME);
  console.info("[cloudinary] upload_preset =", CLOUDINARY_UPLOAD_PRESET);

  let res;
  try {
    res = await fetch(UPLOAD_ENDPOINT, { method: "POST", body: form, signal: opts.signal });
  } catch (e) {
    // Network / CORS / offline — surface the exact underlying error.
    console.error("[cloudinary] fetch() failed:", e);
    result.errorMessage = e?.message || "network error (fetch failed)";
    return result;
  }

  result.status = res.status;

  // Read as text first, then try JSON — so we always have a body to display,
  // even when Cloudinary returns a non-JSON error page.
  let text = "";
  try { text = await res.text(); } catch { /* ignore read error */ }
  try { result.body = text ? JSON.parse(text) : null; } catch { result.body = text; }

  if (!res.ok) {
    result.errorMessage = result.body?.error?.message || `HTTP ${res.status}`;
    console.error("[cloudinary] upload failed:", res.status, result.body);
    return result;
  }

  const secureUrl = result.body?.secure_url;
  if (!secureUrl) {
    result.errorMessage = "missing secure_url in Cloudinary response";
    return result;
  }

  result.ok = true;
  result.secureUrl = secureUrl;
  return result;
}
