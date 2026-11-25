import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import type { ThemeTokens } from '../types';

const HeroParticleCanvas = lazy(() => import('./HeroParticleCanvas'));

export type SkylineCityKey = 'delhi' | 'mumbai' | 'lucknow' | 'kolkata' | 'generic';

export function resolveCitySkyline(cityName: string): SkylineCityKey {
  const normalized = cityName.toLowerCase();
  if (
    normalized.includes('delhi') ||
    normalized.includes('noida') ||
    normalized.includes('gurgaon') ||
    normalized.includes('gurugram')
  ) {
    return 'delhi';
  }
  if (
    normalized.includes('mumbai') ||
    normalized.includes('thane') ||
    normalized.includes('navi mumbai')
  ) {
    return 'mumbai';
  }
  if (normalized.includes('lucknow')) {
    return 'lucknow';
  }
  if (normalized.includes('kolkata') || normalized.includes('howrah')) {
    return 'kolkata';
  }
  return 'generic';
}

function LandmarkMidLayer({ cityKey }: { cityKey: SkylineCityKey }) {
  if (cityKey === 'delhi') {
    return (
      <g fill="currentColor" fillOpacity="0.58">
        <polygon points="155,340 164,188 176,188 185,340" />
        <rect x="161" y="232" width="18" height="4" />
        <rect x="163" y="206" width="14" height="4" />
        <rect x="30" y="275" width="58" height="65" />
        <rect x="96" y="255" width="44" height="85" />
        <rect x="210" y="268" width="66" height="72" />
        <path d="M510 340 L510 215 L522 204 L598 204 L610 215 L610 340 L583 340 L583 268 C583 248 537 248 537 268 L537 340 Z" />
        <rect x="502" y="204" width="116" height="8" />
        <rect x="524" y="194" width="72" height="10" />
        <path d="M845 340 C858 292 872 262 885 245 C898 262 912 292 925 340 Z" />
        <path d="M820 340 C836 302 852 280 864 270 C860 296 862 320 868 340 Z" />
        <path d="M950 340 C934 302 918 280 906 270 C910 296 908 320 902 340 Z" />
        <rect x="975" y="262" width="72" height="78" />
        <rect x="1062" y="246" width="56" height="94" />
        <rect x="1130" y="280" width="55" height="60" />
      </g>
    );
  }

  if (cityKey === 'mumbai') {
    return (
      <g fill="currentColor" fillOpacity="0.58">
        <polygon points="168,340 182,168 192,168 206,340" />
        <line
          x1="187"
          y1="176"
          x2="72"
          y2="318"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.55"
        />
        <line
          x1="187"
          y1="196"
          x2="108"
          y2="318"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.55"
        />
        <line
          x1="187"
          y1="176"
          x2="296"
          y2="318"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.55"
        />
        <line
          x1="187"
          y1="196"
          x2="262"
          y2="318"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.55"
        />
        <rect x="20" y="316" width="320" height="8" />
        <rect x="355" y="220" width="44" height="120" />
        <rect x="410" y="196" width="52" height="144" />
        <rect x="472" y="236" width="40" height="104" />
        <path d="M620 340 L620 232 L636 232 L636 218 L660 218 L660 202 C674 188 696 188 710 202 L710 218 L734 218 L734 232 L750 232 L750 340 L712 340 L712 276 C712 252 658 252 658 276 L658 340 Z" />
        <rect x="782" y="248" width="54" height="92" />
        <rect x="846" y="212" width="48" height="128" />
        <rect x="908" y="256" width="64" height="84" />
        <rect x="986" y="228" width="46" height="112" />
        <rect x="1046" y="268" width="84" height="72" />
      </g>
    );
  }

  if (cityKey === 'lucknow') {
    return (
      <g fill="currentColor" fillOpacity="0.58">
        <rect x="36" y="276" width="76" height="64" />
        <rect x="164" y="186" width="26" height="154" />
        <polygon points="164,186 177,164 190,186" />
        <rect x="315" y="256" width="160" height="84" />
        <path d="M350 256 C350 220 440 220 440 256 Z" />
        <path d="M322 256 C322 238 346 238 346 256 Z" />
        <path d="M444 256 C444 238 468 238 468 256 Z" />
        <path d="M620 340 L620 228 C646 192 714 192 740 228 L740 340 L706 340 L706 270 C706 242 654 242 654 270 L654 340 Z" />
        <circle cx="680" cy="196" r="10" />
        <rect x="610" y="220" width="10" height="120" />
        <rect x="740" y="220" width="10" height="120" />
        <rect x="815" y="264" width="88" height="76" />
        <rect x="920" y="246" width="66" height="94" />
        <rect x="1008" y="274" width="110" height="66" />
      </g>
    );
  }

  if (cityKey === 'kolkata') {
    return (
      <g fill="currentColor" fillOpacity="0.58">
        <path
          d="M35 340 L35 280 L115 206 L255 206 L335 280 L335 340"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeOpacity="0.6"
        />
        <line
          x1="115"
          y1="206"
          x2="115"
          y2="340"
          stroke="currentColor"
          strokeWidth="5"
          strokeOpacity="0.6"
        />
        <line
          x1="255"
          y1="206"
          x2="255"
          y2="340"
          stroke="currentColor"
          strokeWidth="5"
          strokeOpacity="0.6"
        />
        <line
          x1="115"
          y1="206"
          x2="185"
          y2="278"
          stroke="currentColor"
          strokeWidth="3"
          strokeOpacity="0.55"
        />
        <line
          x1="255"
          y1="206"
          x2="185"
          y2="278"
          stroke="currentColor"
          strokeWidth="3"
          strokeOpacity="0.55"
        />
        <rect x="20" y="286" width="335" height="8" />
        <rect x="442" y="182" width="18" height="158" />
        <circle cx="451" cy="176" r="10" />
        <rect x="570" y="266" width="230" height="74" />
        <rect x="646" y="232" width="78" height="34" />
        <path d="M642 232 C642 184 728 184 728 232 Z" />
        <rect x="682" y="176" width="6" height="16" />
        <path d="M582 266 C582 246 610 246 610 266 Z" />
        <path d="M760 266 C760 246 788 246 788 266 Z" />
        <rect x="854" y="238" width="58" height="102" />
        <rect x="926" y="214" width="50" height="126" />
        <rect x="992" y="256" width="74" height="84" />
        <rect x="1080" y="272" width="84" height="68" />
      </g>
    );
  }

  return (
    <g fill="currentColor" fillOpacity="0.58">
      <rect x="40" y="268" width="64" height="72" />
      <rect x="116" y="242" width="48" height="98" />
      <rect x="242" y="200" width="28" height="140" />
      <polygon points="242,200 256,174 270,200" />
      <rect x="330" y="264" width="84" height="76" />
      <path d="M500 340 L500 252 L640 252 L640 340 Z" />
      <path d="M534 252 C534 214 606 214 606 252 Z" />
      <rect x="700" y="232" width="56" height="108" />
      <rect x="772" y="258" width="74" height="82" />
      <rect x="868" y="218" width="52" height="122" />
      <rect x="938" y="262" width="82" height="78" />
      <rect x="1036" y="248" width="64" height="92" />
    </g>
  );
}

