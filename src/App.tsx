import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { AdviceCardsGrid, VerdictAndMaskCard } from './components/AdviceSection';
import { DataConfidenceCard } from './components/DataConfidenceCard';
import { ErrorBanner } from './components/ErrorBanner';
import { CATEGORY_HINDI, HeroReadout } from './components/HeroReadout';
import {
  OnboardingBanner,
  loadOnboardingDismissed,
  saveOnboardingDismissed,
} from './components/OnboardingBanner';
import { ProfileControls } from './components/ProfileControls';
import { SkylineBackdrop } from './components/SkylineBackdrop';
import { TimeScrubber } from './components/TimeScrubber';
import { useAdvice } from './hooks/useAdvice';
import { useAirData } from './hooks/useAirData';
import { useUserProfile } from './hooks/useUserProfile';
import {
  buildPlanStorageKey,
  collectPlanActionIds,
  computePlanProgress,
  loadCompletedActions,
  saveCompletedActions,
  toggleActionDone,
  triggerHapticTap,
} from './lib/advice/progress';
import { computeScrubbedHourState } from './lib/naqi/scrubber';
import { applyThemeCssVariables, resolveThemeTokens } from './lib/theme/theme';

const HourlyDetailsSheet = lazy(() => import('./components/HourlyDetailsSheet'));
const ShortcutsModal = lazy(() => import('./components/ShortcutsModal'));
const AskVayuMitra = lazy(() => import('./components/AskVayuMitra'));
const PhotoCheckCard = lazy(() => import('./components/PhotoCheckCard'));

