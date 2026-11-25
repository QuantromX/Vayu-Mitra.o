import { formatDayLabel, hasMaskSensitiveGroup } from '../shared/domain.ts';
import type {
  HouseholdGroup,
  Language,
  NaqiCategory,
  NaqiResult,
  ScrubbedHourState,
  VerdictPillLevel,
  WeatherData,
} from '../../types/index.ts';
import { computeNaqiFromPair } from './naqi.ts';

/**
 * Maps an India NAQI category and household sensitivity to a concise GO / CAUTION / STAY IN verdict.
 */
export function getVerdictPill(
  category: NaqiCategory,
  household: HouseholdGroup[] = []
): VerdictPillLevel {
  if (category === 'Good' || category === 'Satisfactory') {
    return 'GO';
  }
  if (category === 'Moderate') {
    return hasMaskSensitiveGroup(household) ? 'CAUTION' : 'GO';
  }
  return 'STAY IN';
}

/**
 * Returns the localized verdict pill text for English or Hindi UI rendering.
 */
export function getVerdictPillLabel(level: VerdictPillLevel, language: Language): string {
  if (language === 'en') return level;
  switch (level) {
    case 'GO':
      return 'बाहर जा सकते हैं';
    case 'CAUTION':
      return 'सावधानी रखें';
    case 'STAY IN':
      return 'घर में रहें';
  }
}

/**
 * Computes sun/moon horizontal and vertical arc coordinates across the sky for a given local hour (0..23).
 * Day (06:00-18:00): arcs smoothly from left to right. Night: moon arcs gently across upper sky.
 */
export function computeSunArcPosition(hourNumber: number): {
  isDay: boolean;
  sunXPercent: number;
  sunYPercent: number;
} {
  const hr = Math.max(0, Math.min(23, Number.isFinite(hourNumber) ? hourNumber : 12));
  const isDay = hr >= 6 && hr < 18;

  if (isDay) {
    const progress = (hr - 6) / 12; // 0..1
    const sunXPercent = Math.round(14 + progress * 72);
    const arcLift = Math.sin(progress * Math.PI); // 0 -> 1 -> 0
    const sunYPercent = Math.round(38 - arcLift * 26); // 38% horizon up to 12% noon
    return { isDay: true, sunXPercent, sunYPercent };
  }

  // Nighttime moon arc (18..23 and 0..5)
  const nightHour = hr >= 18 ? hr - 18 : hr + 6; // 0..11
  const progress = nightHour / 11;
  const sunXPercent = Math.round(18 + progress * 64);
  const arcLift = Math.sin(progress * Math.PI);
  const sunYPercent = Math.round(34 - arcLift * 20);
  return { isDay: false, sunXPercent, sunYPercent };
}

/**
 * Builds a concise, human-first 1-line summary tailored to the household and NAQI tier.
 */
export function buildVerdictHumanLine(params: {
  category: NaqiCategory;
  household: HouseholdGroup[];
  hourLabel: string;
  dayLabel: 'Today' | 'Tomorrow';
  isLive: boolean;
  language: Language;
}): string {
  const { category, household, hourLabel, dayLabel, isLive, language } = params;
  const hi = language === 'hi';
  const dayWord = formatDayLabel(dayLabel, language);
  const timeSuffix = isLive ? '' : ` (${dayWord} ${hourLabel})`;

  if (category === 'Good') {
    return hi
      ? `सामान्य और संवेदनशील सभी बाहर समय बिता सकते हैं${timeSuffix}`
      : `Great air for outdoor walks and play${timeSuffix}`;
  }

  if (category === 'Satisfactory') {
    return hi
      ? `बाहरी गतिविधियों के लिए अनुकूल समय; भारी ट्रैफ़िक से दूर रहें${timeSuffix}`
      : `Comfortable for outdoor routines away from busy roads${timeSuffix}`;
  }

  if (category === 'Moderate') {
    if (household.includes('kids')) {
      return hi
        ? `बच्चे हल्के खेल खेलें; लंबे दौड़-भाग से बचें${timeSuffix}`
        : `Kids: keep outdoor play brief and lighter${timeSuffix}`;
    }
    if (household.includes('asthma_heart') || household.includes('seniors')) {
      return hi
        ? `वरिष्ठ व अस्थमा रोगी बाहरी समय सीमित रखें${timeSuffix}`
        : `Seniors & asthma care: pace outdoor effort${timeSuffix}`;
    }
    return hi
      ? `बाहरी काम कम भीड़भाड़ वाले समय में करें${timeSuffix}`
      : `Prefer lighter outdoor exertion and less-busy streets${timeSuffix}`;
  }

  // Poor / Very Poor / Severe
  if (household.includes('kids')) {
    return hi
      ? `बच्चे आज घर के अंदर ही खेलें${timeSuffix}`
      : `Kids: play indoors${isLive ? ' today' : timeSuffix}`;
  }
  if (household.includes('asthma_heart')) {
    return hi
      ? `अस्थमा/हृदय रोगी घर के अंदर रहें व रिलीवर पास रखें${timeSuffix}`
      : `Asthma care: stay indoors and keep inhaler handy${timeSuffix}`;
  }
  if (household.includes('seniors')) {
    return hi
      ? `वरिष्ठ नागरिक सैर घर के अंदर रखें${timeSuffix}`
      : `Seniors: stay indoors and skip roadside walks${timeSuffix}`;
  }
  if (household.includes('outdoor_worker')) {
    return hi
      ? `बाहरी काम में हर समय सील वाला N95/FFP2 पहनें${timeSuffix}`
      : `Outdoor work: wear a snug N95/FFP2 continuously${timeSuffix}`;
  }
  return hi
    ? `ग़ैर-ज़रूरी बाहरी काम टालें और N95 पहनें${timeSuffix}`
    : `Skip non-essential outdoor effort; wear N95 outdoors${timeSuffix}`;
}

