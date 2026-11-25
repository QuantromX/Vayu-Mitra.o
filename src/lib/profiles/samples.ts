import bengaluruWfh from '../../../samples/bengaluru-wfh.json';
import chennaiPregnant from '../../../samples/chennai-pregnant.json';
import delhiKids from '../../../samples/delhi-kids.json';
import jaipurRunner from '../../../samples/jaipur-runner.json';
import kolkataOutdoor from '../../../samples/kolkata-outdoor.json';
import lucknowSenior from '../../../samples/lucknow-senior.json';
import mumbaiAsthma from '../../../samples/mumbai-asthma.json';
import patnaCommuter from '../../../samples/patna-commuter.json';
import type { SampleProfile, UserProfile } from '../../types/index.ts';

/**
 * Eight curated Indian household sample profiles loaded directly from /samples/*.json.
 */
export const SAMPLE_PROFILES: readonly SampleProfile[] = [
  delhiKids as SampleProfile,
  lucknowSenior as SampleProfile,
  patnaCommuter as SampleProfile,
  mumbaiAsthma as SampleProfile,
  bengaluruWfh as SampleProfile,
  kolkataOutdoor as SampleProfile,
  jaipurRunner as SampleProfile,
  chennaiPregnant as SampleProfile,
];

const firstSample = SAMPLE_PROFILES[0];
if (!firstSample) {
  throw new Error('Sample household profiles failed to load');
}

export const DEFAULT_PROFILE: UserProfile = firstSample.profile;

const STORAGE_KEY = 'vayumitra_user_profile_v1';

/**
 * Loads the persisted user profile from localStorage with safe try/catch and validation.
 */
export function loadSavedProfile(): UserProfile {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return DEFAULT_PROFILE;
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    if (
      !parsed ||
      !parsed.city ||
      typeof parsed.city.name !== 'string' ||
      typeof parsed.city.latitude !== 'number' ||
      typeof parsed.city.longitude !== 'number'
    ) {
      return DEFAULT_PROFILE;
    }
    return {
      city: parsed.city,
      household: Array.isArray(parsed.household) ? parsed.household : [],
      lifestyle: parsed.lifestyle ?? 'commute_metro',
      hasPurifier: Boolean(parsed.hasPurifier),
      language: parsed.language === 'hi' ? 'hi' : 'en',
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

/**
 * Saves the user profile to localStorage with safe try/catch handling.
 */
export function saveProfileToStorage(profile: UserProfile): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}
