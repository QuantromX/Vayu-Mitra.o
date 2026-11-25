import { z } from 'zod';
import { APP_CONFIG, INDIA_BOUNDS } from '../config.ts';
import { evaluateMaskRule } from '../naqi/naqi.ts';
import {
  CATEGORY_HINDI,
  MEDICAL_DISCLAIMER,
  formatDayLabel,
  formatWindowLabel,
  isPoorOrWorseCategory,
  isWithinIndiaBounds,
} from '../shared/domain.ts';
import type {
  AdviceResponse,
  HourWindow,
  HouseholdGroup,
  Language,
  LifestyleMode,
  NaqiCategory,
} from '../../types/index.ts';

export const NaqiCategorySchema = z.enum([
  'Good',
  'Satisfactory',
  'Moderate',
  'Poor',
  'Very Poor',
  'Severe',
]);

export const AdviceActionSchema = z
  .object({
    action: z.string().min(4).max(320),
    why: z.string().min(8).max(480),
    timeWindow: z.string().min(2).max(100).optional(),
  })
  .strict();

export const RoutineActionSchema = z
  .object({
    action: z.string().min(4).max(320),
    why: z.string().min(8).max(480),
    co2Benefit: z.string().min(2).max(200).optional(),
  })
  .strict();

export const GeminiAdvicePayloadSchema = z
  .object({
    verdict: z
      .object({
        level: NaqiCategorySchema,
        headline: z.string().min(4).max(180),
        summary: z.string().min(10).max(480),
      })
      .strict(),
    outdoor: z.array(AdviceActionSchema).min(1).max(4),
    indoor: z.array(AdviceActionSchema).min(1).max(6),
    routine: z.array(RoutineActionSchema).min(1).max(4),
    mask: z
      .object({
        recommended: z.boolean(),
        type: z.string().min(2).max(140),
        why: z.string().min(8).max(480),
      })
      .strict(),
    forWhom: z
      .array(
        z
          .object({
            group: z.string().min(2).max(100),
            advice: z.string().min(8).max(380),
          })
          .strict()
      )
      .min(1)
      .max(6),
  })
  .strict();

const WindowSchema = z
  .object({
    startHour: z.string().max(16),
    endHour: z.string().max(16),
    dayLabel: z.enum(['Today', 'Tomorrow']),
    endDayLabel: z.enum(['Today', 'Tomorrow']).optional(),
    avgNaqi: z.number().min(0).max(500),
    avgPm25: z.number().min(0).max(2000),
  })
  .strict();

/**
 * Restricts city names to Unicode letters, combining marks, digits, spaces, and common punctuation.
 */
