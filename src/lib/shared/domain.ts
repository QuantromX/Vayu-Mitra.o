import { APP_CONFIG, INDIA_BOUNDS } from '../config.ts';
import type {
  HourWindow,
  HouseholdGroup,
  Language,
  NaqiCategory,
  WindowDayLabel,
} from '../../types/index.ts';

/**
 * Shared Hindi translations for the 6 official India NAQI categories.
 */
export const CATEGORY_HINDI: Record<NaqiCategory, string> = {
  Good: 'अच्छी',
  Satisfactory: 'संतोषजनक',
  Moderate: 'मध्यम',
  Poor: 'खराब',
  'Very Poor': 'बहुत खराब',
  Severe: 'गंभीर',
};

/**
 * Bilingual disclaimers visibly clarifying that outputs are NAQI-style informational estimates, not medical advice.
 */
export const MEDICAL_DISCLAIMER: Record<Language, string> = {
  en: 'NAQI-style estimate, not medical advice. Grounded in Open-Meteo readings; consult a doctor for symptoms.',
  hi: 'यह भारत NAQI-शैली अनुमान है, चिकित्सीय निदान या सलाह नहीं। Open-Meteo डेटा पर आधारित; लक्षण पर डॉक्टर से मिलें।',
};

const SENSITIVE_MASK_GROUPS: ReadonlySet<HouseholdGroup> = new Set([
  'kids',
  'seniors',
  'asthma_heart',
  'outdoor_worker',
]);

const SENSITIVE_HEALTH_GROUPS: ReadonlySet<HouseholdGroup> = new Set([
  'kids',
  'seniors',
  'pregnant',
  'asthma_heart',
  'outdoor_worker',
]);

/**
 * Returns true if any household group requires an N95/FFP2 mask at Moderate NAQI.
 */
export function hasMaskSensitiveGroup(household: readonly HouseholdGroup[]): boolean {
  return household.some((group) => SENSITIVE_MASK_GROUPS.has(group));
}

/**
 * Returns true if the household includes any heightened-sensitivity member.
 */
export function hasAnySensitiveGroup(household: readonly HouseholdGroup[]): boolean {
  return household.some((group) => SENSITIVE_HEALTH_GROUPS.has(group));
}

/**
 * Returns true for Poor, Very Poor, or Severe NAQI tiers.
 */
export function isPoorOrWorseCategory(category: NaqiCategory): boolean {
  return category === 'Poor' || category === 'Very Poor' || category === 'Severe';
}

/**
 * Translates Today/Tomorrow window day labels for UI and advice formatters.
 */
export function formatDayLabel(day: WindowDayLabel, language: Language): string {
  if (language === 'en') return day;
  return day === 'Today' ? 'आज' : 'कल';
}

/**
 * Formats a forward HourWindow cleanly into a localized "Today 14:00–17:00" string.
 */
export function formatWindowLabel(
  win: Pick<HourWindow, 'startHour' | 'endHour' | 'dayLabel'> | null,
  language: Language,
  fallbackEn: string,
  fallbackHi: string
): string {
  if (!win) {
    return language === 'hi' ? fallbackHi : fallbackEn;
  }
  return `${formatDayLabel(win.dayLabel, language)} ${win.startHour}–${win.endHour}`;
}

/**
 * Validates whether a latitude/longitude pair lies inside India geographic bounds.
 */
export function isWithinIndiaBounds(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= INDIA_BOUNDS.minLat &&
    latitude <= INDIA_BOUNDS.maxLat &&
    longitude >= INDIA_BOUNDS.minLon &&
    longitude <= INDIA_BOUNDS.maxLon
  );
}

/**
 * Strips ASCII control characters and angle brackets from untrusted user text.
 */
export function sanitizeUserText(value: string): string {
  return Array.from(value)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code !== 127 && ch !== '<' && ch !== '>';
    })
    .join('')
    .trim();
}

/**
 * Wraps untrusted user-provided text inside explicit XML-style boundaries for prompt-injection defense.
 */
export function wrapUntrustedPromptInput(label: string, value: string): string {
  const safeValue = sanitizeUserText(value).slice(0, APP_CONFIG.maxQuestionLength);
  return `<untrusted_input field="${label}">${safeValue}</untrusted_input>`;
}
