import React, { useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import type { Language, ThemeTokens } from '../types';

export const ONBOARDING_STORAGE_KEY = 'vayumitra_onboarding_done_v1';

export function loadOnboardingDismissed(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveOnboardingDismissed(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
    }
  } catch {
    // Ignore storage restriction
  }
}

interface OnboardingBannerProps {
  language: Language;
  theme: ThemeTokens;
  onOpenProfile: () => void;
  onDismiss: () => void;
}

const STEPS = [
  {
    enTitle: '1. Pick your city',
    enBody: 'Choose any Indian city for live Open-Meteo air & weather.',
    hiTitle: '1. अपना शहर चुनें',
    hiBody: 'लाइव Open-Meteo हवा और मौसम के लिए कोई भी भारतीय शहर चुनें।',
  },
  {
    enTitle: '2. Pick household',
    enBody: 'Select kids, seniors, asthma care, commute, and purifier.',
    hiTitle: '2. परिवार चुनें',
    hiBody: 'बच्चे, वरिष्ठ, अस्थमा देखभाल, यात्रा और प्यूरीफायर चुनें।',
  },
  {
    enTitle: '3. Scrub & act',
    enBody: 'Scrub the 24h bar to preview air and tick off today’s plan.',
    hiTitle: '3. स्क्रब करें और अमल करें',
    hiBody: '24 घंटे की पट्टी स्क्रब करें और आज की योजना पूरी करें।',
  },
];

export const OnboardingBanner: React.FC<OnboardingBannerProps> = ({
  language,
  theme,
  onOpenProfile,
  onDismiss,
}) => {
  const hi = language === 'hi';
  const [step, setStep] = useState(0);
  const current = STEPS[step] ?? STEPS[0];
  if (!current) return null;

  return (
    <aside
      aria-label={hi ? 'त्वरित परिचय' : 'Quick start guide'}
      className="vm-glass-card rounded-[24px] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {/* Original lightweight SVG onboarding illustration */}
        <svg
          width="44"
          height="44"
          viewBox="0 0 48 48"
          className="w-11 h-11 shrink-0"
          aria-hidden="true"
        >
          <circle cx="24" cy="24" r="22" fill="rgba(255,255,255,0.08)" />
          <circle cx="20" cy="18" r="5" fill={theme.sunColor} />
          <path
            d="M12 34 L17 24 L23 30 L28 21 L36 34 Z"
            fill="rgba(255,255,255,0.2)"
            stroke={theme.accent}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>

        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <span>{hi ? current.hiTitle : current.enTitle}</span>
            <span className="font-mono-tabular text-slate-300">({step + 1}/3)</span>
          </div>
          <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">
            {hi ? current.hiBody : current.enBody}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {step === 0 && (
          <button
            type="button"
            onClick={onOpenProfile}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-950/60 border border-white/20 text-xs font-medium text-white hover:bg-white/15 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {hi ? 'प्रोफ़ाइल खोलें' : 'Open profile'}
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            if (step < STEPS.length - 1) {
              setStep((s) => s + 1);
            } else {
              onDismiss();
            }
          }}
          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white text-slate-950 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-100 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <span>
            {step < STEPS.length - 1 ? (hi ? 'अगला' : 'Next') : hi ? 'शुरू करें' : 'Got it'}
          </span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onDismiss}
          aria-label={hi ? 'परिचय छोड़ें' : 'Skip quick guide'}
          className="min-h-[44px] min-w-[44px] rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
};
