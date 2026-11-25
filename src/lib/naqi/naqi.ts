import { hasMaskSensitiveGroup } from '../shared/domain.ts';
import type {
  AirQualityData,
  HourWindow,
  HourlyPollutantPoint,
  HouseholdGroup,
  NaqiCategory,
  NaqiResult,
  WindowDayLabel,
} from '../../types/index.ts';

interface Breakpoint {
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
  category: NaqiCategory;
}

/**
 * Official India National Air Quality Index (NAQI) breakpoints for PM2.5 (µg/m³).
 */
export const PM25_BREAKPOINTS: readonly Breakpoint[] = [
  { cLow: 0, cHigh: 30, iLow: 0, iHigh: 50, category: 'Good' },
  { cLow: 31, cHigh: 60, iLow: 51, iHigh: 100, category: 'Satisfactory' },
  { cLow: 61, cHigh: 90, iLow: 101, iHigh: 200, category: 'Moderate' },
  { cLow: 91, cHigh: 120, iLow: 201, iHigh: 300, category: 'Poor' },
  { cLow: 121, cHigh: 250, iLow: 301, iHigh: 400, category: 'Very Poor' },
  { cLow: 251, cHigh: 380, iLow: 401, iHigh: 500, category: 'Severe' },
];

/**
 * Official India National Air Quality Index (NAQI) breakpoints for PM10 (µg/m³).
 */
export const PM10_BREAKPOINTS: readonly Breakpoint[] = [
  { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50, category: 'Good' },
  { cLow: 51, cHigh: 100, iLow: 51, iHigh: 100, category: 'Satisfactory' },
  { cLow: 101, cHigh: 250, iLow: 101, iHigh: 200, category: 'Moderate' },
  { cLow: 251, cHigh: 350, iLow: 201, iHigh: 300, category: 'Poor' },
  { cLow: 351, cHigh: 430, iLow: 301, iHigh: 400, category: 'Very Poor' },
  { cLow: 431, cHigh: 510, iLow: 401, iHigh: 500, category: 'Severe' },
];

/**
 * India NAQI category range definitions for reference tooltips and UI legends.
 */
export const NAQI_CATEGORY_RANGES: ReadonlyArray<{
  category: NaqiCategory;
  categoryHi: string;
  range: string;
}> = [
  { category: 'Good', categoryHi: 'अच्छी', range: '0–50' },
  { category: 'Satisfactory', categoryHi: 'संतोषजनक', range: '51–100' },
  { category: 'Moderate', categoryHi: 'मध्यम', range: '101–200' },
  { category: 'Poor', categoryHi: 'खराब', range: '201–300' },
  { category: 'Very Poor', categoryHi: 'बहुत खराब', range: '301–400' },
  { category: 'Severe', categoryHi: 'गंभीर', range: '401–500' },
];

/**
 * Maps an integer NAQI value (0-500) to its official India NAQI category.
 */
export function categorizeNaqi(aqi: number): NaqiCategory {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
}

/**
 * Computes a pollutant sub-index via linear interpolation over India NAQI breakpoints.
 */
export function computeSubIndex(
  concentration: number,
  breakpoints: readonly Breakpoint[]
): number {
  if (!Number.isFinite(concentration) || concentration <= 0) {
    return 0;
  }

  const last = breakpoints[breakpoints.length - 1];
  if (!last) {
    return 0;
  }
  if (concentration >= last.cHigh) {
    return 500;
  }

  for (let idx = 0; idx < breakpoints.length; idx++) {
    const bp = breakpoints[idx];
    if (!bp) continue;
    if (concentration <= bp.cHigh) {
      if (concentration < bp.cLow && idx > 0) {
        const prev = breakpoints[idx - 1];
        if (!prev) return bp.iLow;
        const ratio = (concentration - prev.cHigh) / (bp.cLow - prev.cHigh);
        return Math.round(prev.iHigh + ratio * (bp.iLow - prev.iHigh));
      }
      const span = bp.cHigh - bp.cLow;
      if (span === 0) return bp.iHigh;
      const ratio = (concentration - bp.cLow) / span;
      return Math.round(bp.iLow + ratio * (bp.iHigh - bp.iLow));
    }
  }

  return 500;
}

