import { ALLOWED_PHOTO_MIME_TYPES, MAX_PHOTO_BYTES } from './schema.ts';

export type AllowedPhotoMimeType = (typeof ALLOWED_PHOTO_MIME_TYPES)[number];

export interface ValidatedPhotoResult {
  valid: boolean;
  errorEn?: string;
  errorHi?: string;
}

export interface StrippedPhotoPayload {
  mimeType: AllowedPhotoMimeType;
  imageBase64: string;
  byteSize: number;
  previewUrl: string;
}

/**
 * Validates file MIME type (jpeg/png/webp) and file size (<= 4 MB) before decoding.
 */
export function validatePhotoFile(file: {
  type: string;
  size: number;
}): ValidatedPhotoResult {
  const isAllowedType = (ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(
    file.type
  );
  if (!isAllowedType) {
    return {
      valid: false,
      errorEn: 'Please upload a JPEG, PNG, or WebP image.',
      errorHi: 'कृपया केवल JPEG, PNG या WebP फ़ोटो अपलोड करें।',
    };
  }
  if (file.size <= 0) {
    return {
      valid: false,
      errorEn: 'Selected image file is empty.',
      errorHi: 'चुनी गई फ़ोटो फ़ाइल खाली है।',
    };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return {
      valid: false,
      errorEn: 'Image must be 4 MB or smaller.',
      errorHi: 'फ़ोटो का आकार 4 MB या उससे कम होना चाहिए।',
    };
  }
  return { valid: true };
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image file.'));
    img.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: AllowedPhotoMimeType,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to re-encode stripped image.'));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      if (commaIdx === -1) {
        reject(new Error('Unexpected base64 encoding output.'));
        return;
      }
      resolve(result.slice(commaIdx + 1));
    };
    reader.onerror = () => reject(new Error('Failed to read stripped image.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Strips all EXIF/GPS/camera metadata client-side by redrawing the uploaded image
 * onto an offscreen canvas (capped at 1440px longest side) and exporting a clean Blob.
 */
export async function stripExifFromImage(file: File): Promise<StrippedPhotoPayload> {
  const check = validatePhotoFile(file);
  if (!check.valid) {
    throw new Error(check.errorEn ?? 'Invalid image file.');
  }

  const rawObjectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(rawObjectUrl);
    const maxDim = 1440;
    const scale = Math.min(
      1,
      maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1)
    );
    const targetW = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    const targetH = Math.max(1, Math.round((img.naturalHeight || 1) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable.');
    }
    ctx.drawImage(img, 0, 0, targetW, targetH);

    // Re-encoding via canvas strips all EXIF, IPTC, XMP, and GPS metadata headers
    const outputMime: AllowedPhotoMimeType =
      file.type === 'image/png'
        ? 'image/png'
        : file.type === 'image/webp'
          ? 'image/webp'
          : 'image/jpeg';

    const cleanBlob = await canvasToBlob(canvas, outputMime, 0.85);
    if (cleanBlob.size > MAX_PHOTO_BYTES) {
      throw new Error('Processed image exceeds 4 MB limit.');
    }

    const imageBase64 = await blobToBase64(cleanBlob);
    const previewUrl = URL.createObjectURL(cleanBlob);

    return {
      mimeType: outputMime,
      imageBase64,
      byteSize: cleanBlob.size,
      previewUrl,
    };
  } finally {
    URL.revokeObjectURL(rawObjectUrl);
  }
}
