import { describe, expect, it } from 'vitest';
import {
  categorizeNaqi,
  computeForwardCleanestAndWorstWindows,
  computeNaqiFromPair,
  computePm10SubIndex,
  computePm25SubIndex,
  evaluateAirQuality,
  evaluateMaskRule,
} from '../naqi/naqi.ts';
import type { AirQualityData, HourlyPollutantPoint } from '../../types/index.ts';

function buildMultiDayHourlySeries(): HourlyPollutantPoint[] {
  const points: HourlyPollutantPoint[] = [];
  // Day 1 (Today): 00:00..23:00
  for (let h = 0; h < 24; h++) {
    // Past hours 03:00-05:00 artificially very clean (should be ignored when currentTime is 16:00)
    // Future Today hours 18:00-20:00 are worst
    let pm25 = 85;
    let pm10 = 130;
    if (h >= 3 && h <= 5) {
      pm25 = 12;
      pm10 = 20;
    } else if (h >= 18 && h <= 20) {
      pm25 = 180;
      pm10 = 260;
    }
    points.push({
      time: `2026-11-22T${String(h).padStart(2, '0')}:00`,
      hourLabel: `${String(h).padStart(2, '0')}:00`,
      dayLabel: 'Today',
      isCurrentHour: false,
      pm2_5: pm25,
      pm10,
      naqi: null,
      category: null,
    });
  }
  // Day 2 (Tomorrow): 00:00..23:00
  for (let h = 0; h < 24; h++) {
    // Tomorrow 11:00-13:00 is the cleanest forward window
    const isTomorrowClean = h >= 11 && h <= 13;
    points.push({
      time: `2026-11-23T${String(h).padStart(2, '0')}:00`,
      hourLabel: `${String(h).padStart(2, '0')}:00`,
      dayLabel: 'Tomorrow',
      isCurrentHour: false,
      pm2_5: isTomorrowClean ? 24 : 95,
      pm10: isTomorrowClean ? 35 : 150,
      naqi: null,
      category: null,
    });
  }
  return points;
}