export default function App() {
  const {
    profile,
    activeSampleId,
    setCity,
    toggleHouseholdGroup,
    setLifestyle,
    setHasPurifier,
    setLanguage,
    applySampleProfile,
  } = useUserProfile();

  const {
    weather,
    naqi,
    loading,
    error,
    lastUpdated,
    isOfflineData,
    offlineSavedAt,
    retry,
  } = useAirData(profile.city);

  // Auto-collapse "Edit profile" card after the first live result arrives
  const [profileOpen, setProfileOpen] = useState(true);
  const hasAutoCollapsedRef = useRef(false);
  const cityInputRef = useRef<HTMLInputElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  // Signature Time Scrubber state (auto-resets to 0 when city or live timestamp changes)
  const scrubResetKey = `${profile.city.id}:${lastUpdated?.getTime() ?? 0}`;
  const [scrubState, setScrubState] = useState<{ key: string; index: number }>({
    key: scrubResetKey,
    index: 0,
  });
  const scrubIndex = scrubState.key === scrubResetKey ? scrubState.index : 0;
  const setScrubIndex = useCallback(
    (next: number | ((prev: number) => number)) => {
      setScrubState((prev) => {
        const currentIdx = prev.key === scrubResetKey ? prev.index : 0;
        const resolved = typeof next === 'function' ? next(currentIdx) : next;
        return { key: scrubResetKey, index: resolved };
      });
    },
    [scrubResetKey]
  );

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // First-run skippable onboarding
  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(() =>
    loadOnboardingDismissed()
  );

  // Smooth language crossfade feedback
  const [langFading, setLangFading] = useState(false);

  // Share Air Card status
  const [sharing, setSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  // Sticky compact header readout threshold
  const [scrolledCompact, setScrolledCompact] = useState(false);

  const {
    advice,
    loading: adviceLoading,
    error: adviceError,
    revealStage,
    retryAdvice,
  } = useAdvice({
    profile,
    naqi,
    weather,
    airLoading: loading,
    isEditingProfile: profileOpen,
  });

  useEffect(() => {
    if (naqi && !hasAutoCollapsedRef.current) {
      hasAutoCollapsedRef.current = true;
      setProfileOpen(false);
    }
  }, [naqi]);

  // Daily checkable action progress persisted per city & IST date
  const planStorageKey = useMemo(
    () => buildPlanStorageKey(profile.city.name),
    [profile.city.name]
  );
  const [completedState, setCompletedState] = useState<{
    key: string;
    ids: string[];
  }>(() => {
    const initialKey = buildPlanStorageKey(profile.city.name);
    return { key: initialKey, ids: loadCompletedActions(initialKey) };
  });

  const completedIds = useMemo(
    () =>
      completedState.key === planStorageKey
        ? completedState.ids
        : loadCompletedActions(planStorageKey),
    [completedState, planStorageKey]
  );

  const handleToggleDone = useCallback(
    (actionId: string) => {
      setCompletedState((prev) => {
        const baseIds =
          prev.key === planStorageKey ? prev.ids : loadCompletedActions(planStorageKey);
        const next = toggleActionDone(baseIds, actionId);
        saveCompletedActions(planStorageKey, next);
        return { key: planStorageKey, ids: next };
      });
    },
    [planStorageKey]
  );

  const allActionIds = useMemo(() => collectPlanActionIds(advice), [advice]);
  const planProgress = useMemo(
    () => computePlanProgress(allActionIds, completedIds),
    [allActionIds, completedIds]
  );

  // Compute live or scrubbed hour state
  const scrubbed = useMemo(() => {
    if (!naqi || !weather) return null;
    return computeScrubbedHourState({
      naqi,
      weather,
      activeIndex: scrubIndex,
      household: profile.household,
      language: profile.language,
    });
  }, [naqi, weather, scrubIndex, profile.household, profile.language]);

  // Dynamic theme reacts immediately to scrubbed hour (day/night, weather, PM2.5 haze, NAQI tier)
  const theme = useMemo(
    () =>
      resolveThemeTokens({
        category: scrubbed?.category ?? naqi?.category ?? 'Good',
        weatherCode: scrubbed?.weatherCode ?? weather?.weatherCode ?? 0,
        isDay: scrubbed?.isDay ?? weather?.isDay ?? true,
        pm25: scrubbed?.pm25 ?? naqi?.pm25Used ?? 20,
        humidityPct: scrubbed?.humidityPct ?? weather?.humidityPct ?? 50,
        windSpeedKmh: scrubbed?.windSpeedKmh ?? weather?.windSpeedKmh ?? 10,
      }),
    [
      scrubbed?.category,
      scrubbed?.weatherCode,
      scrubbed?.isDay,
      scrubbed?.pm25,
      scrubbed?.humidityPct,
      scrubbed?.windSpeedKmh,
      naqi?.category,
      naqi?.pm25Used,
      weather?.weatherCode,
      weather?.isDay,
      weather?.humidityPct,
      weather?.windSpeedKmh,
    ]
  );

  useEffect(() => {
    applyThemeCssVariables(document.documentElement, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = profile.language;
  }, [profile.language]);

  // Compact sticky header readout when Hero scrolls out of view
  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 260;
      setScrolledCompact((prev) => (prev === next ? prev : next));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const totalForwardHours = naqi?.forwardHourly.length ?? 0;

  const handleStepHour = useCallback(
    (delta: number) => {
      if (totalForwardHours <= 0) return;
      setScrubIndex((prev) => Math.max(0, Math.min(totalForwardHours - 1, prev + delta)));
    },
    [setScrubIndex, totalForwardHours]
  );

  const handleLanguageChange = useCallback(
    (nextLang: 'en' | 'hi') => {
      if (nextLang === profile.language) return;
      triggerHapticTap(8);
      if (prefersReducedMotion) {
        setLanguage(nextLang);
        return;
      }
      setLangFading(true);
      window.setTimeout(() => {
        setLanguage(nextLang);
        setLangFading(false);
      }, 110);
    },
    [profile.language, prefersReducedMotion, setLanguage]
  );

  // Global keyboard shortcuts: / city search, R refresh, [ / ] scrub hours, ? help
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditingText =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isEditingText || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '/') {
        e.preventDefault();
        setProfileOpen(true);
        window.setTimeout(() => {
          cityInputRef.current?.focus();
          cityInputRef.current?.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'center',
          });
        }, 60);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        retry(true);
      } else if (e.key === '[') {
        e.preventDefault();
        handleStepHour(-1);
      } else if (e.key === ']') {
        e.preventDefault();
        handleStepHour(1);
      } else if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleStepHour, prefersReducedMotion, retry]);

  const hi = profile.language === 'hi';

  // Lazy dynamic share card builder & PNG generator
  const handleShareCard = useCallback(async () => {
    if (!naqi || !scrubbed || sharing) return;
    setSharing(true);
    setShareNotice(null);
    triggerHapticTap(10);
    try {
      const { buildShareCardSpec, shareOrDownloadAirCard } =
        await import('./lib/share/shareCard');
      const updatedLabel = lastUpdated
        ? lastUpdated.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Kolkata',
          }) + ' IST'
        : hi
          ? 'लाइव'
          : 'Live';
      const categoryLabel = hi ? CATEGORY_HINDI[scrubbed.category] : scrubbed.category;
      const spec = buildShareCardSpec({
        cityName: profile.city.name,
        admin1: profile.city.admin1,
        aqi: scrubbed.aqi,
        categoryLabel,
        verdictLabel: scrubbed.verdictLabel,
        verdictHeadline: advice?.verdict.headline ?? scrubbed.verdictLine,
        advice,
        theme,
        updatedLabel,
        language: profile.language,
      });
      const result = await shareOrDownloadAirCard(spec);
      setShareNotice(
        result === 'shared'
          ? hi
            ? 'एयर कार्ड साझा किया गया'
            : 'Air Card shared'
          : hi
            ? 'एयर कार्ड PNG डाउनलोड हो गया'
            : 'Air Card PNG downloaded'
      );
      window.setTimeout(() => setShareNotice(null), 3500);
    } catch {
      setShareNotice(hi ? 'एयर कार्ड नहीं बन सका' : 'Could not render Air Card');
      window.setTimeout(() => setShareNotice(null), 3500);
    } finally {
      setSharing(false);
    }
  }, [
    advice,
    hi,
    lastUpdated,
    naqi,
    profile.city.admin1,
    profile.city.name,
    profile.language,
    scrubbed,
    sharing,
    theme,
  ]);

  return (
    <div
      className="relative min-h-screen text-slate-50"
      data-naqi-category={theme.category}
      data-weather-scene={theme.weatherScene}
      data-is-day={String(theme.isDay)}
    >
      {/* Ambient full-page sky gradient backdrop */}
      <SkylineBackdrop theme={theme} />

      {/* Skip to main content link for keyboard & screen-reader navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:min-h-[44px] focus:inline-flex focus:items-center focus:px-4 focus:py-2 focus:rounded-xl focus:bg-white focus:text-slate-950 focus:text-xs focus:font-semibold focus:shadow-2xl focus:outline-none focus:ring-2 focus:ring-slate-950"
      >
        {hi ? 'मुख्य सामग्री पर जाएँ' : 'Skip to main content'}
      </a>

      {/* Compact single-row sticky header (well within 15% mobile viewport cap) */}
      <header className="sticky top-0 z-30 h-14 bg-slate-950/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <a
              href="#main-content"
              className="min-h-[44px] inline-flex items-center font-display text-lg font-semibold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-md px-1"
            >
              {hi ? 'वायुमित्र' : 'VayuMitra'}
            </a>

            {/* Adapts on scroll to keep city, AQI, and verdict visible */}
            {scrolledCompact && scrubbed && (
              <div
                data-testid="sticky-compact-readout"
                className="flex items-center gap-2 min-w-0 pl-2.5 border-l border-white/15 text-xs"
              >
                <span className="font-medium text-white truncate max-w-[132px] sm:max-w-[180px]">
                  {profile.city.name}
                </span>
                <span
                  className="font-mono-tabular font-semibold px-2 py-0.5 rounded-md shrink-0"
                  style={{
                    backgroundColor: theme.accent,
                    color: theme.accentContrast,
                  }}
                >
                  {scrubbed.aqi}
                </span>
                <span className="hidden sm:inline text-slate-200 font-medium truncate">
                  {scrubbed.verdictLabel}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShortcutsOpen(true)}
              aria-label={hi ? 'कीबोर्ड शॉर्टकट (?)' : 'Keyboard shortcuts (?)'}
              className="hidden sm:inline-flex min-h-[44px] min-w-[44px] rounded-xl bg-slate-950/75 border border-white/20 text-slate-200 hover:text-white hover:bg-white/10 items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <HelpCircle className="w-4 h-4" aria-hidden="true" />
            </button>

            {/* EN / हिन्दी language switch */}
            <div
              role="group"
              aria-label={hi ? 'भाषा चुनें' : 'Select language'}
              className="inline-flex p-0.5 rounded-lg bg-slate-950/75 border border-white/20 shrink-0"
            >
              <button
                type="button"
                aria-pressed={profile.language === 'en'}
                onClick={() => handleLanguageChange('en')}
                className={`min-h-[44px] min-w-[44px] px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  profile.language === 'en'
                    ? 'bg-white text-slate-950'
                    : 'text-slate-200 hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                aria-pressed={profile.language === 'hi'}
                onClick={() => handleLanguageChange('hi')}
                className={`min-h-[44px] min-w-[44px] px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  profile.language === 'hi'
                    ? 'bg-white text-slate-950'
                    : 'text-slate-200 hover:text-white'
                }`}
              >
                हिन्दी
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Results-first order: Hero -> Time Scrubber -> Verdict + Mask -> Edit Profile -> Advice Cards -> Ask & Photo Check -> Confidence */}
      <main
        id="main-content"
        tabIndex={-1}
        className={`relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-16 space-y-5 focus:outline-none ${
          prefersReducedMotion ? '' : 'transition-opacity duration-200'
        } ${langFading ? 'opacity-40' : 'opacity-100'}`}
      >
        {error && (
          <ErrorBanner
            message={error}
            language={profile.language}
            isOfflineData={isOfflineData}
            offlineSavedAt={offlineSavedAt}
            onRetry={() => retry(true)}
          />
        )}

        {/* 1. Full-width Hero Scene with Animated AQI Ring Gauge & Verdict Pill */}
        <HeroReadout
          city={profile.city}
          naqi={naqi}
          scrubbed={scrubbed}
          theme={theme}
          loading={loading}
          lastUpdated={lastUpdated}
          isOfflineData={isOfflineData}
          language={profile.language}
          sharing={sharing}
          shareNotice={shareNotice}
          onRefresh={() => retry(true)}
          onShareCard={handleShareCard}
        />

        {/* 2. Signature Interactive 24h Time Scrubber */}
        {naqi && (
          <TimeScrubber
            hourly={naqi.forwardHourly}
            activeIndex={scrubIndex}
            scrubbed={scrubbed}
            cleanestWindow={naqi.cleanestWindow}
            worstWindow={naqi.worstWindow}
            category={naqi.category}
            theme={theme}
            language={profile.language}
            onChangeIndex={setScrubIndex}
            onOpenDetails={() => setDetailsOpen(true)}
          />
        )}

        {/* 3. Today's Verdict + Mask Guidance */}
        <VerdictAndMaskCard
          advice={advice}
          loading={adviceLoading}
          revealStage={revealStage}
          language={profile.language}
          theme={theme}
          errorNotice={adviceError}
          onRetryAdvice={retryAdvice}
        />

        {/* Optional skippable first-run 3-step onboarding strip */}
        {!onboardingDismissed && (
          <OnboardingBanner
            language={profile.language}
            theme={theme}
            onOpenProfile={() => {
              setProfileOpen(true);
              window.setTimeout(() => cityInputRef.current?.focus(), 60);
            }}
            onDismiss={() => {
              saveOnboardingDismissed();
              setOnboardingDismissed(true);
            }}
          />
        )}

        {/* 4. Collapsible "Edit profile" Card (collapsed after first result, summarized as chips) */}
        <ProfileControls
          profile={profile}
          activeSampleId={activeSampleId}
          isOpen={profileOpen}
          onToggleOpen={() => setProfileOpen((o) => !o)}
          onSelectCity={(city) => {
            setCity(city);
            setProfileOpen(false);
          }}
          onToggleHousehold={toggleHouseholdGroup}
          onChangeLifestyle={setLifestyle}
          onChangePurifier={setHasPurifier}
          onApplySample={(id) => {
            applySampleProfile(id);
            setProfileOpen(false);
          }}
          cityInputRef={cityInputRef}
        />

        {/* 5. Today's Plan Progress Ring + Interactive Advice Cards */}
        <AdviceCardsGrid
          advice={advice}
          loading={adviceLoading}
          revealStage={revealStage}
          language={profile.language}
          theme={theme}
          completedIds={completedIds}
          planProgress={planProgress}
          onToggleDone={handleToggleDone}
        />

        {/* 6. Ask VayuMitra — grounded live Q&A */}
        <Suspense fallback={null}>
          <AskVayuMitra profile={profile} naqi={naqi} weather={weather} theme={theme} />
        </Suspense>

        {/* 7. Photo Check — EXIF-stripped visual room & sky advisory check */}
        <Suspense fallback={null}>
          <PhotoCheckCard profile={profile} naqi={naqi} theme={theme} />
        </Suspense>

        {/* 8. Data Confidence — transparent Open-Meteo & CPCB methodology */}
        <DataConfidenceCard
          cityName={profile.city.name}
          naqi={naqi}
          lastUpdated={lastUpdated}
          language={profile.language}
          theme={theme}
        />

        <footer className="pt-5 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <span>{hi ? 'वायुमित्र · डेटा: Open-Meteo' : 'VayuMitra · Data: Open-Meteo'}</span>
          <div className="flex flex-wrap items-center gap-3">
            <span>
              {hi
                ? 'भारत NAQI-शैली अनुमान · केवल जानकारी हेतु मार्गदर्शन'
                : 'India NAQI-style estimate · Informational guidance only'}
            </span>
            <button
              type="button"
              onClick={() => setShortcutsOpen(true)}
              className="min-h-[44px] px-2.5 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {hi ? 'शॉर्टकट (?)' : 'Shortcuts (?)'}
            </button>
          </div>
        </footer>
      </main>

      {/* Lazy-loaded Accessible Hourly Details Bottom Sheet */}
      <Suspense fallback={null}>
        {detailsOpen && (
          <HourlyDetailsSheet
            open={detailsOpen}
            scrubbed={scrubbed}
            totalHours={totalForwardHours}
            theme={theme}
            language={profile.language}
            onClose={() => setDetailsOpen(false)}
            onStepHour={handleStepHour}
          />
        )}
      </Suspense>

      {/* Lazy-loaded Keyboard Shortcuts Help Modal */}
      <Suspense fallback={null}>
        {shortcutsOpen && (
          <ShortcutsModal
            open={shortcutsOpen}
            language={profile.language}
            onClose={() => setShortcutsOpen(false)}
          />
        )}
      </Suspense>
    </div>
  );
}
