# Accessibility Statement & Checklist — VayuMitra

VayuMitra is engineered to meet **WCAG 2.1 Level AA** across all 6 NAQI themes (day & night), weather scenes, bilingual English (`lang="en"`) and Hindi (`lang="hi"`) modes, 200% browser zoom, and `320px` narrow mobile viewports.

## Implemented Measures

1. **Skip Navigation, Landmarks & Dynamic Language**
   - Keyboard-accessible **Skip to main content** link (`#main-content`) visible on focus.
   - Explicit `<header>`, `<main id="main-content" tabIndex={-1}>`, labelled `<section>` regions, and `<footer>`.
   - Single `<h1>` (active city heading in `HeroReadout`) with logical `<h2>` and `<h3>` heading order across cards.
   - `document.documentElement.lang` synchronizes dynamically between `"en"` and `"hi"` so assistive technologies switch pronunciation profiles accurately.

2. **Keyboard Navigation & Focus Management**
   - Global keyboard shortcuts: `/` focuses city search, `R` refreshes Open-Meteo telemetry, `[` / `]` scrub 24h hours, `?` opens/closes the keyboard shortcuts modal.
   - `HourlyDetailsSheet` and `ShortcutsModal` implement `role="dialog"`, `aria-modal="true"`, `Tab`/`Shift+Tab` focus trapping, `Escape` dismissal, and focus restoration to the triggering control on close.
   - `TimeScrubber` uses `role="slider"` with `ArrowLeft`/`ArrowRight`/`Home`/`End`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and descriptive `aria-valuetext`.
   - `"Try a sample"` menu supports `aria-haspopup="menu"`, `aria-expanded`, `role="menu"` / `role="menuitem"`, and `Escape` dismissal.

3. **Screen Reader Announcements & Form Error Bindings**
   - Scrubbed hour telemetry, Ask VayuMitra answers, Photo Check results, and Share Air Card feedback announce updates via `aria-live="polite"` / `role="status"`.
   - Form validation/fetch errors use `role="alert"` and are explicitly bound to inputs via `aria-describedby` and `aria-invalid` (`CitySearch`, `AskVayuMitra`, `PhotoCheckCard`).
   - All inputs have explicit `htmlFor`/`id` labels and readable helper text (`>= 12px`).

4. **Contrast, Colour Independence & Motion**
   - Dark gradient scrim (`rgba(2, 6, 23, 0.56–0.8)`) behind Hero text guarantees WCAG AA contrast on all 6 NAQI categories across clear, cloudy, fog, rain, thunder, day, and night themes.
   - `prefers-contrast: more` increases border contrast and opaque dark scrims in `src/index.css`.
   - NAQI categories and verdicts pair color with explicit text labels and distinct icons (`ShieldCheck`, `Leaf`, `CloudSun`, `AlertTriangle`, `Flame`, `Skull`).
   - Particle canvas animations, parallax, and smooth transitions automatically pause/disable under `prefers-reduced-motion: reduce`.

5. **Touch Targets, 320px Width & 200% Zoom**
   - Interactive buttons, toggles, checkboxes, chips, and menu items enforce `min-h-[44px]` (`>= 44px` touch target).
   - Verified with `jest-axe` automated rules (0 violations across all main cards and dialogs) and Playwright viewport checks at `1280x900`, `640x480` (200% zoom simulation), and `320x700` with `0px` horizontal overflow.
