import { APP_CONFIG } from '../config.ts';
import { UpstreamApiError } from '../errors.ts';
import type {
  AirQualityData,
  CityLocation,
  HourlyPollutantPoint,
  WeatherData,
} from '../../types/index.ts';

interface CacheEntry<T> {
  expiresAt: number;
  staleUntil: number;
  value: T;
}

export interface FetchOptions {
  forceRefresh?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
}

export interface OfflineSnapshot {
  air: AirQualityData;
  weather: WeatherData;
  savedAt: string;
}

const OFFLINE_SNAPSHOT_PREFIX = 'vayumitra_last_snapshot_v1:';

const geoCache = new Map<string, CacheEntry<CityLocation[]>>();
const airCache = new Map<string, CacheEntry<AirQualityData>>();
const weatherCache = new Map<string, CacheEntry<WeatherData>>();

const inFlightGeo = new Map<string, Promise<CityLocation[]>>();
const inFlightAir = new Map<string, Promise<AirQualityData>>();
const inFlightWeather = new Map<string, Promise<WeatherData>>();

function coordKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

function assertValidCoordinates(latitude: number, longitude: number): void {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new UpstreamApiError('Invalid geographic coordinates.', {
      statusCode: 400,
    });
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function fetchJsonWithTimeoutAndRetry<T>(
  url: string,
  errorLabel: string,
  options?: Pick<FetchOptions, 'signal' | 'timeoutMs' | 'maxRetries' | 'retryBaseDelayMs'>
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? APP_CONFIG.upstreamTimeoutMs;
  const maxRetries = options?.maxRetries ?? APP_CONFIG.maxRetries;
  const baseDelayMs = options?.retryBaseDelayMs ?? APP_CONFIG.retryBaseDelayMs;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (options?.signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }

    const timeoutController = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      timeoutController.abort();
    }, timeoutMs);

    const onExternalAbort = () => timeoutController.abort();
    options?.signal?.addEventListener('abort', onExternalAbort, { once: true });

    try {
      const response = await fetch(url, { signal: timeoutController.signal });
      if (!response.ok) {
        const err = new UpstreamApiError(`${errorLabel} (HTTP ${response.status})`, {
          upstreamStatus: response.status,
        });
        if (!isRetryableStatus(response.status) || attempt === maxRetries) {
          throw err;
        }
        lastError = err;
      } else {
        return (await response.json()) as T;
      }
    } catch (err) {
      if (options?.signal?.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }
      if (err instanceof UpstreamApiError && err.upstreamStatus !== undefined) {
        if (!isRetryableStatus(err.upstreamStatus) || attempt === maxRetries) {
          throw err;
        }
        lastError = err;
      } else if (timedOut) {
        const timeoutErr = new UpstreamApiError(
          `${errorLabel} timed out after ${timeoutMs}ms`,
          {
            statusCode: 504,
            isTimeout: true,
            cause: err,
          }
        );
        if (attempt === maxRetries) {
          throw timeoutErr;
        }
        lastError = timeoutErr;
      } else {
        if (attempt === maxRetries) {
          throw err instanceof UpstreamApiError
            ? err
            : new UpstreamApiError(
                err instanceof Error ? err.message : `${errorLabel} failed`,
                { cause: err }
              );
        }
        lastError = err;
      }
    } finally {
      clearTimeout(timeoutId);
      options?.signal?.removeEventListener('abort', onExternalAbort);
    }

    const backoffMs = baseDelayMs * Math.pow(2, attempt);
    await sleep(backoffMs, options?.signal);
  }

  throw lastError instanceof Error
    ? lastError
    : new UpstreamApiError(`${errorLabel} failed`);
}

/**
 * Searches Indian cities using Open-Meteo's free Geocoding API with 10-minute caching,
 * stale-while-revalidate, timeout/retry guards, and concurrent request deduplication.
 */
export async function searchIndianCities(
  query: string,
  signalOrOptions?: AbortSignal | FetchOptions
): Promise<CityLocation[]> {
  const options: FetchOptions =
    signalOrOptions && 'aborted' in signalOrOptions
      ? { signal: signalOrOptions }
      : (signalOrOptions ?? {});

  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const cacheKey = trimmed.toLowerCase();
  const now = Date.now();
  const cached = geoCache.get(cacheKey);
  if (!options.forceRefresh && cached && cached.expiresAt > now) {
    return cached.value;
  }

  const runFetch = async (): Promise<CityLocation[]> => {
    const existing = inFlightGeo.get(cacheKey);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
        url.searchParams.set('name', trimmed);
        url.searchParams.set('count', '5');
        url.searchParams.set('countryCode', 'IN');
        url.searchParams.set('language', 'en');

        const json = await fetchJsonWithTimeoutAndRetry<{
          results?: Array<{
            id: number;
            name: string;
            admin1?: string;
            latitude: number;
            longitude: number;
          }>;
        }>(url.toString(), 'City search failed', options);

        const results: CityLocation[] = (json.results ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          admin1: item.admin1,
          latitude: item.latitude,
          longitude: item.longitude,
        }));

        const stamp = Date.now();
        geoCache.set(cacheKey, {
          expiresAt: stamp + APP_CONFIG.cacheTtlMs,
          staleUntil: stamp + APP_CONFIG.staleWhileRevalidateMs,
          value: results,
        });

        return results;
      } finally {
        inFlightGeo.delete(cacheKey);
      }
    })();

    inFlightGeo.set(cacheKey, promise);
    return promise;
  };

  if (!options.forceRefresh && cached && cached.staleUntil > now) {
    void runFetch().catch(() => {
      // Stale-while-revalidate background refresh failed silently; fresh value remains cached as stale.
    });
    return cached.value;
  }

  return runFetch();
}