describe('India NAQI Engine', () => {
  it('computes exact PM2.5 sub-index boundary values', () => {
    expect(computePm25SubIndex(0)).toBe(0);
    expect(computePm25SubIndex(30)).toBe(50);
    expect(computePm25SubIndex(31)).toBe(51);
    expect(computePm25SubIndex(60)).toBe(100);
    expect(computePm25SubIndex(61)).toBe(101);
    expect(computePm25SubIndex(90)).toBe(200);
    expect(computePm25SubIndex(91)).toBe(201);
    expect(computePm25SubIndex(120)).toBe(300);
    expect(computePm25SubIndex(121)).toBe(301);
    expect(computePm25SubIndex(250)).toBe(400);
    expect(computePm25SubIndex(251)).toBe(401);
    expect(computePm25SubIndex(380)).toBe(500);
    expect(computePm25SubIndex(520)).toBe(500);
  });

  it('computes exact PM10 sub-index boundary values', () => {
    expect(computePm10SubIndex(0)).toBe(0);
    expect(computePm10SubIndex(50)).toBe(50);
    expect(computePm10SubIndex(51)).toBe(51);
    expect(computePm10SubIndex(100)).toBe(100);
    expect(computePm10SubIndex(101)).toBe(101);
    expect(computePm10SubIndex(250)).toBe(200);
    expect(computePm10SubIndex(251)).toBe(201);
    expect(computePm10SubIndex(350)).toBe(300);
    expect(computePm10SubIndex(351)).toBe(301);
    expect(computePm10SubIndex(430)).toBe(400);
    expect(computePm10SubIndex(431)).toBe(401);
    expect(computePm10SubIndex(510)).toBe(500);
    expect(computePm10SubIndex(750)).toBe(500);
  });

  it('handles negative, NaN, and fractional values between brackets smoothly', () => {
    expect(computePm25SubIndex(-10)).toBe(0);
    expect(computePm25SubIndex(Number.NaN)).toBe(0);
    const mid = computePm25SubIndex(30.5);
    expect(mid).toBeGreaterThanOrEqual(50);
    expect(mid).toBeLessThanOrEqual(51);
  });

  it('takes the maximum of PM2.5 and PM10 sub-indices and identifies dominant pollutant', () => {
    const pm25Dominant = computeNaqiFromPair(91, 80);
    expect(pm25Dominant.aqi).toBe(201);
    expect(pm25Dominant.category).toBe('Poor');
    expect(pm25Dominant.dominantPollutant).toBe('PM2.5');

    const pm10Dominant = computeNaqiFromPair(25, 251);
    expect(pm10Dominant.aqi).toBe(201);
    expect(pm10Dominant.category).toBe('Poor');
    expect(pm10Dominant.dominantPollutant).toBe('PM10');
  });

  it('categorizes all 6 India NAQI tiers accurately', () => {
    expect(categorizeNaqi(0)).toBe('Good');
    expect(categorizeNaqi(50)).toBe('Good');
    expect(categorizeNaqi(51)).toBe('Satisfactory');
    expect(categorizeNaqi(100)).toBe('Satisfactory');
    expect(categorizeNaqi(101)).toBe('Moderate');
    expect(categorizeNaqi(200)).toBe('Moderate');
    expect(categorizeNaqi(201)).toBe('Poor');
    expect(categorizeNaqi(300)).toBe('Poor');
    expect(categorizeNaqi(301)).toBe('Very Poor');
    expect(categorizeNaqi(400)).toBe('Very Poor');
    expect(categorizeNaqi(401)).toBe('Severe');
    expect(categorizeNaqi(500)).toBe('Severe');
  });

  it('computes forward-looking windows strictly from current hour onward and labels Today vs Tomorrow', () => {
    const hourly = buildMultiDayHourlySeries();
    const data: AirQualityData = {
      latitude: 28.6,
      longitude: 77.2,
      currentTime: '2026-11-22T16:00',
      currentPm25: 110,
      currentPm10: 170,
      hourly,
      fetchedAt: '2026-11-22T10:30:00.000Z',
    };

    const result = evaluateAirQuality(data);
    expect(result.basis).toBe('rolling_24h');
    expect(result.label).toBe('NAQI-style estimate');

    // Forward series starts strictly at 16:00 Today and covers 24h up to 15:00 Tomorrow
    expect(result.forwardHourly).toHaveLength(24);
    expect(result.forwardHourly[0]?.hourLabel).toBe('16:00');
    expect(result.forwardHourly[0]?.dayLabel).toBe('Today');
    expect(result.forwardHourly[0]?.isCurrentHour).toBe(true);
    expect(result.forwardHourly.slice(1).every((pt) => !pt.isCurrentHour)).toBe(true);

    // Must ignore past 03:00-05:00 clean hours and pick Tomorrow 11:00-14:00
    expect(result.cleanestWindow?.dayLabel).toBe('Tomorrow');
    expect(result.cleanestWindow?.startHour).toBe('11:00');
    expect(result.cleanestWindow?.endHour).toBe('14:00');

    // Peak window is Today 18:00-21:00
    expect(result.worstWindow?.dayLabel).toBe('Today');
    expect(result.worstWindow?.startHour).toBe('18:00');
    expect(result.worstWindow?.endHour).toBe('21:00');
  });

  it('falls back to current readings when fewer than 12 historical hours exist and handles empty forward windows', () => {
    const sparse = buildMultiDayHourlySeries().slice(0, 4);
    const sparseResult = evaluateAirQuality({
      latitude: 28.6,
      longitude: 77.2,
      currentTime: '2026-11-22T02:00',
      currentPm25: 150,
      currentPm10: 200,
      hourly: sparse,
      fetchedAt: '2026-11-22T02:00:00.000Z',
    });
    expect(sparseResult.basis).toBe('current');
    expect(sparseResult.pm25Used).toBe(150);

    const emptyWindows = computeForwardCleanestAndWorstWindows([], 3);
    expect(emptyWindows.cleanestWindow).toBeNull();
    expect(emptyWindows.worstWindow).toBeNull();
  });

  it('enforces exact mask rule across NAQI categories and household sensitivity', () => {
    // Good & Satisfactory: always optional
    expect(evaluateMaskRule('Good', ['asthma_heart']).recommended).toBe(false);
    expect(evaluateMaskRule('Good', ['asthma_heart']).scope).toBe('optional');
    expect(evaluateMaskRule('Satisfactory', ['kids', 'seniors']).recommended).toBe(false);

    // Moderate: recommended ONLY when sensitive groups are present
    expect(evaluateMaskRule('Moderate', []).recommended).toBe(false);
    expect(evaluateMaskRule('Moderate', ['pregnant']).recommended).toBe(false);
    expect(evaluateMaskRule('Moderate', ['kids']).recommended).toBe(true);
    expect(evaluateMaskRule('Moderate', ['seniors']).recommended).toBe(true);
    expect(evaluateMaskRule('Moderate', ['asthma_heart']).recommended).toBe(true);
    expect(evaluateMaskRule('Moderate', ['outdoor_worker']).recommended).toBe(true);
    expect(evaluateMaskRule('Moderate', ['kids']).type).toBe('N95 / FFP2');

    // Poor, Very Poor, Severe: N95 / FFP2 recommended for everyone outdoors
    for (const cat of ['Poor', 'Very Poor', 'Severe'] as const) {
      const rule = evaluateMaskRule(cat, []);
      expect(rule.recommended).toBe(true);
      expect(rule.scope).toBe('everyone');
      expect(rule.type).toBe('N95 / FFP2');
    }
  });

  it('handles midnight rollover across Today 23:00 -> Tomorrow 01:00 and sparse null hours safely', () => {
    const hourly = buildMultiDayHourlySeries().map((pt, idx) =>
      idx >= 23 && idx <= 25 ? { ...pt, pm2_5: 15, pm10: 25 } : pt
    );
    // Simulate a sensor gap (null values) inside a middle hour
    const gapPoint = hourly[28];
    if (gapPoint) {
      gapPoint.pm2_5 = null;
      gapPoint.pm10 = null;
    }

    const midnightResult = evaluateAirQuality({
      latitude: 28.6,
      longitude: 77.2,
      currentTime: '2026-11-22T23:00',
      currentPm25: 35,
      currentPm10: 55,
      hourly,
      fetchedAt: '2026-11-22T17:30:00.000Z',
    });

    expect(midnightResult.forwardHourly).toHaveLength(24);
    expect(midnightResult.forwardHourly[0]?.dayLabel).toBe('Today');
    expect(midnightResult.forwardHourly[0]?.hourLabel).toBe('23:00');
    expect(midnightResult.forwardHourly[1]?.dayLabel).toBe('Tomorrow');
    expect(midnightResult.forwardHourly[1]?.hourLabel).toBe('00:00');

    // Window spanning Today 23:00 -> Tomorrow 02:00 labels endDayLabel as Tomorrow
    expect(midnightResult.cleanestWindow?.dayLabel).toBe('Today');
    expect(midnightResult.cleanestWindow?.endDayLabel).toBe('Tomorrow');
  });

  it('clamps non-finite and extreme pollutant inputs safely without throwing', () => {
    expect(computePm25SubIndex(Number.POSITIVE_INFINITY)).toBe(0);
    expect(computePm10SubIndex(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(computePm10SubIndex(1200)).toBe(500);
    expect(computeNaqiFromPair(Number.NaN, 50).aqi).toBe(50);
  });
});