/**
 * Computes the PM2.5 sub-index using India NAQI breakpoints.
 */
export function computePm25SubIndex(pm25: number): number {
  return computeSubIndex(pm25, PM25_BREAKPOINTS);
}

/**
 * Computes the PM10 sub-index using India NAQI breakpoints.
 */
export function computePm10SubIndex(pm10: number): number {
  return computeSubIndex(pm10, PM10_BREAKPOINTS);
}

/**
 * Computes the overall NAQI value and dominant pollutant from PM2.5 and PM10 concentrations.
 */
export function computeNaqiFromPair(
  pm25: number,
  pm10: number
): {
  aqi: number;
  category: NaqiCategory;
  dominantPollutant: 'PM2.5' | 'PM10';
  pm25SubIndex: number;
  pm10SubIndex: number;
} {
  const pm25SubIndex = computePm25SubIndex(pm25);
  const pm10SubIndex = computePm10SubIndex(pm10);
  const aqi = Math.max(pm25SubIndex, pm10SubIndex);
  const dominantPollutant = pm25SubIndex >= pm10SubIndex ? 'PM2.5' : 'PM10';
  return {
    aqi,
    category: categorizeNaqi(aqi),
    dominantPollutant,
    pm25SubIndex,
    pm10SubIndex,
  };
}

/**
 * Deterministic mask recommendation rule grounded in India NAQI category and household sensitivity:
 * - Good / Satisfactory: optional
 * - Moderate: recommended for kids, seniors, asthma/heart patients, and outdoor workers
 * - Poor / Very Poor / Severe: N95 / FFP2 recommended for everyone outdoors
 */
export function evaluateMaskRule(
  category: NaqiCategory,
  household: HouseholdGroup[]
): {
  recommended: boolean;
  scope: 'optional' | 'sensitive_only' | 'everyone';
  type: string;
} {
  if (category === 'Good' || category === 'Satisfactory') {
    return {
      recommended: false,
      scope: 'optional',
      type: 'Optional',
    };
  }

  if (category === 'Moderate') {
    return {
      recommended: hasMaskSensitiveGroup(household),
      scope: 'sensitive_only',
      type: 'N95 / FFP2',
    };
  }

  return {
    recommended: true,
    scope: 'everyone',
    type: 'N95 / FFP2',
  };
}

function addOneHourLabel(hourLabel: string): { hour: string; wrappedDay: boolean } {
  const hr = Number(hourLabel.slice(0, 2));
  if (!Number.isFinite(hr)) return { hour: hourLabel, wrappedDay: false };
  const next = (hr + 1) % 24;
  return {
    hour: `${String(next).padStart(2, '0')}:00`,
    wrappedDay: hr === 23,
  };
}

/**
 * Finds the cleanest and worst contiguous 3-hour windows strictly from a forward-looking
 * hourly slice (current hour onward up to +24h), labeling each window Today or Tomorrow.
 */
export function computeForwardCleanestAndWorstWindows(
  forwardHourly: HourlyPollutantPoint[],
  windowSize = 3
): { cleanestWindow: HourWindow | null; worstWindow: HourWindow | null } {
  const effectiveSize = Math.min(windowSize, forwardHourly.length);
  if (effectiveSize < 1) {
    return { cleanestWindow: null, worstWindow: null };
  }

  let cleanestWindow: HourWindow | null = null;
  let worstWindow: HourWindow | null = null;

  for (let i = 0; i <= forwardHourly.length - effectiveSize; i++) {
    const slice = forwardHourly.slice(i, i + effectiveSize);
    if (slice.some((pt) => pt.naqi === null || pt.pm2_5 === null)) {
      continue;
    }

    const first = slice[0];
    const last = slice[slice.length - 1];
    if (!first || !last) continue;

    const avgNaqi = Math.round(
      slice.reduce((acc, pt) => acc + (pt.naqi ?? 0), 0) / effectiveSize
    );
    const avgPm25 = Math.round(
      slice.reduce((acc, pt) => acc + (pt.pm2_5 ?? 0), 0) / effectiveSize
    );

    const endBoundary = addOneHourLabel(last.hourLabel);
    const endDayLabel: WindowDayLabel =
      endBoundary.wrappedDay && last.dayLabel === 'Today' ? 'Tomorrow' : last.dayLabel;

    const candidate: HourWindow = {
      startHour: first.hourLabel,
      endHour: endBoundary.hour,
      dayLabel: first.dayLabel,
      endDayLabel,
      startIndex: i,
      endIndex: i + effectiveSize - 1,
      avgNaqi,
      avgPm25,
    };

    if (!cleanestWindow || candidate.avgNaqi < cleanestWindow.avgNaqi) {
      cleanestWindow = candidate;
    }
    if (!worstWindow || candidate.avgNaqi > worstWindow.avgNaqi) {
      worstWindow = candidate;
    }
  }

  return { cleanestWindow, worstWindow };
}

