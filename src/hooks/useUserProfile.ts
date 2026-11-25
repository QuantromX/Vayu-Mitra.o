import { useCallback, useEffect, useState } from 'react';
import {
  SAMPLE_PROFILES,
  loadSavedProfile,
  saveProfileToStorage,
} from '../lib/profiles/samples';
import type {
  CityLocation,
  HouseholdGroup,
  Language,
  LifestyleMode,
  UserProfile,
} from '../types';

/**
 * Manages the user's household profile, city selection, language preference,
 * and localStorage persistence with safe fallback handling.
 */
export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile>(() => loadSavedProfile());
  const [activeSampleId, setActiveSampleId] = useState<string | null>(() => {
    const initial = loadSavedProfile();
    const match = SAMPLE_PROFILES.find(
      (s) =>
        s.profile.city.name === initial.city.name &&
        s.profile.lifestyle === initial.lifestyle &&
        s.profile.hasPurifier === initial.hasPurifier &&
        JSON.stringify(s.profile.household) === JSON.stringify(initial.household)
    );
    return match ? match.id : null;
  });

  useEffect(() => {
    saveProfileToStorage(profile);
  }, [profile]);

  const setCity = useCallback((city: CityLocation) => {
    setActiveSampleId(null);
    setProfile((prev) => ({ ...prev, city }));
  }, []);

  const toggleHouseholdGroup = useCallback((group: HouseholdGroup) => {
    setActiveSampleId(null);
    setProfile((prev) => {
      const exists = prev.household.includes(group);
      const next = exists
        ? prev.household.filter((g) => g !== group)
        : [...prev.household, group];
      return { ...prev, household: next };
    });
  }, []);

  const setLifestyle = useCallback((lifestyle: LifestyleMode) => {
    setActiveSampleId(null);
    setProfile((prev) => ({ ...prev, lifestyle }));
  }, []);

  const setHasPurifier = useCallback((hasPurifier: boolean) => {
    setActiveSampleId(null);
    setProfile((prev) => ({ ...prev, hasPurifier }));
  }, []);

  const setLanguage = useCallback((language: Language) => {
    setProfile((prev) => ({ ...prev, language }));
  }, []);

  const applySampleProfile = useCallback((sampleId: string) => {
    const sample = SAMPLE_PROFILES.find((s) => s.id === sampleId);
    if (!sample) return;
    setActiveSampleId(sample.id);
    setProfile((prev) => ({
      ...sample.profile,
      language: prev.language,
    }));
  }, []);

  return {
    profile,
    activeSampleId,
    setCity,
    toggleHouseholdGroup,
    setLifestyle,
    setHasPurifier,
    setLanguage,
    applySampleProfile,
  };
}