/**
 * Fetches live current and hourly PM2.5 / PM10 data from Open-Meteo Air Quality API
 * in Asia/Kolkata timezone, with 10-minute caching, stale-while-revalidate, retries, and deduplication.
 */
export async function fetchAirQuality(
  latitude: number,
  longitude: number,
  options?: FetchOptions
): Promise<AirQualityData> {
  assertValidCoordinates(latitude, longitude);
  const key = coordKey(latitude, longitude);
  const now = Date.now();
  const cached = airCache.get(key);
  if (!options?.forceRefresh && cached && cached.expiresAt > now) {
    return cached.value;
  }

  const runFetch = async (): Promise<AirQualityData> => {
    if (!options?.forceRefresh) {
      const pending = inFlightAir.get(key);
      if (pending) return pending;
    }

    const requestPromise = (async () => {
      try {
        const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
        url.searchParams.set('latitude', String(latitude));
        url.searchParams.set('longitude', String(longitude));
        url.searchParams.set('current', 'pm2_5,pm10');
        url.searchParams.set('hourly', 'pm2_5,pm10');
        url.searchParams.set('past_days', '1');
        url.searchParams.set('forecast_days', '2');
        url.searchParams.set('timezone', 'Asia/Kolkata');

        const json = await fetchJsonWithTimeoutAndRetry<{
          latitude: number;
          longitude: number;
          current?: {
            time?: string;
            pm2_5?: number;
            pm10?: number;
          };
          hourly?: {
            time?: string[];
            pm2_5?: Array<number | null>;
            pm10?: Array<number | null>;
          };
        }>(url.toString(), 'Open-Meteo air quality error', options);

        if (
          !json.current ||
          typeof json.current.pm2_5 !== 'number' ||
          typeof json.current.pm10 !== 'number' ||
          !json.current.time
        ) {
          throw new UpstreamApiError(
            'Incomplete live air-quality payload from Open-Meteo.'
          );
        }

        const times = json.hourly?.time ?? [];
        const pm25Series = json.hourly?.pm2_5 ?? [];
        const pm10Series = json.hourly?.pm10 ?? [];

        const hourly: HourlyPollutantPoint[] = times.map((time, idx) => {
          const pm25Val = pm25Series[idx];
          const pm10Val = pm10Series[idx];
          return {
            time,
            hourLabel: time.slice(11, 16),
            dayLabel: 'Today',
            isCurrentHour: false,
            pm2_5: typeof pm25Val === 'number' ? pm25Val : null,
            pm10: typeof pm10Val === 'number' ? pm10Val : null,
            naqi: null,
            category: null,
          };
        });

        const parsed: AirQualityData = {
          latitude: json.latitude,
          longitude: json.longitude,
          currentTime: json.current.time,
          currentPm25: Number(json.current.pm2_5.toFixed(1)),
          currentPm10: Number(json.current.pm10.toFixed(1)),
          hourly,
          fetchedAt: new Date().toISOString(),
        };

        const stamp = Date.now();
        airCache.set(key, {
          expiresAt: stamp + APP_CONFIG.cacheTtlMs,
          staleUntil: stamp + APP_CONFIG.staleWhileRevalidateMs,
          value: parsed,
        });

        return parsed;
      } finally {
        inFlightAir.delete(key);
      }
    })();

    if (!options?.forceRefresh) {
      inFlightAir.set(key, requestPromise);
    }
    return requestPromise;
  };

  if (!options?.forceRefresh && cached && cached.staleUntil > now) {
    void runFetch().catch(() => {
      // Stale-while-revalidate refresh failed silently; existing snapshot stays available.
    });
    return cached.value;
  }

  return runFetch();
}

/**
 * Fetches live current weather conditions from Open-Meteo Forecast API
 * in Asia/Kolkata timezone, with 10-minute caching, stale-while-revalidate, retries, and deduplication.
 */