/**
 * Evaluates live air-quality data into a rolling 24h (or current fallback) NAQI estimate
 * and extracts strictly forward-looking hourly series (current hour + next 23h) and windows.
 */
export function evaluateAirQuality(data: AirQualityData): NaqiResult {
  const currentDate = data.currentTime.slice(0, 10);
  const currentHourPrefix = data.currentTime.slice(0, 13);

  // Locate current hour index
  let currentIdx = data.hourly.findIndex((pt) => pt.time.startsWith(currentHourPrefix));
  if (currentIdx === -1) {
    currentIdx = data.hourly.reduce(
      (lastIdx, pt, idx) => (pt.time <= data.currentTime ? idx : lastIdx),
      0
    );
  }
  if (currentIdx < 0) currentIdx = 0;

  // Enrich hourly points with NAQI and Today/Tomorrow labels
  const enrichedHourly: HourlyPollutantPoint[] = data.hourly.map((pt, idx) => {
    const ptDate = pt.time.slice(0, 10);
    const dayLabel: WindowDayLabel = ptDate <= currentDate ? 'Today' : 'Tomorrow';
    const isCurrentHour = idx === currentIdx;
    if (pt.pm2_5 === null && pt.pm10 === null) {
      return { ...pt, dayLabel, isCurrentHour, naqi: null, category: null };
    }
    const pair = computeNaqiFromPair(pt.pm2_5 ?? 0, pt.pm10 ?? 0);
    return {
      ...pt,
      dayLabel,
      isCurrentHour,
      naqi: pair.aqi,
      category: pair.category,
    };
  });

  // Compute rolling 24h average up to currentIdx
  let pm25Used = data.currentPm25;
  let pm10Used = data.currentPm10;
  let basis: 'rolling_24h' | 'current' = 'current';

  if (enrichedHourly.length > 0) {
    const startIdx = Math.max(0, currentIdx - 23);
    const windowSlice = enrichedHourly.slice(startIdx, currentIdx + 1);
    const validPm25 = windowSlice
      .map((p) => p.pm2_5)
      .filter((v): v is number => v !== null && Number.isFinite(v));
    const validPm10 = windowSlice
      .map((p) => p.pm10)
      .filter((v): v is number => v !== null && Number.isFinite(v));

    if (validPm25.length >= 12 && validPm10.length >= 12) {
      pm25Used = Number(
        (validPm25.reduce((a, b) => a + b, 0) / validPm25.length).toFixed(1)
      );
      pm10Used = Number(
        (validPm10.reduce((a, b) => a + b, 0) / validPm10.length).toFixed(1)
      );
      basis = 'rolling_24h';
    }
  }

  const naqi = computeNaqiFromPair(pm25Used, pm10Used);

  // Strictly forward-looking 24-hour slice: current hour onward up to +24h
  const forwardHourly = enrichedHourly.slice(currentIdx, currentIdx + 24);

  const { cleanestWindow, worstWindow } = computeForwardCleanestAndWorstWindows(
    forwardHourly,
    3
  );

  return {
    ...naqi,
    pm25Used,
    pm10Used,
    basis,
    label: 'NAQI-style estimate',
    cleanestWindow,
    worstWindow,
    forwardHourly,
  };
}
