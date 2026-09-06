/**
 * Gallery ImageOptimizer (SDD 4.6; Task 10A-FIX3).
 *
 * Client-side resize/compress step that runs between file selection and
 * `requestUploadUrl` (see galleryService.uploadPhoto): "Select photo →
 * validate supported image → resize/compress image client-side →
 * request signed upload URL → upload optimized image → confirm upload."
 *
 * Deliberately dependency-free — built entirely on standard browser
 * APIs (createImageBitmap/HTMLImageElement + <canvas>), consistent with
 * "prefer a small reusable utility over a new dependency." There is no
 * server-side image-processing service: the Edge Function's existing
 * MIME/size validation (SEC-020/021/022) is still authoritative and is
 * NOT weakened — this module only ever produces a file that must still
 * pass those same checks (re-verified client-side in
 * galleryService.uploadPhoto before the optimized file is used).
 *
 * `optimizeGalleryImage()` never throws: any unsupported browser API,
 * decode failure, or unexpected error falls back to returning the
 * original, unmodified file (requirement: "handle unsupported/error
 * cases gracefully and fall back safely rather than crashing").
 */

/** Mirrors the server's GALLERY_ALLOWED_MIME_TYPES (supabase/functions/_shared/validation.ts) — kept as the single client-side copy, imported by both UploadPhotoDialog and galleryService rather than duplicated. */
export const GALLERY_CLIENT_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'] as const;
/** Mirrors the server's GALLERY_MAX_FILE_SIZE_BYTES / the `gallery` storage bucket's file_size_limit (migration 0004) — a convenience pre-check only; the server re-validates authoritatively. */
export const GALLERY_CLIENT_MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

/** Long-edge cap in pixels. Large enough for full-screen viewing/zoom
 * (FR-GAL-012) on modern phone/tablet screens, well below what phone
 * cameras natively capture (typically 3000-4000px+), so this reliably
 * cuts file size on the excessively-large images the requirement is
 * concerned with. */
export const GALLERY_OPTIMIZER_MAX_DIMENSION = 2000;

/** JPEG output quality — keeps devotional-photo detail/text legible while meaningfully reducing file size versus camera-original JPEGs. */
export const GALLERY_OPTIMIZER_JPEG_QUALITY = 0.82;

export function isSupportedGalleryMimeType(mimeType: string): boolean {
  return (GALLERY_CLIENT_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function isWithinGalleryFileSizeLimit(size: number): boolean {
  return Number.isFinite(size) && size > 0 && size <= GALLERY_CLIENT_MAX_FILE_SIZE_BYTES;
}

interface Drawable {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

/**
 * Decodes `file` into something <canvas> can draw, preserving EXIF
 * orientation. Prefers `createImageBitmap(file, { imageOrientation:
 * 'from-image' })`, which bakes the correct orientation into the
 * decoded pixels/dimensions directly. Falls back to an HTMLImageElement
 * when createImageBitmap is unavailable or rejects — browsers apply
 * EXIF orientation by default when decoding for display (CSS
 * `image-orientation: from-image` is the default), so naturalWidth/
 * naturalHeight and drawImage() output are already correctly oriented
 * there too.
 */
async function loadDrawable(file: File): Promise<Drawable> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, cleanup: () => bitmap.close() };
    } catch {
      // Some browsers support createImageBitmap but not the
      // imageOrientation option, or fail on a given file — fall
      // through to the <img> path below rather than giving up.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to decode image for optimization.'));
      el.src = objectUrl;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((blob) => resolve(blob), type, quality);
      return;
    }
    // Very old browsers only: no canvas.toBlob support.
    try {
      const dataUrl = canvas.toDataURL(type, quality);
      const [meta, base64] = dataUrl.split(',');
      const mimeMatch = /data:(.*?);base64/.exec(meta);
      if (!mimeMatch || !base64) {
        resolve(null);
        return;
      }
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      resolve(new Blob([bytes], { type: mimeMatch[1] }));
    } catch {
      resolve(null);
    }
  });
}

/**
 * Scans the canvas's alpha channel so a PNG is only ever kept as PNG
 * (rather than converted to JPEG for better compression) when it
 * actually uses transparency — "do not blindly convert images if that
 * would damage required transparency." Any failure to read pixel data
 * conservatively assumes transparency IS in use, so it is never lost.
 */
function hasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    const { data } = ctx.getImageData(0, 0, width, height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
    return false;
  } catch {
    return true;
  }
}

function withOptimizedExtension(originalName: string, mimeType: string): string {
  const base = originalName.replace(/\.[^./\\]+$/, '') || 'photo';
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  return `${base}.${ext}`;
}

/**
 * Resizes `file` down to at most GALLERY_OPTIMIZER_MAX_DIMENSION on its
 * long edge (never upscales smaller images) and re-encodes it — JPEGs
 * stay JPEGs at GALLERY_OPTIMIZER_JPEG_QUALITY; PNGs are converted to
 * JPEG too UNLESS they actually use transparency, in which case they
 * stay PNG (lossless) to avoid damaging that transparency. Always
 * resolves; never rejects. If optimization doesn't actually shrink the
 * file (e.g. it was already small/well-compressed), the original file
 * is returned instead so optimization can never make an upload larger.
 */
export async function optimizeGalleryImage(file: File): Promise<File> {
  if (typeof document === 'undefined' || typeof HTMLCanvasElement === 'undefined') {
    return file; // Non-browser environment — nothing to do safely.
  }
  if (!isSupportedGalleryMimeType(file.type)) {
    return file; // Unknown/unsupported type: never guess, leave untouched.
  }

  let drawable: Drawable | null = null;
  try {
    drawable = await loadDrawable(file);
    const { source, width, height } = drawable;
    if (!width || !height) return file;

    const scale = Math.min(1, GALLERY_OPTIMIZER_MAX_DIMENSION / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

    const outputType =
      file.type === 'image/png' && hasTransparency(ctx, targetWidth, targetHeight) ? 'image/png' : 'image/jpeg';
    const quality = outputType === 'image/jpeg' ? GALLERY_OPTIMIZER_JPEG_QUALITY : undefined;

    const blob = await canvasToBlob(canvas, outputType, quality);
    if (!blob || blob.size === 0) return file;

    const optimized = new File([blob], withOptimizedExtension(file.name, outputType), {
      type: outputType,
      lastModified: Date.now(),
    });

    // Optimization should never make things worse than the original.
    return optimized.size < file.size ? optimized : file;
  } catch {
    return file;
  } finally {
    drawable?.cleanup();
  }
}
