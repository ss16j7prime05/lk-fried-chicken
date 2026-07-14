// Cloudinary image upload service (unsigned) — reusable across the app.
//
// Uploads directly from the browser to Cloudinary using an *unsigned* upload
// preset, so no API secret ever ships to the client. Returns the CDN
// `secure_url`, which callers persist to Firestore.
//
// Config lives in src/config.js (CLOUDINARY_CLOUD_NAME / CLOUDINARY_UPLOAD_PRESET).
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "../config";

const UPLOAD_ENDPOINT = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

/**
 * Upload an image File/Blob to Cloudinary.
 *
 * @param {File|Blob} file  The image to upload (from a file input or a cropper blob).
 * @param {object} [opts]
 * @param {string} [opts.folder]   Optional Cloudinary folder (only send if the preset allows it).
 * @param {string} [opts.publicId] Optional public_id for the asset.
 * @param {AbortSignal} [opts.signal] Optional abort signal.
 * @returns {Promise<string>} The uploaded asset's https `secure_url`.
 * @throws {Error} If no file is given or Cloudinary rejects the upload.
 */
export async function uploadImage(file, opts = {}) {
  if (!file) throw new Error("uploadImage: no file provided");

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  if (opts.folder) form.append("folder", opts.folder);
  if (opts.publicId) form.append("public_id", opts.publicId);

  let res;
  try {
    res = await fetch(UPLOAD_ENDPOINT, { method: "POST", body: form, signal: opts.signal });
  } catch (e) {
    // Network / CORS / offline
    throw new Error(`Cloudinary upload failed: ${e?.message || "network error"}`, { cause: e });
  }

  if (!res.ok) {
    // Cloudinary returns { error: { message } } on failure
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error?.message) detail = body.error.message;
    } catch { /* non-JSON error body */ }
    throw new Error(`Cloudinary upload failed: ${detail}`);
  }

  const data = await res.json();
  if (!data?.secure_url) throw new Error("Cloudinary upload failed: missing secure_url");
  return data.secure_url;
}
