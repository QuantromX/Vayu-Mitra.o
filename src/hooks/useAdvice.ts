import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildFallbackAdvice } from '../lib/advice/schema';
import type { AdviceResponse, NaqiResult, UserProfile, WeatherData } from '../types';

const TEN_MINUTES_MS = 10 * 60 * 1000;
const SESSION_CACHE_PREFIX = 'vayumitra.advice.v1:';

interface AdviceCacheEntry {
  expiresAt: number;
  value: AdviceResponse;
}

const adviceCache = new Map<string, AdviceCacheEntry>();

function readCachedAdvice(key: string): AdviceResponse | null {
  const mem = adviceCache.get(key);
  if (mem && mem.expiresAt > Date.now()) {
    return mem.value;
  }
  try {
    const raw = window.sessionStorage.getItem(SESSION_CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdviceCacheEntry;
    if (parsed && parsed.expiresAt > Date.now() && parsed.value) {
      adviceCache.set(key, parsed);
      return parsed.value;
    }
    window.sessionStorage.removeItem(SESSION_CACHE_PREFIX + key);
  } catch {
    // Ignore storage access failures in private browsing or restricted iframes
  }
  return null;
}

function writeCachedAdvice(key: string, value: AdviceResponse): void {
  const entry: AdviceCacheEntry = {
    expiresAt: Date.now() + TEN_MINUTES_MS,
    value,
  };
  adviceCache.set(key, entry);
  try {
    window.sessionStorage.setItem(SESSION_CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Ignore quota or storage restrictions
  }
}

function deleteCachedAdvice(key: string): void {
  adviceCache.delete(key);
  try {
    window.sessionStorage.removeItem(SESSION_CACHE_PREFIX + key);
  } catch {
    // Ignore storage restrictions
  }
}

/**
 * Fetches personalized structured Gemini advice from /api/advice, waiting for live
 * air/weather fetches to settle, debouncing rapid profile edits, and caching results
 * for 10 minutes to preserve API quota.
 */
export function useAdvice(params: {
  profile: UserProfile;
  naqi: NaqiResult | null;
  weather: WeatherData | null;
  airLoading?: boolean;
  isEditingProfile?: boolean;
}) {
  const { profile, naqi, weather, airLoading = false, isEditingProfile = false } = params;

  const [adviceState, setAdviceState] = useState<{
    cityId: number;
    data: AdviceResponse | null;
  }>({ cityId: profile.city.id, data: null });
  const advice = adviceState.cityId === profile.city.id ? adviceState.data : null;

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [revealStage, setRevealStage] = useState<number>(0);
  const [retryCount, setRetryCount] = useState<number>(0);
  const lastFetchedCityIdRef = useRef<number | null>(null);

  const cacheKey = useMemo(() => {
    if (!naqi || !weather || airLoading) return null;
    return JSON.stringify({
      city: profile.city.name,
      lat: profile.city.latitude.toFixed(2),
      aqi: naqi.aqi,
      pm25: naqi.pm25Used,
      cat: naqi.category,
      cleanStart: naqi.cleanestWindow?.startHour ?? '',
      hh: [...profile.household].sort(),
      life: profile.lifestyle,
      purifier: profile.hasPurifier,
      lang: profile.language,
    });
  }, [profile, naqi, weather, airLoading]);

  // Keep latest payload values accessible inside debounced timer without re-triggering
  const latestDataRef = useRef({ profile, naqi, weather });
  useEffect(() => {
    latestDataRef.current = { profile, naqi, weather };
  }, [profile, naqi, weather]);

  const retryAdvice = useCallback(() => {
    if (cacheKey) {
      deleteCachedAdvice(cacheKey);
    }
    setRetryCount((c) => c + 1);
  }, [cacheKey]);

  useEffect(() => {
    if (!cacheKey || airLoading) return;

    const cached = readCachedAdvice(cacheKey);
    const controller = new AbortController();
    let active = true;

    if (cached) {
      const cacheTimer = window.setTimeout(() => {
        if (!active) return;
        lastFetchedCityIdRef.current = latestDataRef.current.profile.city.id;
        setAdviceState({
          cityId: latestDataRef.current.profile.city.id,
          data: cached,
        });
        setLoading(false);
        setError(null);
        setRevealStage(4);
      }, 0);
      return () => {
        active = false;
        window.clearTimeout(cacheTimer);
      };
    }

    // Immediate fetch on initial load or city change; debounce rapid chip clicks
    const isCitySwitch = lastFetchedCityIdRef.current !== profile.city.id;
    const debounceMs = isCitySwitch ? 0 : isEditingProfile ? 850 : 350;

    const timer = window.setTimeout(async () => {
      const snap = latestDataRef.current;
      if (!snap.naqi || !snap.weather || !active) return;

      setLoading(true);
      setError(null);
      setRevealStage(0);

      const payload = {
        cityName: snap.profile.city.name,
        latitude: snap.profile.city.latitude,
        longitude: snap.profile.city.longitude,
        aqi: snap.naqi.aqi,
        category: snap.naqi.category,
        dominantPollutant: snap.naqi.dominantPollutant,
        pm25: snap.naqi.pm25Used,
        pm10: snap.naqi.pm10Used,
        basis: snap.naqi.basis,
        temperatureC: snap.weather.temperatureC,
        humidityPct: snap.weather.humidityPct,
        windSpeedKmh: snap.weather.windSpeedKmh,
        cleanestWindow: snap.naqi.cleanestWindow
          ? {
              startHour: snap.naqi.cleanestWindow.startHour,
              endHour: snap.naqi.cleanestWindow.endHour,
              dayLabel: snap.naqi.cleanestWindow.dayLabel,
              endDayLabel: snap.naqi.cleanestWindow.endDayLabel,
              avgNaqi: snap.naqi.cleanestWindow.avgNaqi,
              avgPm25: snap.naqi.cleanestWindow.avgPm25,
            }
          : null,
        worstWindow: snap.naqi.worstWindow
          ? {
              startHour: snap.naqi.worstWindow.startHour,
              endHour: snap.naqi.worstWindow.endHour,
              dayLabel: snap.naqi.worstWindow.dayLabel,
              endDayLabel: snap.naqi.worstWindow.endDayLabel,
              avgNaqi: snap.naqi.worstWindow.avgNaqi,
              avgPm25: snap.naqi.worstWindow.avgPm25,
            }
          : null,
        household: snap.profile.household,
        lifestyle: snap.profile.lifestyle,
        hasPurifier: snap.profile.hasPurifier,
        language: snap.profile.language,
      };

      try {
        let lastErr: unknown;
        let data: AdviceResponse | null = null;

        for (let attempt = 0; attempt < 2; attempt++) {
          if (controller.signal.aborted) {
            throw new DOMException('Aborted', 'AbortError');
          }
          const reqController = new AbortController();
          const onOuterAbort = () => reqController.abort();
          controller.signal.addEventListener('abort', onOuterAbort, { once: true });
          const reqTimeout = window.setTimeout(() => reqController.abort(), 18_000);

          try {
            const res = await fetch('/api/advice', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: reqController.signal,
            });

            if (!res.ok) {
              const err = new Error(`Advice service error (HTTP ${res.status})`);
              if (res.status < 500 || attempt === 1) throw err;
              lastErr = err;
            } else {
              data = (await res.json()) as AdviceResponse;
              break;
            }
          } catch (err) {
            if (controller.signal.aborted) throw err;
            if (attempt === 1) throw err;
            lastErr = err;
          } finally {
            window.clearTimeout(reqTimeout);
            controller.signal.removeEventListener('abort', onOuterAbort);
          }

          await new Promise((r) => window.setTimeout(r, 350));
        }

        if (!data) {
          throw lastErr instanceof Error ? lastErr : new Error('Advice request failed');
        }

        if (!active) return;

        lastFetchedCityIdRef.current = snap.profile.city.id;
        writeCachedAdvice(cacheKey, data);
        setAdviceState({ cityId: snap.profile.city.id, data });
      } catch (err) {
        if (!active) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;

        const fallback = buildFallbackAdvice({
          ...payload,
        });
        lastFetchedCityIdRef.current = snap.profile.city.id;
        setAdviceState({ cityId: snap.profile.city.id, data: fallback });
        setError(
          err instanceof Error
            ? err.message
            : 'Could not reach guidance service; showing local rule-based guidance.'
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [cacheKey, airLoading, isEditingProfile, profile.city.id, retryCount]);

  // Progressive reveal once advice arrives
  useEffect(() => {
    if (!advice || loading) return;
    if (revealStage >= 4) return;
    const timer = window.setTimeout(() => {
      setRevealStage((s) => Math.min(4, s + 1));
    }, 90);
    return () => window.clearTimeout(timer);
  }, [advice, loading, revealStage]);

  return {
    advice,
    loading,
    error,
    revealStage,
    retryAdvice,
  };
}
