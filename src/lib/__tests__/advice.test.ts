import { describe, expect, it } from 'vitest';
import {
  AdviceRequestSchema,
  GeminiAdvicePayloadSchema,
  buildFallbackAdvice,
} from '../advice/schema.ts';

describe('Advice Zod Schemas & Deterministic Fallback', () => {
  it('validates a compliant Gemini structured advice payload', () => {
    const valid = {
      verdict: {
        level: 'Poor',
        headline: 'Cut outdoor exertion; shift errands to Today 14:00–17:00',
        summary:
          'Fine particulate levels are elevated today; schedule errands in the afternoon.',
      },
      outdoor: [
        {
          action: 'Shift outdoor errands to Today 14:00–17:00.',
          why: 'Afternoon mixing reduces ground-level PM2.5 buildup compared to morning peaks.',
          timeWindow: 'Today 14:00–17:00',
        },
      ],
      indoor: [
        {
          action: 'Keep windows closed during morning traffic and wet-mop floors.',
          why: 'Wet mopping prevents settled PM10 particles from re-entering room air.',
        },
      ],
      routine: [
        {
          action: 'Use the metro instead of a car for today’s commute.',
          why: 'Public transit avoids roadside tailpipe congestion and reduces personal exposure.',
          co2Benefit:
            'Approx. 1.4 kg CO₂ saved (assumes 10 km car at 170 g/km vs metro at 30 g/km)',
        },
      ],
      mask: {
        recommended: true,
        type: 'N95 / FFP2',
        why: 'Only a sealed N95 filter blocks fine PM2.5 particles effectively.',
      },
      forWhom: [
        {
          group: 'Children',
          advice: 'Keep evening play indoors today and encourage steady hydration.',
        },
      ],
    };

    const parsed = GeminiAdvicePayloadSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid advice payloads missing required fields or invalid categories', () => {
    const invalid = {
      verdict: {
        level: 'Hazardous', // invalid India NAQI category
        headline: 'Bad',
        summary: 'Short',
      },
      outdoor: [],
      indoor: [],
      routine: [],
      mask: { recommended: true, type: 'N95', why: 'ok' },
      forWhom: [],
    };

    const parsed = GeminiAdvicePayloadSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('validates /api/advice request payloads with Today/Tomorrow windows and rejects invalid inputs', () => {
    const req = AdviceRequestSchema.safeParse({
      cityName: 'Lucknow',
      aqi: 220,
      category: 'Poor',
      dominantPollutant: 'PM2.5',
      pm25: 96,
      pm10: 140,
      basis: 'rolling_24h',
      temperatureC: 24,
      humidityPct: 58,
      windSpeedKmh: 7,
      cleanestWindow: {
        startHour: '14:00',
        endHour: '17:00',
        dayLabel: 'Today',
        endDayLabel: 'Today',
        avgNaqi: 160,
        avgPm25: 78,
      },
      worstWindow: {
        startHour: '07:00',
        endHour: '10:00',
        dayLabel: 'Tomorrow',
        endDayLabel: 'Tomorrow',
        avgNaqi: 265,
        avgPm25: 109,
      },
      household: ['seniors'],
      lifestyle: 'wfh',
      hasPurifier: true,
      language: 'en',
    });
    expect(req.success).toBe(true);

    const badReq = AdviceRequestSchema.safeParse({
      cityName: '',
      aqi: 999,
    });
    expect(badReq.success).toBe(false);
  });

  it('builds deterministic bilingual fallback advice following accuracy, indoor, routine, and mask rules', () => {
    const baseInput = {
      cityName: 'Patna',
      aqi: 315,
      category: 'Very Poor' as const,
      dominantPollutant: 'PM2.5' as const,
      pm25: 140,
      pm10: 210,
      windSpeedKmh: 6,
      cleanestWindow: {
        startHour: '13:00',
        endHour: '16:00',
        dayLabel: 'Tomorrow' as const,
        avgNaqi: 240,
      },
      worstWindow: {
        startHour: '20:00',
        endHour: '23:00',
        dayLabel: 'Today' as const,
        avgNaqi: 350,
      },
      household: ['outdoor_worker' as const, 'kids' as const],
      lifestyle: 'commute_car' as const,
      hasPurifier: false,
    };

    const enAdvice = buildFallbackAdvice({ ...baseInput, language: 'en' });
    expect(enAdvice.source).toBe('fallback');
    expect(enAdvice.verdict.headline).not.toMatch(/Patna:\s*NAQI\s*315/i);
    expect(enAdvice.mask.recommended).toBe(true);
    expect(enAdvice.mask.type).toBe('N95 / FFP2');
    expect(enAdvice.forWhom).toHaveLength(2);
    // Never say "clean air" when category !== 'Good'
    expect(JSON.stringify(enAdvice).toLowerCase()).not.toContain('clean air');
    // Indoor guidance covers sealed room, cooking/exhaust, damp-mop, no incense/coils, and plants caveat
    const indoorText = enAdvice.indoor
      .map((i) => `${i.action} ${i.why}`)
      .join(' ')
      .toLowerCase();
    expect(indoorText).toContain('sealed');
    expect(indoorText).toContain('exhaust');
    expect(indoorText).toContain('incense');
    expect(indoorText).toContain('damp-mop');
    expect(indoorText).toContain('marginally');
    // Routine includes approx. CO2 assumption for car commute
    expect(enAdvice.routine[0]?.co2Benefit?.toLowerCase()).toContain('approx.');
    const { source: _enSource, disclaimer: _enDisclaimer, ...enGeminiShape } = enAdvice;
    expect(GeminiAdvicePayloadSchema.safeParse(enGeminiShape).success).toBe(true);

    // Moderate mask rule: false for no sensitive group, true when senior present
    const moderateAdult = buildFallbackAdvice({
      ...baseInput,
      aqi: 140,
      category: 'Moderate',
      household: [],
      language: 'en',
    });
    expect(moderateAdult.mask.recommended).toBe(false);

    const moderateSenior = buildFallbackAdvice({
      ...baseInput,
      aqi: 140,
      category: 'Moderate',
      household: ['seniors'],
      language: 'en',
    });
    expect(moderateSenior.mask.recommended).toBe(true);

    // Hindi translation check
    const hiAdvice = buildFallbackAdvice({ ...baseInput, language: 'hi' });
    expect(hiAdvice.source).toBe('fallback');
    expect(hiAdvice.verdict.summary).toContain('Patna');
    expect(hiAdvice.disclaimer).toContain('चिकित्सीय निदान');
    const { source: _hiSource, disclaimer: _hiDisclaimer, ...hiGeminiShape } = hiAdvice;
    expect(GeminiAdvicePayloadSchema.safeParse(hiGeminiShape).success).toBe(true);
  });
});
