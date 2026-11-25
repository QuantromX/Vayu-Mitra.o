import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, SlidersHorizontal, Sparkles } from 'lucide-react';
import { SAMPLE_PROFILES } from '../lib/profiles/samples';
import type { CityLocation, HouseholdGroup, LifestyleMode, UserProfile } from '../types';
import { CitySearch } from './CitySearch';

interface ProfileControlsProps {
  profile: UserProfile;
  activeSampleId: string | null;
  isOpen: boolean;
  onToggleOpen: () => void;
  onSelectCity: (city: CityLocation) => void;
  onToggleHousehold: (group: HouseholdGroup) => void;
  onChangeLifestyle: (lifestyle: LifestyleMode) => void;
  onChangePurifier: (hasPurifier: boolean) => void;
  onApplySample: (sampleId: string) => void;
  cityInputRef?: React.RefObject<HTMLInputElement | null>;
}

const HOUSEHOLD_OPTIONS: Array<{
  id: HouseholdGroup;
  en: string;
  hi: string;
}> = [
  { id: 'kids', en: 'Kids', hi: 'बच्चे' },
  { id: 'seniors', en: 'Seniors', hi: 'वरिष्ठ' },
  { id: 'pregnant', en: 'Pregnant', hi: 'गर्भवती' },
  { id: 'asthma_heart', en: 'Asthma / Heart', hi: 'अस्थमा / हृदय' },
  { id: 'outdoor_worker', en: 'Outdoor worker', hi: 'बाहरी कार्य' },
];

const LIFESTYLE_OPTIONS: Array<{
  id: LifestyleMode;
  en: string;
  hi: string;
}> = [
  { id: 'wfh', en: 'Works from home', hi: 'घर से काम' },
  { id: 'commute_metro', en: 'Metro commute', hi: 'मेट्रो यात्रा' },
  { id: 'commute_bus', en: 'Bus commute', hi: 'बस यात्रा' },
  { id: 'commute_bike', en: 'Two-wheeler', hi: 'बाइक / स्कूटर' },
  { id: 'commute_car', en: 'Car commute', hi: 'कार यात्रा' },
  { id: 'runner_walker', en: 'Runs / walks daily', hi: 'दैनिक सैर / दौड़' },
];

