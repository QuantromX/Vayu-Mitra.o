# Prompt Design, Injection Defenses & Structured JSON Schemas

All Gemini calls run strictly on the Express backend (`server.ts`) using `gemini-4-hydrogen` (`ThinkingLevel.LOW`, `seed: 42`) with `gemini-3.1-flash-lite` automatic quota cooldown failover and `AbortController` timeout (`APP_CONFIG.geminiTimeoutMs`). Every response enforces `responseMimeType: 'application/json'`, a strict `responseSchema`, and secondary server-side `.strict()` **Zod** parsing before reaching the client.

---

## Prompt-Injection Defense Architecture

1. **Delimited Untrusted Data**: All user-controlled strings (`cityName`, `question`, `sceneContext`) pass through `sanitizeUserText()` (control-character & angle-bracket stripping, bounded length) and are wrapped in `<untrusted_input name="...">...</untrusted_input>` delimiters before entering user prompts.
2. **System Instruction Isolation**: Every system prompt (`buildAdviceSystemInstruction`, `buildAskSystemInstruction`, `buildPhotoCheckSystemInstruction`) explicitly directs Gemini to treat `<untrusted_input>` strictly as external data and ignore any directives inside user fields asking to change roles, leak system prompts, bypass medical/factual guardrails, or alter JSON schema structure.
3. **Output Guardrails**:
   - Strict server-side `.strict()` Zod validation drops any malformed or extra-field response and retries once or degrades cleanly to deterministic bilingual rule-based fallbacks.
   - Ground-truth `verdict.level` on `/api/advice` is pinned server-side to the computed India NAQI `payload.category`.
   - Zero raw HTML rendering in the browser (`dangerouslySetInnerHTML` never used).

---

## 1. Personalized Action Plan (`POST /api/advice`)

### System Instruction Rules
- Language enforcement (`en`: Indian English; `hi`: natural Hindi keeping units `µg/m³`, `km/h`, `°C`, `kg CO₂`, `N95 / FFP2` and place names clear).
- **Clean-Air Guardrail**: When `category !== 'Good'`, Gemini is strictly forbidden from using `"clean air"` anywhere—only `"lower-pollution window"`, `"fresher hours"`, or `"less-polluted period"`.
- **Grounded Facts Only**: Must use only supplied live Open-Meteo metrics, forward `Today`/`Tomorrow` windows, weather, and `householdProfile`. No invented measurements or medical diagnosis.
- **Mask Rule**:
  - `Good` / `Satisfactory`: optional
  - `Moderate`: N95 / FFP2 recommended for kids, seniors, asthma/heart patients, and outdoor workers; optional for others
  - `Poor` / `Very Poor` / `Severe`: N95 / FFP2 recommended for everyone outdoors
- **Indoor Coverage**: Purifier placement & peak-hour high mode (or single sealed room + low-cost HEPA options if no purifier), brief window timing, cooking exhaust fan, no incense/mosquito coils when Poor+, damp mopping, and honest note that houseplants help only marginally.
- **Routine Coverage**: Depends on `lifestyle` + NAQI, includes trip-batching with `Today`/`Tomorrow` windows, and cites CO₂ savings only with an explicit stated assumption labeled `"approx."`.

### Response Schema (`ADVICE_RESPONSE_SCHEMA` / `GeminiAdvicePayloadSchema`)
```json
{
  "verdict": {
    "level": "Good | Satisfactory | Moderate | Poor | Very Poor | Severe",
    "headline": "string (4..180)",
    "summary": "string (10..480)"
  },
  "outdoor": [{ "action": "string", "why": "string", "timeWindow?": "string" }],
  "indoor": [{ "action": "string", "why": "string", "timeWindow?": "string" }],
  "routine": [{ "action": "string", "why": "string", "co2Benefit?": "string" }],
  "mask": { "recommended": "boolean", "type": "string", "why": "string" },
  "forWhom": [{ "group": "string", "advice": "string" }]
}
```

---

## 2. Ask VayuMitra Q&A (`POST /api/ask`)

### System Instruction Rules
- Enforces `question` length `2..300` chars wrapped in `<untrusted_input name="question">`.
- Uses ONLY supplied live NAQI, PM2.5, PM10, weather, next-12h `forwardHourly`, `cleanestWindow`, `worstWindow`, and `householdProfile`.
- Prohibits invented metrics or clinical diagnoses, enforces the `"clean air"` ban when NAQI != Good, requires explicit metric citations in `dataUsed`, and populates `bestTime` strictly from forward windows when timing applies.

### Response Schema (`ASK_RESPONSE_SCHEMA` / `AskGeminiPayloadSchema`)
```json
{
  "answer": "string (8..480)",
  "verdict": "yes | no | caution",
  "why": "string (10..480)",
  "bestTime?": "string (2..120)",
  "dataUsed": ["string (1..6 items)"]
}
```

---

## 3. Photo Check Vision (`POST /api/photo-check`)

### System Instruction Rules
- Inspects locally EXIF-stripped, magic-byte-verified room or outdoor sky images (`jpeg` / `png` / `webp`, `<= 4 MB`) alongside `<untrusted_input name="sceneContext">`.
- Describes only visible airflow/window openings, smoke/dust cues, purifier clearances, or sky visibility contrast.
- Strictly forbidden from claiming exact PM2.5/PM10/AQI readings from a photo; always outputs a visual advisory disclaimer and calibrated `confidence` (`low | medium | high`).

### Response Schema (`PHOTO_CHECK_RESPONSE_SCHEMA` / `PhotoCheckGeminiPayloadSchema`)
```json
{
  "observations": ["string (1..6 items)"],
  "purifierPlacement": "string (8..400)",
  "ventilationTip": "string (8..400)",
  "confidence": "low | medium | high",
  "disclaimer": "string (10..300)"
}
```