/**
 * Pure hour-to-state mapper powering the 24h Time Scrubber and Hero synchronization.
 * Index 0 represents the live current reading; indices 1..N map to forwardHourly[index].
 */
export function computeScrubbedHourState(params: {
  naqi: NaqiResult;
  weather: WeatherData;
  activeIndex: number;
  household: HouseholdGroup[];
  language: Language;
}): ScrubbedHourState {
  const { naqi, weather, activeIndex, household, language } = params;
  const clampedIdx =
    naqi.forwardHourly.length > 0
      ? Math.max(0, Math.min(activeIndex, naqi.forwardHourly.length - 1))
      : 0;
  const isLive = clampedIdx === 0;
  const point = naqi.forwardHourly[clampedIdx];

  if (!point || isLive) {
    const currentHr = Number(
      (point?.hourLabel ?? weather.currentTime.slice(11, 13)).slice(0, 2)
    );
    const arc = computeSunArcPosition(currentHr);
    const verdictPill = getVerdictPill(naqi.category, household);
    return {
      index: 0,
      isLive: true,
      time: point?.time ?? weather.currentTime,
      hourLabel: point?.hourLabel ?? weather.currentTime.slice(11, 16),
      dayLabel: point?.dayLabel ?? 'Today',
      aqi: naqi.aqi,
      category: naqi.category,
      dominantPollutant: naqi.dominantPollutant,
      pm25: naqi.pm25Used,
      pm10: naqi.pm10Used,
      temperatureC: weather.temperatureC,
      humidityPct: weather.humidityPct,
      windSpeedKmh: weather.windSpeedKmh,
      weatherCode: weather.weatherCode,
      isDay: weather.isDay,
      sunXPercent: arc.sunXPercent,
      sunYPercent: arc.sunYPercent,
      verdictPill,
      verdictLabel: getVerdictPillLabel(verdictPill, language),
      verdictLine: buildVerdictHumanLine({
        category: naqi.category,
        household,
        hourLabel: point?.hourLabel ?? weather.currentTime.slice(11, 16),
        dayLabel: point?.dayLabel ?? 'Today',
        isLive: true,
        language,
      }),
    };
  }

  const pm25 = Number((point.pm2_5 ?? naqi.pm25Used).toFixed(1));
  const pm10 = Number((point.pm10 ?? naqi.pm10Used).toFixed(1));
  const pair = computeNaqiFromPair(pm25, pm10);
  const matchedWeather = weather.hourly?.find((w) => w.time === point.time);

  const hr = Number(point.hourLabel.slice(0, 2));
  const arc = computeSunArcPosition(hr);
  const verdictPill = getVerdictPill(pair.category, household);

  return {
    index: clampedIdx,
    isLive: false,
    time: point.time,
    hourLabel: point.hourLabel,
    dayLabel: point.dayLabel,
    aqi: pair.aqi,
    category: pair.category,
    dominantPollutant: pair.dominantPollutant,
    pm25,
    pm10,
    temperatureC: matchedWeather?.temperatureC ?? weather.temperatureC,
    humidityPct: weather.humidityPct,
    windSpeedKmh: matchedWeather?.windSpeedKmh ?? weather.windSpeedKmh,
    weatherCode: matchedWeather?.weatherCode ?? weather.weatherCode,
    isDay: arc.isDay,
    sunXPercent: arc.sunXPercent,
    sunYPercent: arc.sunYPercent,
    verdictPill,
    verdictLabel: getVerdictPillLabel(verdictPill, language),
    verdictLine: buildVerdictHumanLine({
      category: pair.category,
      household,
      hourLabel: point.hourLabel,
      dayLabel: point.dayLabel,
      isLive: false,
      language,
    }),
  };
}