export const ProfileControls: React.FC<ProfileControlsProps> = ({
  profile,
  activeSampleId,
  isOpen,
  onToggleOpen,
  onSelectCity,
  onToggleHousehold,
  onChangeLifestyle,
  onChangePurifier,
  onApplySample,
  cityInputRef,
}) => {
  const hi = profile.language === 'hi';
  const [sampleMenuOpen, setSampleMenuOpen] = useState(false);
  const sampleMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sampleMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (sampleMenuRef.current && !sampleMenuRef.current.contains(e.target as Node)) {
        setSampleMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSampleMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [sampleMenuOpen]);

  const householdSummary = profile.household.length
    ? profile.household
        .map((id) => {
          const match = HOUSEHOLD_OPTIONS.find((o) => o.id === id);
          return match ? (hi ? match.hi : match.en) : id;
        })
        .join(', ')
    : hi
      ? 'सामान्य परिवार'
      : 'General household';

  const lifestyleObj = LIFESTYLE_OPTIONS.find((o) => o.id === profile.lifestyle);
  const lifestyleLabel = lifestyleObj
    ? hi
      ? lifestyleObj.hi
      : lifestyleObj.en
    : profile.lifestyle;

  const purifierLabel = profile.hasPurifier
    ? hi
      ? 'HEPA प्यूरीफायर: हाँ'
      : 'Purifier: Yes'
    : hi
      ? 'HEPA प्यूरीफायर: नहीं'
      : 'Purifier: No';

  return (
    <section
      aria-label={hi ? 'परिवार प्रोफ़ाइल संपादन' : 'Edit household profile'}
      className="vm-glass-card rounded-2xl p-4 sm:p-5 relative z-20"
    >
      {/* Collapsible summary header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <SlidersHorizontal className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{hi ? 'सक्रिय परिवार प्रोफ़ाइल' : 'Active household profile'}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-white">
            <span className="px-2.5 py-1 rounded-lg bg-slate-950/60 border border-white/20 font-medium">
              {profile.city.name}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-950/60 border border-white/20">
              {householdSummary}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-950/60 border border-white/20">
              {lifestyleLabel}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-950/60 border border-white/20">
              {purifierLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="relative" ref={sampleMenuRef}>
            <button
              type="button"
              data-testid="try-sample-btn"
              aria-haspopup="menu"
              aria-expanded={sampleMenuOpen}
              onClick={() => setSampleMenuOpen((prev) => !prev)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-950/70 border border-white/25 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-white/15 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{hi ? 'उदाहरण चुनें' : 'Try a sample'}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-150 ${
                  sampleMenuOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {sampleMenuOpen && (
              <div
                role="menu"
                aria-label={hi ? '8 भारतीय परिवार उदाहरण' : '8 Indian household samples'}
                className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl bg-slate-950/95 border border-white/25 p-2 shadow-2xl z-40 space-y-1 max-h-80 overflow-y-auto"
              >
                {SAMPLE_PROFILES.map((sample) => {
                  const active = activeSampleId === sample.id;
                  return (
                    <button
                      key={sample.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onApplySample(sample.id);
                        setSampleMenuOpen(false);
                      }}
                      className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'text-slate-200 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-semibold truncate">
                        {hi ? sample.labelHi : sample.label}
                      </div>
                      <div className="text-xs text-slate-300 truncate">
                        {hi ? sample.subtitleHi : sample.subtitle}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls="editable-profile-panel"
            onClick={onToggleOpen}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-white text-slate-950 text-xs font-semibold inline-flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span>
              {isOpen
                ? hi
                  ? 'प्रोफ़ाइल बंद करें'
                  : 'Done editing'
                : hi
                  ? 'प्रोफ़ाइल बदलें'
                  : 'Edit profile'}
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-150 ${
                isOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* Expanded controls */}
      {isOpen && (
        <div
          id="editable-profile-panel"
          className="mt-5 pt-5 border-t border-white/15 space-y-5"
        >
          {/* Quick 1-tap sample presets */}
          <div>
            <h2 className="text-xs font-semibold tracking-wide text-slate-200 mb-2.5">
              {hi ? 'त्वरित उदाहरण प्रोफ़ाइल' : 'One-tap household presets'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {SAMPLE_PROFILES.map((sample) => {
                const active = activeSampleId === sample.id;
                return (
                  <button
                    key={sample.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onApplySample(sample.id)}
                    className={`min-h-[44px] px-3.5 py-2.5 rounded-xl text-left transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                      active
                        ? 'bg-white/20 border-white/60 text-white'
                        : 'bg-slate-950/45 border-white/15 text-slate-200 hover:bg-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className="text-xs font-semibold truncate">
                      {hi ? sample.labelHi : sample.label}
                    </div>
                    <div className="text-xs text-slate-300 truncate mt-0.5">
                      {hi ? sample.subtitleHi : sample.subtitle}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* City autocomplete */}
            <div className="lg:col-span-4">
              <CitySearch
                selectedCity={profile.city}
                language={profile.language}
                onSelectCity={onSelectCity}
                inputRef={cityInputRef}
              />
            </div>

            {/* Household vulnerability buttons */}
            <div className="lg:col-span-4">
              <span className="block text-xs font-medium text-slate-300 mb-2">
                {hi ? 'परिवार के सदस्य' : 'Household members'}
              </span>
              <div className="flex flex-wrap gap-2">
                {HOUSEHOLD_OPTIONS.map((opt) => {
                  const selected = profile.household.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onToggleHousehold(opt.id)}
                      className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-medium transition-colors border whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                        selected
                          ? 'bg-white text-slate-950 border-white shadow-sm'
                          : 'bg-slate-950/45 text-slate-200 border-white/20 hover:bg-white/12'
                      }`}
                    >
                      {hi ? opt.hi : opt.en}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Daily routine / commute */}
            <div className="lg:col-span-4">
              <span className="block text-xs font-medium text-slate-300 mb-2">
                {hi ? 'दैनिक दिनचर्या और यात्रा' : 'Daily routine & commute'}
              </span>
              <div className="grid grid-cols-2 gap-2">
                {LIFESTYLE_OPTIONS.map((opt) => {
                  const selected = profile.lifestyle === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onChangeLifestyle(opt.id)}
                      className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                        selected
                          ? 'bg-white text-slate-950 border-white shadow-sm'
                          : 'bg-slate-950/45 text-slate-200 border-white/20 hover:bg-white/12'
                      }`}
                    >
                      <span className="block truncate">{hi ? opt.hi : opt.en}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Air purifier segmented switch */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
            <span className="text-xs font-medium text-slate-200">
              {hi ? 'घर में HEPA एयर प्यूरीफायर?' : 'HEPA air purifier at home?'}
            </span>
            <div
              role="group"
              aria-label={hi ? 'एयर प्यूरीफायर विकल्प' : 'Air purifier availability'}
              className="inline-flex p-1 rounded-lg bg-slate-950/60 border border-white/15"
            >
              <button
                type="button"
                aria-pressed={profile.hasPurifier}
                onClick={() => onChangePurifier(true)}
                className={`min-h-[44px] px-4 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  profile.hasPurifier
                    ? 'bg-white text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {hi ? 'हाँ' : 'Yes'}
              </button>
              <button
                type="button"
                aria-pressed={!profile.hasPurifier}
                onClick={() => onChangePurifier(false)}
                className={`min-h-[44px] px-4 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  !profile.hasPurifier
                    ? 'bg-white text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {hi ? 'नहीं' : 'No'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
