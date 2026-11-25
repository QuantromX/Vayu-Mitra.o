/**
 * Centralized typed application configuration shared across client and server modules.
 * Private secrets (such as GEMINI_API_KEY) remain strictly in server process.env.
 */

export const INDIA_BOUNDS = {
  minLat: 6,
  maxLat: 37.6,
  minLon: 68,
  maxLon: 97.5,
} as const;

export const APP_CONFIG = {
  cacheTtlMs: 10 * 60 * 1000,
  staleWhileRevalidateMs: 6 * 60 * 60 * 1000,
  upstreamTimeoutMs: 10_000,
  geminiTimeoutMs: 22_000,
  maxRetries: 2,
  retryBaseDelayMs: 250,
  maxPhotoBytes: 4 * 1024 * 1024,
  maxPhotoBase64Length: 6_000_000,
  maxQuestionLength: 300,
  minQuestionLength: 3,
  maxCityNameLength: 80,
  lowEndCoreThreshold: 4,
} as const;

export const SERVER_RATE_LIMITS = {
  windowMs: 60_000,
  advicePerMinute: 20,
  askPerMinute: 12,
  photoCheckPerMinute: 6,
} as const;

export const GEMINI_CONFIG = {
  models: ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const,
  quotaCooldownMs: 15 * 60 * 1000,
  cacheMaxEntries: 250,
} as const;

export const ALLOWED_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedPhotoMimeType = (typeof ALLOWED_PHOTO_MIME_TYPES)[number];

/**
 * Resolves the server port safely from environment configuration.
 */
export function getServerPort(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.PORT ?? 3000);
  if (!Number.isInteger(raw) || raw <= 0 || raw > 65535) {
    return 3000;
  }
  return raw;
}

/**
 * Resolves the list of allowed CORS origins anchored to the app's configured origin.
 */
export function getAllowedOrigins(
  port: number,
  env: NodeJS.ProcessEnv = process.env
): Set<string> {
  const origins = new Set<string>([
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);
  const appUrl = env.APP_URL?.trim();
  if (appUrl && appUrl !== 'MY_APP_URL') {
    try {
      origins.add(new URL(appUrl).origin);
    } catch {
      // Ignore malformed APP_URL values
    }
  }
  return origins;
}