/**
 * Hero-embedded atmospheric scene: sky gradient, lazy-loaded particle canvas,
 * sun/moon arc disc, cloud/fog/thunder layers, and 3-layer SVG skyline with scroll/tilt parallax.
 */
export const HeroSkylineScene: React.FC<{
  cityName: string;
  theme: ThemeTokens;
  pm25: number;
  sunXPercent?: number;
  sunYPercent?: number;
}> = React.memo(({ cityName, theme, pm25, sunXPercent = 82, sunYPercent = 18 }) => {
  const cityKey = useMemo(() => resolveCitySkyline(cityName), [cityName]);
  const prefersReducedMotion = useReducedMotion();
  const farLayerOpacity = Math.max(0.06, 0.34 - theme.hazeOpacity * 0.3);

  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const effectiveParallax = prefersReducedMotion ? { x: 0, y: 0 } : parallax;

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    const handleScroll = () => {
      const yOffset = Math.min(26, window.scrollY * 0.08);
      setParallax((prev) => ({ ...prev, y: yOffset }));
    };

    const handleOrientation = (evt: DeviceOrientationEvent) => {
      if (typeof evt.gamma !== 'number') return;
      const clamped = Math.max(-18, Math.min(18, evt.gamma));
      setParallax((prev) => ({ ...prev, x: clamped * 0.6 }));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('deviceorientation', handleOrientation, {
      passive: true,
    });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [prefersReducedMotion]);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden vm-theme-transition"
      aria-hidden="true"
      style={{
        background: `linear-gradient(180deg, ${theme.skyTop} 0%, ${theme.skyMid} 52%, ${theme.skyBottom} 100%)`,
      }}
    >
      {/* Static subtle SVG noise grain */}
      <div className="absolute inset-0 vm-grain-overlay opacity-70" />

      {/* Lazy-loaded lightweight particle canvas (disabled under reduced motion) */}
      {!prefersReducedMotion && (
        <Suspense fallback={null}>
          <HeroParticleCanvas
            theme={theme}
            pm25={pm25}
            sunXPercent={sunXPercent}
            sunYPercent={sunYPercent}
          />
        </Suspense>
      )}

      {/* Sun or Moon disc positioned along the active hour's sky arc */}
      <div
        className="absolute w-16 h-16 sm:w-24 sm:h-24 rounded-full -translate-x-1/2 -translate-y-1/2 vm-theme-transition"
        style={{
          left: `${sunXPercent}%`,
          top: `${sunYPercent}%`,
          background: `radial-gradient(circle, ${theme.sunColor} 50%, transparent 100%)`,
          opacity:
            theme.weatherScene === 'fog' || theme.weatherScene === 'thunder'
              ? 0.35
              : Math.max(0.42, 0.96 - theme.hazeOpacity * 0.42),
          boxShadow: `0 0 48px 14px ${theme.sunGlow}`,
          transition: prefersReducedMotion
            ? 'none'
            : 'left 450ms cubic-bezier(0.16, 1, 0.3, 1), top 450ms cubic-bezier(0.16, 1, 0.3, 1), opacity 400ms ease',
        }}
      />

      {/* Cloudy / Thunder cloud silhouettes */}
      {(theme.weatherScene === 'cloudy' ||
        theme.weatherScene === 'rain' ||
        theme.weatherScene === 'thunder') && (
        <svg
          width="1200"
          height="220"
          className="vm-cloud absolute inset-x-[-6%] top-0 w-[112%] h-[58%]"
          viewBox="0 0 1200 220"
          preserveAspectRatio="xMidYMin slice"
        >
          <g
            fill={theme.weatherScene === 'thunder' ? '#0f172a' : '#e2e8f0'}
            fillOpacity={theme.weatherScene === 'thunder' ? 0.55 : 0.16}
          >
            <ellipse cx="220" cy="65" rx="150" ry="38" />
            <ellipse cx="320" cy="52" rx="115" ry="34" />
            <ellipse cx="860" cy="76" rx="170" ry="42" />
            <ellipse cx="970" cy="60" rx="120" ry="34" />
          </g>
        </svg>
      )}

      {/* Thunder bolt + subtle flash */}
      {theme.weatherScene === 'thunder' && (
        <>
          <div className="vm-thunder absolute inset-0 bg-indigo-100" />
          <svg
            width="40"
            height="100"
            className="absolute right-[24%] top-[18%] w-10 h-24 text-amber-200/75"
            viewBox="0 0 40 100"
          >
            <polygon points="22,4 8,50 20,50 14,92 34,42 22,42" fill="currentColor" />
          </svg>
        </>
      )}

      {/* Frosted fog mist layers */}
      {(theme.weatherScene === 'fog' || theme.hazeOpacity >= 0.4) && (
        <>
          <div
            className="vm-fog-layer absolute inset-x-[-10%] bottom-[20%] h-36"
            style={{
              background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${
                theme.weatherScene === 'fog'
                  ? 'rgba(241, 245, 249, 0.28)'
                  : theme.hazeColor
              } 0%, transparent 75%)`,
              opacity: theme.weatherScene === 'fog' ? 0.78 : theme.hazeOpacity * 0.85,
            }}
          />
          <div
            className="vm-fog-layer absolute inset-x-[-12%] bottom-[4%] h-40"
            style={{
              background: `radial-gradient(ellipse 65% 55% at 50% 50%, ${
                theme.weatherScene === 'fog'
                  ? 'rgba(226, 232, 240, 0.3)'
                  : theme.hazeColor
              } 0%, transparent 75%)`,
              animationDelay: '-6s',
              opacity: theme.weatherScene === 'fog' ? 0.82 : theme.hazeOpacity * 0.9,
            }}
          />
        </>
      )}

      {/* Original 3-layer SVG city skyline with gentle scroll & tilt parallax */}
      <svg
        width="1200"
        height="340"
        className="absolute bottom-0 inset-x-[-3%] w-[106%] h-[66%] min-h-[190px] text-slate-950 vm-theme-transition"
        viewBox="0 0 1200 340"
        preserveAspectRatio="xMidYMax slice"
      >
        {/* Far ridge + distant high-rises fading into PM2.5 haze */}
        <g
          fill="currentColor"
          fillOpacity={farLayerOpacity}
          style={{
            transform: `translate3d(${(effectiveParallax.x * 0.35).toFixed(1)}px, ${(effectiveParallax.y * 0.3).toFixed(1)}px, 0)`,
          }}
        >
          <path d="M0 340 L0 266 Q180 240 360 262 T740 248 T1200 268 L1200 340 Z" />
          <rect x="65" y="218" width="38" height="122" />
          <rect x="112" y="198" width="32" height="142" />
          <rect x="280" y="210" width="44" height="130" />
          <rect x="450" y="204" width="36" height="136" />
          <rect x="742" y="192" width="48" height="148" />
          <rect x="944" y="212" width="42" height="128" />
          <rect x="1090" y="202" width="46" height="138" />
        </g>

        {/* Mid layer with city-specific Indian landmark silhouettes */}
        <g
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="1"
          style={{
            transform: `translate3d(${(effectiveParallax.x * 0.7).toFixed(1)}px, ${(effectiveParallax.y * 0.55).toFixed(1)}px, 0)`,
          }}
        >
          <LandmarkMidLayer cityKey={cityKey} />
        </g>

        {/* Foreground urban rooftops */}
        <g
          fill="currentColor"
          fillOpacity="0.92"
          style={{
            transform: `translate3d(${effectiveParallax.x.toFixed(1)}px, ${(effectiveParallax.y * 0.85).toFixed(1)}px, 0)`,
          }}
        >
          <path d="M0 340 L0 310 L68 310 L68 296 L124 296 L124 316 L210 316 L210 302 L276 302 L276 318 L392 318 L392 298 L452 298 L452 320 L560 320 L560 305 L635 305 L635 318 L754 318 L754 294 L828 294 L828 316 L932 316 L932 304 L1022 304 L1022 320 L1118 320 L1118 300 L1200 300 L1200 340 Z" />
        </g>
      </svg>
    </div>
  );
});

HeroSkylineScene.displayName = 'HeroSkylineScene';

/**
 * Full-page ambient sky backdrop (sky gradient + faint grain).
 */
export const SkylineBackdrop: React.FC<{ theme: ThemeTokens }> = React.memo(
  ({ theme }) => {
    return (
      <div
        className="pointer-events-none fixed inset-0 z-0 vm-theme-transition"
        aria-hidden="true"
        style={{
          background: `linear-gradient(180deg, ${theme.skyTop} 0%, ${theme.skyMid} 52%, ${theme.skyBottom} 100%)`,
        }}
      >
        <div className="absolute inset-0 vm-grain-overlay opacity-75" />
      </div>
    );
  }
);

SkylineBackdrop.displayName = 'SkylineBackdrop';

export default SkylineBackdrop;