export const CITY_NAME_REGEX = /^[\p{L}\p{M}0-9\s.,'()-]+$/u;

export const AdviceRequestSchema = z
  .object({
    cityName: z
      .string()
      .trim()
      .min(1, 'City name is required')
      .max(
        APP_CONFIG.maxCityNameLength,
        `City name must be ${APP_CONFIG.maxCityNameLength} characters or fewer`
      )
      .regex(CITY_NAME_REGEX, 'City name contains unsupported characters'),
    latitude: z
      .number()
      .min(INDIA_BOUNDS.minLat, 'Latitude must be within India bounds')
      .max(INDIA_BOUNDS.maxLat, 'Latitude must be within India bounds')
      .optional(),
    longitude: z
      .number()
      .min(INDIA_BOUNDS.minLon, 'Longitude must be within India bounds')
      .max(INDIA_BOUNDS.maxLon, 'Longitude must be within India bounds')
      .optional(),
    aqi: z.number().min(0).max(500),
    category: NaqiCategorySchema,
    dominantPollutant: z.enum(['PM2.5', 'PM10']),
    pm25: z.number().min(0).max(2000),
    pm10: z.number().min(0).max(3000),
    basis: z.enum(['rolling_24h', 'current']),
    temperatureC: z.number().min(-30).max(65),
    humidityPct: z.number().min(0).max(100),
    windSpeedKmh: z.number().min(0).max(250),
    cleanestWindow: WindowSchema.nullable(),
    worstWindow: WindowSchema.nullable(),
    household: z
      .array(z.enum(['kids', 'seniors', 'pregnant', 'asthma_heart', 'outdoor_worker']))
      .max(5),
    lifestyle: z.enum([
      'wfh',
      'commute_bike',
      'commute_car',
      'commute_metro',
      'commute_bus',
      'runner_walker',
    ]),
    hasPurifier: z.boolean(),
    language: z.enum(['en', 'hi']),
  })
  .strict()
  .refine(
    (data) => {
      if (data.latitude === undefined && data.longitude === undefined) {
        return true;
      }
      if (data.latitude !== undefined && data.longitude !== undefined) {
        return isWithinIndiaBounds(data.latitude, data.longitude);
      }
      return false;
    },
    {
      message: 'Both latitude and longitude must be provided within India bounds',
      path: ['latitude'],
    }
  );

export type ValidatedAdviceRequest = z.infer<typeof AdviceRequestSchema>;
export type ValidatedGeminiPayload = z.infer<typeof GeminiAdvicePayloadSchema>;

/**
 * Deterministic rule-based fallback advice builder implementing strict mask rules,
 * forward-looking Today/Tomorrow windows, rich indoor guidance, lifestyle-specific routines
 * with approx. stated CO2 assumptions, and no "clean air" wording unless NAQI is Good.
 */
export function buildFallbackAdvice(input: {
  cityName: string;
  aqi: number;
  category: NaqiCategory;
  dominantPollutant: 'PM2.5' | 'PM10';
  pm25: number;
  pm10: number;
  windSpeedKmh: number;
  cleanestWindow: Pick<
    HourWindow,
    'startHour' | 'endHour' | 'dayLabel' | 'avgNaqi'
  > | null;
  worstWindow: Pick<HourWindow, 'startHour' | 'endHour' | 'dayLabel' | 'avgNaqi'> | null;
  household: HouseholdGroup[];
  lifestyle: LifestyleMode;
  hasPurifier: boolean;
  language: Language;
}): AdviceResponse {
  const hi = input.language === 'hi';
  const isGood = input.category === 'Good';
  const isPoorOrWorse = isPoorOrWorseCategory(input.category);

  const cleanWindowLabel = formatWindowLabel(
    input.cleanestWindow,
    input.language,
    'next lower-pollution afternoon window',
    'अगला कम प्रदूषण वाला समय'
  );
  const worstWindowLabel = formatWindowLabel(
    input.worstWindow,
    input.language,
    'peak haze hours ahead',
    'आगामी अधिकतम धुंध समय'
  );

  const maskRule = evaluateMaskRule(input.category, input.household);

  // Actionable verdict headline (never duplicates "City: NAQI x (Category)")
  const headline = isGood
    ? hi
      ? `${input.cityName} में आज बाहरी गतिविधियों के लिए अनुकूल हवा`
      : `Favourable outdoor air across ${input.cityName}`
    : isPoorOrWorse
      ? hi
        ? `${input.cityName} में बाहरी समय सीमित रखें; ${cleanWindowLabel} बेहतर रहेगा`
        : `Cut outdoor exertion; shift errands to ${cleanWindowLabel}`
      : hi
        ? `${input.cityName} में संवेदनशील लोग सावधानी बरतें; ${cleanWindowLabel} चुनें`
        : `Pace outdoor exposure and prefer ${cleanWindowLabel}`;

  const airDescriptorEn = isGood ? 'clean air' : 'lowest-particulate window';
  const airDescriptorHi = isGood ? 'स्वच्छ हवा' : 'सबसे कम प्रदूषण वाला समय';

  const summary = hi
    ? `${input.cityName} में अभी ${input.dominantPollutant} मुख्य प्रदूषक है (PM2.5: ${input.pm25} µg/m³, PM10: ${input.pm10} µg/m³)। आगे के 24 घंटों में ${airDescriptorHi} ${cleanWindowLabel} (औसत NAQI ~${input.cleanestWindow?.avgNaqi ?? input.aqi}) और अधिकतम धुंध ${worstWindowLabel} रहने का अनुमान है।`
    : `${input.dominantPollutant} leads particulate readings right now (PM2.5: ${input.pm25} µg/m³, PM10: ${input.pm10} µg/m³). Over the next 24 hours, the ${airDescriptorEn} is ${cleanWindowLabel} (avg NAQI ~${input.cleanestWindow?.avgNaqi ?? input.aqi}) while peak buildup occurs during ${worstWindowLabel}.`;

  // Outdoor
  const outdoor = [
    {
      action: isPoorOrWorse
        ? hi
          ? `केवल ज़रूरी बाहरी काम ${cleanWindowLabel} में करें और तेज दौड़ या भारी व्यायाम टालें।`
          : `Confine essential outdoor errands to ${cleanWindowLabel} and avoid vigorous exercise outdoors.`
        : hi
          ? `सैर, खरीदारी या बाहरी काम ${cleanWindowLabel} में तय करें।`
          : `Plan outdoor walks, play, or errands during ${cleanWindowLabel}.`,
      why: hi
        ? `इस समय में अन्य घंटों की तुलना में कण स्तर सबसे कम (${input.cleanestWindow ? `${formatDayLabel(input.cleanestWindow.dayLabel, 'hi')} ~${input.cleanestWindow.avgNaqi} NAQI` : 'न्यूनतम'}) रहने का अनुमान है।`
        : `Forward hourly readings show lower particulate density during ${cleanWindowLabel} than in surrounding hours.`,
      timeWindow: cleanWindowLabel,
    },
    {
      action:
        input.lifestyle === 'runner_walker' && isPoorOrWorse
          ? hi
            ? 'बाहरी दौड़ के बजाय घर के अंदर योग या हल्की कसरत करें।'
            : 'Move daily running or brisk walks indoors today instead of exercising along roads.'
          : hi
            ? `${worstWindowLabel} के दौरान मुख्य सड़कों और भीड़भाड़ वाले चौराहों से बचें।`
            : `Avoid arterial roads and construction zones during ${worstWindowLabel}.`,
      why: hi
        ? `ऊँचे PM2.5 (${input.pm25} µg/m³) और ${worstWindowLabel} के ठहराव में तेज साँस लेने से कण फेफड़ों में गहराई तक जाते हैं।`
        : `Elevated breathing rates pull fine PM2.5 (${input.pm25} µg/m³) deeper into airways during stagnant peak hours.`,
      timeWindow: worstWindowLabel,
    },
  ];

  // Indoor (always includes purifier/sealed-room guidance, ventilation timing, cooking/exhaust, damp mopping, no incense/coils when Poor+, honest plants note)
  const indoor = [
    {
      action: input.hasPurifier
        ? hi
          ? `एयर प्यूरीफायर को बिस्तर या बैठने की जगह से 1–2 मीटर दूरी पर, दीवारों से दूर रखें; ${worstWindowLabel} में दरवाज़े-खिड़की बंद करके इसे हाई मोड पर चलाएँ।`
          : `Place your HEPA purifier 1–2 m from beds or seating with clear airflow around vents, and run it on high during ${worstWindowLabel} with doors/windows shut.`
        : hi
          ? `घर का एक मुख्य कमरा कम से कम दरवाज़े खोलकर अपेक्षाकृत बंद रखें; यदि संभव हो तो पोर्टेबल HEPA प्यूरीफायर या बॉक्स-फैन DIY HEPA फ़िल्टर अपनाएँ।`
          : `Keep one main bedroom sealed as a lower-particle zone with door gaps covered; if possible, use a compact HEPA purifier or DIY MERV/HEPA fan filter.`,
      why: input.hasPurifier
        ? hi
          ? 'दीवार से हटकर रखने और पीक घंटों में हाई स्पीड पर चलाने से कमरे की हवा जल्दी फिल्टर होती है।'
          : 'Unobstructed airflow and high fan speed during peak outdoor hours reduce indoor PM2.5 infiltration fastest.'
        : hi
          ? 'एक कमरा बंद रखने से परिवार के संवेदनशील सदस्यों के लिए कम-कण वाला सुरक्षित क्षेत्र बनता है।'
          : 'Limiting outside leakage in one primary room noticeably lowers cumulative overnight particle exposure.',
      timeWindow: worstWindowLabel,
    },
    {
      action: hi
        ? `खिड़कियाँ केवल ${cleanWindowLabel} में 15–20 मिनट क्रॉस-वेंटिलेशन के लिए खोलें; खाना बनाते समय रसोई का एग्ज़ॉस्ट फैन या चिमनी अवश्य चलाएँ।`
        : `Open windows briefly for 15–20 minutes only during ${cleanWindowLabel} for cross-ventilation, and always run the kitchen exhaust fan while cooking or frying.`,
      why: hi
        ? `हवा की गति ${input.windSpeedKmh} km/h पर छोटे समय की वेंटिलेशन से रसोई का धुआँ और CO₂ बाहर निकलते हैं।`
        : `Brief airing during the lowest-particulate window clears indoor CO₂ and cooking aerosols without flooding rooms with peak outdoor smog.`,
      timeWindow: cleanWindowLabel,
    },
    {
      action: isPoorOrWorse
        ? hi
          ? 'आज अगरबत्ती, धूप या मच्छर भगाने वाली कॉइल न जलाएँ, सूखी झाड़ू के बजाय गीला पोछा लगाएँ, और ध्यान रखें कि इनडोर पौधे केवल मामूली मदद करते हैं (प्यूरीफायर या वेंटिलेशन का विकल्प नहीं हैं)।'
          : 'Skip incense sticks and mosquito coils while NAQI is Poor or worse, damp-mop instead of dry sweeping, and note that indoor plants help only marginally—never as a substitute for purifiers or ventilation.'
        : hi
          ? 'धूल उड़ने से बचाने के लिए गीला पोछा लगाएँ; ध्यान रखें कि इनडोर पौधे केवल मामूली सहयोग करते हैं और वेंटिलेशन का विकल्प नहीं हैं।'
          : 'Damp-mop floors to trap settled PM10 dust, and remember that houseplants remove particles only marginally and cannot replace ventilation or purifiers.',
      why: hi
        ? 'अगरबत्ती, कॉइल और सूखी झाड़ू घर के अंदर PM2.5 व PM10 को तेज़ी से बढ़ाते हैं, जबकि पौधों की अवशोषण क्षमता कमरे के स्तर पर बहुत सीमित होती है।'
        : 'Indoor combustion (incense, coils) and dry sweeping spike indoor PM2.5/PM10 sharply, whereas foliage filters particulates too slowly to clean room air on its own.',
    },
  ];

  // Routine (depends on lifestyle + NAQI + trip-batching + approx. CO2 with stated assumption)
  const routine = buildRoutineItems({
    lifestyle: input.lifestyle,
    isPoorOrWorse,
    cleanWindowLabel,
    worstWindowLabel,
    hi,
  });

  const categoryDisplay = hi ? CATEGORY_HINDI[input.category] : input.category;

  // Mask
  const mask = {
    recommended: maskRule.recommended,
    type: maskRule.type,
    why:
      maskRule.scope === 'optional'
        ? hi
          ? `वायु सूचकांक ${input.aqi} (${categoryDisplay}) होने से सामान्य लोगों के लिए मास्क वैकल्पिक है; फिर भी धूल भरी सड़क पर संवेदनशील लोग N95/FFP2 रख सकते हैं।`
          : `At NAQI ${input.aqi} (${input.category}), masks are optional for most people; sensitive individuals may still carry one along dusty roads.`
        : maskRule.scope === 'sensitive_only'
          ? hi
            ? `मध्यम श्रेणी (सूचकांक ${input.aqi}) में बच्चों, वरिष्ठ नागरिकों, अस्थमा/हृदय रोगियों और बाहरी कामगारों के लिए अच्छी तरह फिट N95/FFP2 मास्क जरूरी है, जबकि स्वस्थ वयस्कों के लिए वैकल्पिक है।`
            : `In Moderate air (NAQI ${input.aqi}), a snug N95/FFP2 mask is recommended for children, seniors, asthma/heart patients, and outdoor workers, and optional for healthy adults.`
          : hi
            ? `खराब या अधिक स्तर (सूचकांक ${input.aqi}) पर बाहर निकलने वाले हर व्यक्ति को सील वाला N95/FFP2 मास्क पहनना चाहिए, क्योंकि कपड़े के मास्क PM2.5 (${input.pm25} µg/m³) को नहीं रोकते।`
            : `At Poor or worse levels (NAQI ${input.aqi}), everyone stepping outdoors needs a well-fitted N95/FFP2 respirator because cloth and surgical masks fail to seal against fine PM2.5 (${input.pm25} µg/m³).`,
  };

  // For Whom
  const forWhomList = input.household.length
    ? input.household.map((group) => {
        if (group === 'kids') {
          return {
            group: hi ? 'बच्चे' : 'Children',
            advice: isPoorOrWorse
              ? hi
                ? `स्कूल के बाद का खेल घर के अंदर रखें और पानी नियमित पिलाएँ; केवल ज़रूरी होने पर ${cleanWindowLabel} में बाहर जाएँ।`
                : `Keep after-school play indoors today, hydrate steadily, and restrict essential outdoor trips to ${cleanWindowLabel}.`
              : hi
                ? `पार्क या बाहरी खेल ${cleanWindowLabel} में सीमित रखें।`
                : `Time park play during ${cleanWindowLabel}.`,
          };
        }
        if (group === 'seniors') {
          return {
            group: hi ? 'वरिष्ठ नागरिक' : 'Seniors',
            advice: hi
              ? `${worstWindowLabel} में बाहरी सैर टालें; हल्की गतिविधि ${cleanWindowLabel} में या घर के अंदर करें।`
              : `Skip walks during ${worstWindowLabel}; prefer gentle indoor movement or a brief stroll in ${cleanWindowLabel}.`,
          };
        }
        if (group === 'pregnant') {
          return {
            group: hi ? 'गर्भवती महिलाएँ' : 'Pregnancy',
            advice: hi
              ? 'रसोई के धुएँ और ट्रैफिक धुंध से दूरी रखें; बाहर यात्रा करनी हो तो अच्छी फिटिंग वाला N95 पहनें।'
              : 'Stay clear of cooking smoke and roadside exhaust; wear a snug N95 if travelling during elevated haze.',
          };
        }
        if (group === 'asthma_heart') {
          return {
            group: hi ? 'अस्थमा / हृदय देखभाल' : 'Asthma / Heart Care',
            advice: hi
              ? 'निर्धारित रिलीवर इनहेलर पास रखें, पीक घंटों में बाहर न निकलें और नियमित दवा समय पर लें।'
              : 'Keep your prescribed reliever inhaler accessible, avoid peak-haze hours outdoors, and maintain regular medication.',
          };
        }
        return {
          group: hi ? 'बाहरी कामगार' : 'Outdoor Workers',
          advice: hi
            ? `काम के दौरान सील वाला N95/FFP2 मास्क पहनें, भारी काम ${cleanWindowLabel} में करने की कोशिश करें और ट्रैफिक से दूर छोटे ब्रेक लें।`
            : `Wear a snug N95/FFP2 throughout shifts, schedule heavier tasks near ${cleanWindowLabel} when feasible, and take breaks away from traffic.`,
        };
      })
    : [
        {
          group: hi ? 'सामान्य परिवार' : 'General Household',
          advice: hi
            ? `बाहरी काम ${cleanWindowLabel} में निपटाएँ और ${worstWindowLabel} में घर के अंदर रहें।`
            : `Batch outdoor errands into ${cleanWindowLabel} and stay indoors during ${worstWindowLabel}.`,
        },
      ];

  return {
    verdict: {
      level: input.category,
      headline,
      summary,
    },
    outdoor,
    indoor,
    routine,
    mask,
    forWhom: forWhomList,
    disclaimer: MEDICAL_DISCLAIMER[input.language],
    source: 'fallback',
  };
}

function buildRoutineItems(params: {
  lifestyle: LifestyleMode;
  isPoorOrWorse: boolean;
  cleanWindowLabel: string;
  worstWindowLabel: string;
  hi: boolean;
}) {
  const { lifestyle, isPoorOrWorse, cleanWindowLabel, worstWindowLabel, hi } = params;

  const tripBatchItem = {
    action: hi
      ? `अनावश्यक छोटे चक्कर अलग-अलग न लगाकर सभी काम एक साथ ${cleanWindowLabel} में निपटाएँ और ${worstWindowLabel} में सड़क यात्रा टालें।`
      : `Batch errands into one trip during ${cleanWindowLabel} and avoid non-essential road travel during ${worstWindowLabel}.`,
    why: hi
      ? 'यात्राएँ समेटने से सड़क पर आपका व्यक्तिगत धुंध संपर्क घटता है और बार-बार कोल्ड-स्टार्ट वाहन उत्सर्जन भी बचता है।'
      : 'Combining trips cuts both your personal exposure minutes and repeated cold-start tailpipe emissions.',
  };

  if (lifestyle === 'commute_car') {
    return [
      {
        action: hi
          ? `संभव हो तो आज कार की जगह मेट्रो, बस या कारपूल अपनाएँ; कार में री-सर्कुलेशन मोड ऑन रखें।`
          : `Swap solo car trips for metro, bus, or carpooling today; if driving, switch cabin AC to recirculate mode.`,
        why: hi
          ? 'एक व्यक्ति की कार यात्रा घटाने से सड़क किनारे PM2.5 और टेलपाइप उत्सर्जन दोनों कम होते हैं।'
          : 'Moving one 10 km solo car commute onto metro or a shared ride reduces local roadside exhaust immediately.',
        co2Benefit: hi
          ? 'लगभग 1.4 kg CO₂ बचत (मान्यता: 10 km कार 170 g/km बनाम मेट्रो 30 g/km)'
          : 'Approx. 1.4 kg CO₂ saved (assumes 10 km solo car at 170 g/km vs metro at 30 g/km)',
      },
      tripBatchItem,
    ];
  }

  if (lifestyle === 'commute_bike') {
    return [
      {
        action: isPoorOrWorse
          ? hi
            ? `बाइक/स्कूटर की जगह आज संभव हो तो मेट्रो या बस लें; दोपहिया चलाने पर हेलमेट वाइज़र के नीचे N95 मास्क अवश्य लगाएँ।`
            : `Switch from two-wheeler to metro or bus today if routes allow; if riding, wear a snug N95 beneath a closed visor.`
          : hi
            ? `दोपहिया यात्रा ${cleanWindowLabel} के आसपास रखें और मुख्य धुएँ वाली लेन से बचें।`
            : `Time two-wheeler rides closer to ${cleanWindowLabel} and avoid idling behind diesel vehicles.`,
        why: hi
          ? 'खुले दोपहिया पर सवारी करते समय यात्री सीधे वाहन धुएँ और सड़क धूल के सबसे करीब होते हैं।'
          : 'Two-wheeler riders breathe concentrated roadside exhaust and re-suspended road dust directly at tailpipe height.',
      },
      tripBatchItem,
    ];
  }

  if (lifestyle === 'commute_metro' || lifestyle === 'commute_bus') {
    return [
      {
        action: hi
          ? `मेट्रो या बस से यात्रा जारी रखें और स्टेशन तक पैदल हिस्सा ${cleanWindowLabel} में या मास्क के साथ तय करें।`
          : `Stick with metro or bus transit today and cover walking last-mile stretches during ${cleanWindowLabel} or with an N95 when Poor+.`,
        why: hi
          ? 'सामूहिक परिवहन प्रति यात्री उत्सर्जन को कार या दोपहिया की तुलना में काफी कम रखता है।'
          : 'Mass transit keeps per-passenger road emissions far lower than private vehicles on congested corridors.',
        co2Benefit: hi
          ? 'लगभग 1.4 kg CO₂ बचत (मान्यता: 10 km कार 170 g/km बनाम मेट्रो 30 g/km)'
          : 'Approx. 1.4 kg CO₂ avoided vs solo car (assumes 10 km car at 170 g/km vs metro 30 g/km)',
      },
      tripBatchItem,
    ];
  }

  if (lifestyle === 'wfh') {
    return [
      {
        action: hi
          ? `घर से काम करते हुए बाहरी खरीदारी व बैंक काम ${cleanWindowLabel} में एक ही चक्कर में निपटाएँ।`
          : `Stay home through ${worstWindowLabel} and group any groceries or errands into one outing during ${cleanWindowLabel}.`,
        why: hi
          ? 'घर से काम करने से दैनिक सड़क यात्रा उत्सर्जन शून्य रहता है और आप पीक धुंध के घंटों से पूरी तरह बच सकते हैं।'
          : 'Working from home eliminates peak-hour road exposure and avoids an additional daily commute.',
        co2Benefit: hi
          ? 'लगभग 1.7 kg CO₂ बचत (मान्यता: 10 km दैनिक कार यात्रा टालने पर 170 g/km)'
          : 'Approx. 1.7 kg CO₂ avoided (assumes skipping a 10 km car commute at 170 g/km)',
      },
      tripBatchItem,
    ];
  }

  // runner_walker
  return [
    {
      action: isPoorOrWorse
        ? hi
          ? `बाहरी दौड़ आज इनडोर वर्कआउट में बदलें या हल्की सैर केवल ${cleanWindowLabel} में पार्क के भीतर करें।`
          : `Swap outdoor running for indoor training today, or keep a gentle walk strictly inside green parks during ${cleanWindowLabel}.`
        : hi
          ? `अपनी दैनिक सैर/दौड़ ${cleanWindowLabel} में रखें और भारी ट्रैफिक सड़कों से दूर हरे रास्तों को चुनें।`
          : `Schedule your daily walk or run during ${cleanWindowLabel} along tree-lined paths away from traffic.`,
      why: hi
        ? 'दौड़ते समय सामान्य से 3–5 गुना अधिक हवा फेफड़ों में जाती है, इसलिए समय और मार्ग चुनना बेहद जरूरी है।'
        : 'Running increases minute ventilation 3–5×, making timing and distance from traffic critical for airway protection.',
    },
    tripBatchItem,
  ];
}
