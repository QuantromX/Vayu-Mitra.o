import type {
  AdviceResponse,
  Language,
  ShareCardSpec,
  ThemeTokens,
} from '../../types/index.ts';

/**
 * Builds deterministic 1080x1350 Share Air Card data grounded in the active city,
 * scrubbed/live NAQI, verdict, top 2 actions, theme tokens, and alt text.
 */
export function buildShareCardSpec(params: {
  cityName: string;
  admin1?: string;
  aqi: number;
  categoryLabel: string;
  verdictLabel: string;
  verdictHeadline: string;
  advice: AdviceResponse | null;
  theme: ThemeTokens;
  updatedLabel: string;
  language: Language;
}): ShareCardSpec {
  const hi = params.language === 'hi';
  const cityTitle = params.admin1
    ? `${params.cityName}, ${params.admin1}`
    : params.cityName;

  const candidateActions: string[] = [];
  if (params.advice) {
    if (params.advice.outdoor[0]?.action) {
      candidateActions.push(params.advice.outdoor[0].action);
    }
    if (params.advice.indoor[0]?.action) {
      candidateActions.push(params.advice.indoor[0].action);
    }
    if (candidateActions.length < 2 && params.advice.routine[0]?.action) {
      candidateActions.push(params.advice.routine[0].action);
    }
  }
  if (candidateActions.length === 0) {
    candidateActions.push(
      hi
        ? 'कम प्रदूषण वाले समय में बाहरी काम निपटाएँ।'
        : 'Shift outdoor errands to the lower-pollution window ahead.',
      hi ? 'पीक धुंध के घंटों में खिड़कियाँ बंद रखें।' : 'Keep windows closed during peak haze hours.'
    );
  }

  const topActions = candidateActions.slice(0, 2);
  const attribution = hi
    ? 'डेटा: Open-Meteo · भारत NAQI-शैली अनुमान'
    : 'Data: Open-Meteo · India NAQI-style estimate';

  const altText = hi
    ? `${cityTitle} के लिए वायुमित्र एयर कार्ड: NAQI ${params.aqi} (${params.categoryLabel}), निष्कर्ष: ${params.verdictLabel} — ${params.verdictHeadline}`
    : `VayuMitra Air Card for ${cityTitle}: NAQI ${params.aqi} (${params.categoryLabel}), Verdict: ${params.verdictLabel} — ${params.verdictHeadline}`;

  return {
    width: 1080,
    height: 1350,
    cityTitle,
    aqi: params.aqi,
    categoryLabel: params.categoryLabel,
    verdictLabel: params.verdictLabel,
    verdictHeadline: params.verdictHeadline,
    topActions,
    attribution,
    updatedLabel: params.updatedLabel,
    altText,
    theme: params.theme,
  };
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Renders a 1080x1350 Air Card PNG onto an offscreen canvas using the live theme tokens.
 */
export async function renderShareCardBlob(spec: ShareCardSpec): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = spec.width;
  canvas.height = spec.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  // Sky gradient background
  const grad = ctx.createLinearGradient(0, 0, 0, spec.height);
  grad.addColorStop(0, spec.theme.skyTop);
  grad.addColorStop(0.55, spec.theme.skyMid);
  grad.addColorStop(1, spec.theme.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, spec.width, spec.height);

  // Subtle sun/moon disc glow
  const sunX = spec.width * 0.8;
  const sunY = spec.height * 0.19;
  const sunRad = ctx.createRadialGradient(sunX, sunY, 12, sunX, sunY, 170);
  sunRad.addColorStop(0, spec.theme.sunColor);
  sunRad.addColorStop(0.45, spec.theme.sunGlow);
  sunRad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sunRad;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 170, 0, Math.PI * 2);
  ctx.fill();

  // Silhouette horizon along bottom
  ctx.fillStyle = 'rgba(2, 6, 23, 0.42)';
  ctx.beginPath();
  ctx.moveTo(0, spec.height);
  ctx.lineTo(0, 1140);
  const heights = [1140, 1080, 1110, 1040, 1095, 1020, 1105, 1060, 1125];
  heights.forEach((y, i) => {
    const x1 = i * 120;
    const x2 = x1 + 120;
    ctx.lineTo(x1, y);
    ctx.lineTo(x2, y);
  });
  ctx.lineTo(spec.width, spec.height);
  ctx.closePath();
  ctx.fill();

  // Contrast scrim card container
  drawRoundedRect(ctx, 64, 68, spec.width - 128, spec.height - 136, 40);
  ctx.fillStyle = 'rgba(2, 6, 23, 0.46)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Header wordmark & updated stamp
  ctx.fillStyle = '#f8fafc';
  ctx.font = '600 34px Sora, Inter, sans-serif';
  ctx.fillText('VayuMitra', 112, 146);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '500 24px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(spec.updatedLabel, spec.width - 112, 146);
  ctx.textAlign = 'left';

  // City title
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 48px Sora, Inter, sans-serif';
  ctx.fillText(spec.cityTitle.slice(0, 32), 112, 240);

  // AQI Ring Gauge
  const cx = 290;
  const cy = 470;
  const radius = 152;
  const startAngle = Math.PI * 0.75;
  const fullSweep = Math.PI * 1.5;

  // Track
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 22;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, startAngle + fullSweep);
  ctx.stroke();

  // Active arc
  const pct = Math.max(0.03, Math.min(1, spec.aqi / 500));
  ctx.strokeStyle = spec.theme.accent;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, startAngle + fullSweep * pct);
  ctx.stroke();

  // Ring center AQI number
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = '300 106px Sora, Inter, sans-serif';
  ctx.fillText(String(spec.aqi), cx, cy + 28);
  ctx.fillStyle = spec.theme.accent;
  ctx.font = '600 28px Inter, sans-serif';
  ctx.fillText(spec.categoryLabel, cx, cy + 84);
  ctx.textAlign = 'left';

  // Verdict Pill + Headline beside ring
  const pillX = 500;
  const pillY = 365;
  drawRoundedRect(ctx, pillX, pillY, 440, 62, 18);
  ctx.fillStyle = spec.theme.accent;
  ctx.fill();
  ctx.fillStyle = spec.theme.accentContrast;
  ctx.font = '700 28px Sora, Inter, sans-serif';
  ctx.fillText(spec.verdictLabel, pillX + 26, pillY + 41);

  ctx.fillStyle = '#ffffff';
  ctx.font = '500 32px Sora, Inter, sans-serif';
  const headlineLines = wrapTextLines(ctx, spec.verdictHeadline, 456).slice(0, 4);
  headlineLines.forEach((line, idx) => {
    ctx.fillText(line, pillX, 480 + idx * 46);
  });

  // Top 2 actions section
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(112, 705);
  ctx.lineTo(spec.width - 112, 705);
  ctx.stroke();

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '600 24px Inter, sans-serif';
  ctx.fillText('TOP ACTIONS', 112, 760);

  let cursorY = 810;
  spec.topActions.forEach((action, idx) => {
    ctx.font = '500 26px Inter, sans-serif';
    const lines = wrapTextLines(ctx, action, spec.width - 330).slice(0, 3);
    const boxH = Math.max(114, 60 + lines.length * 36);
    drawRoundedRect(ctx, 112, cursorY - 28, spec.width - 224, boxH, 24);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.56)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.stroke();

    ctx.fillStyle = spec.theme.accent;
    ctx.font = '700 26px Sora, Inter, sans-serif';
    ctx.fillText(`0${idx + 1}`, 144, cursorY + 26);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '500 26px Inter, sans-serif';
    lines.forEach((line, lIdx) => {
      ctx.fillText(line, 206, cursorY + 24 + lIdx * 36);
    });
    cursorY += boxH + 24;
  });

  // Footer attribution
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '500 22px Inter, sans-serif';
  ctx.fillText(spec.attribution, 112, spec.height - 112);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not encode Share Air Card PNG'));
    }, 'image/png');
  });
}

/**
 * Lazy-callable share flow: renders 1080x1350 Air Card PNG and triggers Web Share API
 * with automatic PNG download fallback.
 */
export async function shareOrDownloadAirCard(
  spec: ShareCardSpec
): Promise<'shared' | 'downloaded'> {
  const blob = await renderShareCardBlob(spec);
  const slug = spec.cityTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const filename = `vayumitra-${slug}-${spec.aqi}.png`;
  const file = new File([blob], filename, { type: 'image/png' });

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        title: `VayuMitra · ${spec.cityTitle}`,
        text: spec.altText,
        files: [file],
      });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'shared';
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  return 'downloaded';
}