export async function fetchWeather(
  latitude: number,
  longitude: number,
  options?: FetchOptions
): Promise<WeatherData> {
  assertValidCoordinates(latitude, longitude);
  const key = coordKey(latitude, longitude);
  const now = Date.now();
  const cached = weatherCache.get(key);
  if (!options?.forceRefresh && cached && cached.expiresAt > now) {
    return cached.value;
  }

  const runFetch = async (): Promise<WeatherData> => {
    if (!options?.forceRefresh) {
      const pending = inFlightWeather.get(key);
      if (pending) return pending;
    }

    const requestPromise = (async () => {
      try {
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.searchParams.set('latitude', String(latitude));
        url.searchParams.set('longitude', String(longitude));
        url.searchParams.set(
          'current',
          'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,is_day'
        );
        url.searchParams.set('hourly', 'temperature_2m,wind_speed_10m,weather_code');
        url.searchParams.set('timezone', 'Asia/Kolkata');

        const json = await fetchJsonWithTimeoutAndRetry<{
          current?: {
            time?: string;
            temperature_2m?: number;
            relative_humidity_2m?: number;
            wind_speed_10m?: number;
            weather_code?: number;
            is_day?: number;
          };
          hourly?: {
            time?: string[];
            temperature_2m?: Array<number | null>;
            wind_speed_10m?: Array<number | null>;
            weather_code?: Array<number | null>;
          };
        }>(url.toString(), 'Open-Meteo weather error', options);

        if (
          !json.current ||
          typeof json.current.temperature_2m !== 'number' ||
          typeof json.current.relative_humidity_2m !== 'number' ||
          typeof json.current.wind_speed_10m !== 'number' ||
          typeof json.current.weather_code !== 'number'
        ) {
          throw new UpstreamApiError('Incomplete live weather payload from Open-Meteo.');
        }

        const wTimes = json.hourly?.time ?? [];
        const wTemps = json.hourly?.temperature_2m ?? [];
        const wWinds = json.hourly?.wind_speed_10m ?? [];
        const wCodes = json.hourly?.weather_code ?? [];

        const hourly = wTimes.map((time, idx) => {
          const tempVal = wTemps[idx];
          const windVal = wWinds[idx];
          const codeVal = wCodes[idx];
          return {
            time,
            temperatureC: typeof tempVal === 'number' ? Math.round(tempVal) : null,
            windSpeedKmh: typeof windVal === 'number' ? Math.round(windVal) : null,
            weatherCode: typeof codeVal === 'number' ? codeVal : null,
          };
        });

        const parsed: WeatherData = {
          currentTime: json.current.time ?? new Date().toISOString(),
          temperatureC: Math.round(json.current.temperature_2m),
          humidityPct: Math.round(json.current.relative_humidity_2m),
          windSpeedKmh: Math.round(json.current.wind_speed_10m),
          weatherCode: json.current.weather_code,
          isDay: json.current.is_day === 1,
          hourly,
          fetchedAt: new Date().toISOString(),
        };

        const stamp = Date.now();
        weatherCache.set(key, {
          expiresAt: stamp + APP_CONFIG.cacheTtlMs,
          staleUntil: stamp + APP_CONFIG.staleWhileRevalidateMs,
          value: parsed,
        });

        return parsed;
      } finally {
        inFlightWeather.delete(key);
      }
    })();

    if (!options?.forceRefresh) {
      inFlightWeather.set(key, requestPromise);
    }
    return requestPromise;
  };

  if (!options?.forceRefresh && cached && cached.staleUntil > now) {
    void runFetch().catch(() => {
      // Stale-while-revalidate refresh failed silently.
    });
    return cached.value;
  }

  return runFetch();
}

/**
 * Persists the last known Open-Meteo air & weather snapshot locally for graceful offline fallback.
 */
export function saveLastKnownSnapshot(
  cityId: number,
  air: AirQualityData,
  weather: WeatherData
): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const payload: OfflineSnapshot = {
      air,
      weather,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(
      `${OFFLINE_SNAPSHOT_PREFIX}${cityId}`,
      JSON.stringify(payload)
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads the last known Open-Meteo air & weather snapshot from localStorage for offline resilience.
 */
export function loadLastKnownSnapshot(cityId: number): OfflineSnapshot | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(`${OFFLINE_SNAPSHOT_PREFIX}${cityId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OfflineSnapshot>;
    if (
      !parsed ||
      !parsed.air ||
      !parsed.weather ||
      typeof parsed.savedAt !== 'string' ||
      !Array.isArray(parsed.air.hourly) ||
      typeof parsed.air.currentPm25 !== 'number'
    ) {
      return null;
    }
    return parsed as OfflineSnapshot;
  } catch {
    return null;
  }
}

/**
 * Clears all Open-Meteo caches and in-flight tracking maps (useful in tests or hard refresh).
 */
export function clearOpenMeteoCache(): void {
  geoCache.clear();
  airCache.clear();
  weatherCache.clear();
  inFlightGeo.clear();
  inFlightAir.clear();
  inFlightWeather.clear();
}
