// Centre-crop an image File to a square and downscale to `size` px, returning a JPEG File
// (ready for the Cloudinary uploader) plus an object-URL preview for the circular avatar.
// No external dependency — plain canvas. A deterministic centre-square crop is enough for
// an avatar; callers should fall back to the original file if this throws (e.g. a browser
// that can't decode HEIC into an <img>).
export async function cropToSquare(file, size = 512) {
  const srcUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(srcUrl);
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error("cropToSquare: image has no dimensions");
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("cropToSquare: no 2d context");
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("cropToSquare: toBlob failed"))), "image/jpeg", 0.9);
    });
    const cropped = new File([blob], "profile.jpg", { type: "image/jpeg" });
    return { file: cropped, preview: URL.createObjectURL(blob) };
  } finally {
    URL.revokeObjectURL(srcUrl);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("cropToSquare: image decode failed"));
    img.src = src;
  });
}
