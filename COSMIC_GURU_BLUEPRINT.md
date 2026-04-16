# Cosmic Guru — Technical Blueprint
## AI-Powered Spiritual Horoscope SaaS

> **Purpose of this document:** Hand this to Claude Code CLI as the complete specification to build the Cosmic Guru app on top of the existing `auto-doc` Next.js codebase.

---

## Table of Contents

1. [Vision & Product Summary](#1-vision--product-summary)
2. [Existing Codebase Foundation](#2-existing-codebase-foundation)
3. [Tech Stack (Additions & Changes)](#3-tech-stack-additions--changes)
4. [External APIs & Knowledge Sources](#4-external-apis--knowledge-sources)
5. [OpenRouter Model Routing Strategy](#5-openrouter-model-routing-strategy)
6. [Database Schema Extensions](#6-database-schema-extensions)
7. [Feature 1: Dashboard (Birth Chart Map)](#7-feature-1-dashboard-birth-chart-map)
8. [Feature 2: Spiritual Guru Chat](#8-feature-2-spiritual-guru-chat)
9. [Feature 3: Partner Compatibility](#9-feature-3-partner-compatibility)
10. [Guru Configuration Window](#10-guru-configuration-window)
11. [Memory & Personalization System](#11-memory--personalization-system)
12. [Subscription & Billing System](#12-subscription--billing-system)
13. [Token Budget & Cost Control System](#13-token-budget--cost-control-system)
14. [API Route Map](#14-api-route-map)
15. [File & Folder Structure](#15-file--folder-structure)
16. [Environment Variables](#16-environment-variables)
17. [Implementation Order](#17-implementation-order)
18. [Claude Code CLI Instructions](#18-claude-code-cli-instructions)

---

## 1. Vision & Product Summary

**Cosmic Guru** is an all-in-one spiritual guidance web app built for monthly subscribers. It fuses:

- **Vedic (Jyotish) & Western astrology** — the user can toggle between the two systems. Western uses the traditional tropical zodiac; Vedic uses the sidereal zodiac (Lahiri ayanamsha) with Indian house rules.
- **Numerology** (Pythagorean & Chaldean), **Buddhism**, **Hindu philosophy**, and general spirituality as the AI's knowledge foundation.
- **Three core features** exposed as tabs: Birth Chart Dashboard, Guru Chat, Partner Horoscope.
- **A personal spiritual guru persona** that is configured once by the user (traditional↔modern spectrum + core belief system) and then remembers everything about the user across sessions.
- **Monthly SaaS pricing** with token budgets per tier — OpenRouter's auto-routing selects the most capable model that stays within that budget, falling back gracefully as quotas are hit.

---

## 2. Existing Codebase Foundation

The app is built on the **`auto-doc`** Next.js project located at `/workspace`. Key reusable assets:

| Asset | Location | Reuse |
|---|---|---|
| Next.js 16 App Router | `src/app/` | Keep as-is |
| Tailwind CSS v4 | `globals.css` | Keep, extend theme |
| NextAuth v5 + PrismaAdapter | `src/auth.ts` | Keep, extend User model |
| Prisma + PostgreSQL | `prisma/schema.prisma` | Extend with new models |
| OpenRouter provider setup | `src/lib/doc-gen/models.ts` | Copy pattern, rename for guru |
| Vercel AI SDK streaming | `src/app/api/doc-gen/stream/route.ts` | Adapt for guru chat |
| Stripe billing | `src/lib/stripe.ts`, `src/app/api/billing/` | Adapt for subscriptions |
| Token usage tracking | `src/lib/billing/run-tracker.ts` | Adapt for monthly quotas |
| Vercel Blob storage | `src/lib/blob-storage.ts` | Reuse for ephemeris files |
| AES-256-GCM encryption | `src/lib/services/token-encryption.ts` | Reuse for stored secrets |

**Do NOT delete** any existing `doc-gen` functionality — the two apps will coexist under separate routes (`/doc-gen` vs `/guru`).

---

## 3. Tech Stack (Additions & Changes)

### New NPM Packages to Install

```bash
npm install sweph                        # Swiss Ephemeris Node.js bindings (planetary positions)
npm install @swisseph/node               # Alternative with bundled ephemeris data (simpler setup)
npm install astronomia                   # Pure-JS fallback for basic Sun/Moon calculations
npm install geotz                        # Timezone from lat/lng (birth place → UTC offset)
npm install tzdata                       # Timezone database
npm install node-geocoder                # City/place name → lat/lng
npm install zustand                      # Already present — keep for client state
npm install date-fns                     # Date arithmetic (already likely present)
npm install react-hook-form              # Form handling for config/onboarding
npm install @hookform/resolvers          # Zod integration for react-hook-form
npm install d3                           # SVG chart rendering for birth chart wheel
npm install @radix-ui/react-dialog       # Config modal primitives
npm install @radix-ui/react-tabs         # Tab navigation
npm install @radix-ui/react-slider       # Traditional↔modern spectrum slider
npm install @radix-ui/react-select       # Dropdowns
npm install @radix-ui/react-switch       # Vedic/Western toggle
npm install framer-motion               # Animations for cosmic UI
```

### Keep Existing

- `@ai-sdk/openai`, `@ai-sdk/react`, `ai` — for streaming
- `stripe`, `@stripe/react-stripe-js` — for subscription billing
- `prisma`, `@prisma/client` — database
- `next-auth`, `@auth/prisma-adapter` — auth
- `zod` — validation
- `react-hot-toast` — notifications
- `react-markdown`, `remark-gfm` — markdown rendering in chat

---

## 4. External APIs & Knowledge Sources

### 4.1 Astronomical Calculations (Core Engine)

**Primary: `sweph` npm package (Swiss Ephemeris bindings)**
- Runs server-side in a Next.js Route Handler
- Provides: planetary positions, house cusps (all systems), Nakshatra, Moon phase, aspects
- Ephemeris data files (~30 MB) stored in `/public/ephe/` or Vercel Blob
- License: AGPL-3.0 (acceptable for SaaS — users get the service, not the source)

**Calculations needed:**
- `swe_calc_ut()` — planet longitudes for a given Julian Day
- `swe_houses()` — house cusps for birth lat/lng using Placidus (Western) or Whole Sign (Vedic)
- `swe_get_ayanamsa_ut()` — Lahiri ayanamsha correction for Vedic mode
- Sun sign, Moon sign, Ascendant (Lagna), all 12 house lords
- Vimshottari Dasha periods (current main/sub-period)
- Nakshatra (lunar mansion) and Pada

**Fallback: `openastrology-library` npm package**
- Pure-JS, no native bindings, easier Vercel deployment
- Covers both Western and Vedic with Swiss Ephemeris precision
- Use if `sweph` native bindings cause Vercel serverless issues

### 4.2 Geocoding (Birth Place → Coordinates)

**Primary: OpenStreetMap Nominatim (free, no API key)**
```
GET https://nominatim.openstreetmap.org/search?q={city}&format=json&limit=1
```
- Returns `lat`, `lon`, `display_name`
- Rate limit: 1 req/sec — cache results in Postgres `GeoCache` table

**Fallback: Google Maps Geocoding API** (if high volume needed, requires `GOOGLE_MAPS_API_KEY`)

### 4.3 Numerology

**Self-computed (no external API needed)**
- Life Path Number: reduce birthdate digits
- Destiny Number: reduce full name using Pythagorean/Chaldean letter-value tables
- Soul Urge, Personality, Expression numbers
- Master numbers (11, 22, 33) — do not reduce
- Karmic Debt numbers (13, 14, 16, 19)
- Personal Year number

Implement as `src/lib/guru/numerology.ts` — pure TypeScript, no external dependency.

**Optional enhancement: The Numerology API (`dashboard.numerologyapi.com`)**
- 120+ endpoints, Pythagorean + Chaldean
- Use for advanced karmic/esoteric calculations beyond the basics
- Store key `NUMEROLOGY_API_KEY` in env

### 4.4 Astrology MCP Server (AI Tool Integration)

**Primary: Vedika MCP Server (`vedika.io/mcp`)**
- 22 semantic tools: Vedic, Western, KP astrology
- 140+ endpoints, Swiss Ephemeris precision, 30 languages
- Pricing: from $12/month → include in operating cost
- Add as a tool available inside the Guru Chat streaming endpoint

**Alternative: Divine API MCP (`developers.divineapi.com/mcp`)**
- 193 tools: 78 Vedic, 53 Western, 62 Horoscope/Tarot/Numerology
- More comprehensive but potentially more expensive

**Integration pattern:** Register the MCP server URL + API key in the streaming route's `tools` object using Vercel AI SDK's `experimental_createMCPClient` or direct HTTP tool wrappers.

### 4.5 Daily Horoscope & Transits

**Option A: Fetch from Vedika API**
- Daily transit data: `/api/v1/western/transits` or `/api/v1/vedic/daily-panchang`
- Cache result per day in Postgres `DailyCache` table (date + zodiac_system key)

**Option B: Compute from `sweph` directly**
- Calculate current planetary positions vs. natal chart
- No external dependency, most accurate

**Recommended:** Option B for core transits (avoids API cost per user per day). Option A as enrichment layer for interpretation text.

### 4.6 AI Knowledge Base (Spiritual Content)

The Guru's spiritual knowledge is injected via **system prompt context files** (same pattern as `src/lib/doc-gen/rules/*.md`), stored at `src/lib/guru/knowledge/`:

```
src/lib/guru/knowledge/
  vedic-astrology.md        # Core Jyotish principles, graha, rashi, bhava
  western-astrology.md      # Tropical zodiac, modern planets, aspect theory
  numerology.md             # Pythagorean & Chaldean systems, master numbers
  buddhism.md               # Four Noble Truths, Eightfold Path, karma, dharma
  hinduism.md               # Vedic philosophy, chakras, Ayurveda body types
  spirituality-general.md   # Universal laws, manifestation, shadow work
  partner-compatibility.md  # Synastry rules, composite charts, attachment theory
  guru-personas.md          # Traditional guru archetypes vs. modern coach styles
```

These `.md` files are loaded server-side and injected into the system prompt as context. They can be updated without code changes — just edit the markdown.

**Additional free knowledge sources to draw from (embed in knowledge files):**
- [Sacred Texts Archive](https://www.sacred-texts.com) — public domain Hindu/Buddhist texts
- [Astro.com ephemeris data](https://www.astro.com/swisseph/) — Swiss Ephemeris docs
- [Britannica / Wikipedia](https://en.wikipedia.org) — verified reference content
- NASA JPL planetary data (bundled in Swiss Ephemeris)

---

## 5. OpenRouter Model Routing Strategy

### 5.1 Model Tier Ladder

Define a tiered model ladder in `src/lib/guru/models.ts`:

```typescript
export const GURU_MODEL_TIERS: GuruModelTier[] = [
  {
    tier: "premium",
    modelId: "openrouter/auto",          // OpenRouter picks best available
    maxTokensPerRequest: 4000,
    costPerMInputUSD: 3.0,               // Estimate for auto-routing
    costPerMOutputUSD: 15.0,
    description: "Best available model — used when monthly budget is healthy"
  },
  {
    tier: "standard",
    modelId: "openrouter/google/gemini-2.0-flash-001",
    maxTokensPerRequest: 3000,
    costPerMInputUSD: 0.10,
    costPerMOutputUSD: 0.40,
    description: "Fast, capable — used when budget is 60–80% consumed"
  },
  {
    tier: "economy",
    modelId: "openrouter/mistralai/mistral-small-3.1-24b-instruct",
    maxTokensPerRequest: 2000,
    costPerMInputUSD: 0.10,
    costPerMOutputUSD: 0.30,
    description: "Economy — used when budget is 80–95% consumed"
  },
  {
    tier: "free",
    modelId: "openrouter/free",          // OpenRouter free model router
    maxTokensPerRequest: 1500,
    costPerMInputUSD: 0,
    costPerMOutputUSD: 0,
    description: "Free fallback — used when monthly budget is exhausted"
  },
];
```

### 5.2 Model Selection Logic

```typescript
// src/lib/guru/model-selector.ts

export function selectGuruModel(
  monthlyBudgetUSD: number,        // from subscription plan
  spentThisMonthUSD: number,       // from DB: sum of GuruRun.estimatedCostUsd this month
  adminOverrideModelId?: string    // admin can pin a model for testing
): GuruModelTier {
  if (adminOverrideModelId) {
    return GURU_MODEL_TIERS.find(t => t.modelId === adminOverrideModelId)
      ?? GURU_MODEL_TIERS[0];
  }

  const remainingRatio = (monthlyBudgetUSD - spentThisMonthUSD) / monthlyBudgetUSD;

  if (remainingRatio > 0.40) return GURU_MODEL_TIERS[0]; // premium
  if (remainingRatio > 0.20) return GURU_MODEL_TIERS[1]; // standard
  if (remainingRatio > 0.05) return GURU_MODEL_TIERS[2]; // economy
  return GURU_MODEL_TIERS[3];                             // free
}
```

### 5.3 OpenRouter Fallback Array

When calling the streaming endpoint, pass an ordered `models` array to OpenRouter so it handles its own internal fallback on rate-limit or outage:

```typescript
// In the stream route, use the `models` parameter via extra body:
const result = streamText({
  model: openRouterProvider("openrouter/auto"),
  body: {
    models: [selectedTier.modelId, "openrouter/free"],  // fallback chain
    route: "fallback",
  },
  messages,
  system: systemPrompt,
  // ...
});
```

### 5.4 Free Tier / Testing Mode

- When `OPENROUTER_API_KEY` is set to a free-tier key (0 credit balance), `selectGuruModel()` is forced to return the `"free"` tier regardless of budget.
- Add env var `GURU_FORCE_FREE_MODEL=true` for explicit testing override.
- The free `openrouter/free` model router (released Feb 1, 2026) randomly selects from 25+ free models filtered for required capabilities (tool calling, etc.).

### 5.5 Monthly Reset

- Token budget tracking lives in the `UserGuruUsage` Prisma model (see Section 6).
- A scheduled job (Vercel Cron at `0 0 1 * *` — 1st of every month) resets `monthlyInputTokens`, `monthlyOutputTokens`, `monthlySpentUsd` to 0.
- Route: `src/app/api/cron/reset-monthly-usage/route.ts` protected by `CRON_SECRET`.

---

## 6. Database Schema Extensions

Add these models to `prisma/schema.prisma`. **Do not remove any existing models.**

```prisma
// ── Cosmic Guru: User Profile ──────────────────────────────────────────────────

model GuruProfile {
  id                  String   @id @default(cuid())
  userId              String   @unique
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Birth data
  birthDate           DateTime?
  birthTime           String?   // "HH:MM" — stored as string to handle unknown time
  birthTimeKnown      Boolean   @default(false)
  birthCity           String?
  birthCountry        String?
  birthLat            Float?
  birthLng            Float?
  birthTimezone       String?   // IANA tz string e.g. "Europe/Vienna"

  // Zodiac preference
  zodiacSystem        String    @default("western") // "western" | "vedic"

  // Guru configuration (from Config Window)
  guruTraditionScore  Int       @default(50)  // 0=ultra-modern, 100=ultra-traditional
  guruBeliefSystem    String[]  @default([])  // ["buddhism","hinduism","western_spirituality",...]
  guruName            String?                 // User-given name for their guru (e.g. "Shiva")
  guruTone            String    @default("warm") // "warm"|"direct"|"mystical"|"academic"
  guruLanguage        String    @default("en")

  // First name for personalization
  preferredName       String?

  // Onboarding complete?
  onboardingComplete  Boolean   @default(false)

  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@map("guru_profiles")
}

// ── Cosmic Guru: Memory / Context Store ────────────────────────────────────────

model GuruMemory {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Memory type: "fact" | "preference" | "insight" | "life_event" | "partner_note"
  type        String
  // Human-readable summary stored as plain text (indexed for search)
  summary     String   @db.Text
  // Full context or raw extracted text
  detail      String?  @db.Text
  // Source: which chat session generated this memory
  sessionId   String?
  // Importance score 1-10 (used to prioritize injection into context window)
  importance  Int      @default(5)
  // Whether this memory is actively injected into system prompts
  active      Boolean  @default(true)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, type])
  @@index([userId, active])
  @@map("guru_memories")
}

// ── Cosmic Guru: Chat Sessions ────────────────────────────────────────────────

model GuruSession {
  id          String     @id @default(cuid())
  userId      String
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Which of the three features initiated this session
  feature     String     // "chat" | "tip_of_day" | "partner"

  // Zodiac system in effect during this session
  zodiacSystem String    @default("western")

  // Model actually used
  modelId     String?
  modelTier   String?    // "premium"|"standard"|"economy"|"free"

  // Token usage (updated onFinish)
  inputTokens  Int       @default(0)
  outputTokens Int       @default(0)
  estimatedCostUsd Float @default(0)

  // Message history stored as JSON array (for session restore)
  messages    Json?

  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([userId, feature])
  @@index([userId, createdAt])
  @@map("guru_sessions")
}

// ── Cosmic Guru: Monthly Usage Tracking ───────────────────────────────────────

model UserGuruUsage {
  id                   String   @id @default(cuid())
  userId               String   @unique
  user                 User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Rolling monthly counters (reset by cron on 1st of each month)
  monthlyInputTokens   Int      @default(0)
  monthlyOutputTokens  Int      @default(0)
  monthlySpentUsd      Float    @default(0)

  // Lifetime counters (never reset)
  lifetimeInputTokens  Int      @default(0)
  lifetimeOutputTokens Int      @default(0)
  lifetimeSpentUsd     Float    @default(0)

  // Last reset timestamp
  lastResetAt          DateTime @default(now())

  updatedAt            DateTime @updatedAt

  @@map("user_guru_usage")
}

// ── Cosmic Guru: Subscription ──────────────────────────────────────────────────

model GuruSubscription {
  id                     String    @id @default(cuid())
  userId                 String    @unique
  user                   User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Stripe
  stripeSubscriptionId   String?   @unique
  stripePriceId          String?
  stripeCurrentPeriodEnd DateTime?

  // Plan
  plan                   String    @default("free") // "free"|"seeker"|"adept"|"master"
  status                 String    @default("inactive") // "active"|"inactive"|"past_due"|"canceled"

  // Token budget in USD for this billing period
  monthlyBudgetUsd       Float     @default(0)

  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt

  @@map("guru_subscriptions")
}

// ── Cosmic Guru: Partner Profiles ─────────────────────────────────────────────

model PartnerProfile {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  label        String   @default("Partner") // User-given label
  birthDate    DateTime?
  birthTime    String?
  birthTimeKnown Boolean @default(false)
  birthCity    String?
  birthCountry String?
  birthLat     Float?
  birthLng     Float?
  birthTimezone String?

  // Computed chart data (JSON — cached so we don't recompute every time)
  chartData    Json?

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([userId])
  @@map("partner_profiles")
}

// ── Cosmic Guru: Geo Cache ─────────────────────────────────────────────────────

model GeoCache {
  id          String   @id @default(cuid())
  query       String   @unique  // normalized city+country string
  lat         Float
  lng         Float
  timezone    String
  displayName String

  createdAt   DateTime @default(now())

  @@map("geo_cache")
}

// ── Cosmic Guru: Daily Horoscope Cache ────────────────────────────────────────

model DailyHoroscopeCache {
  id           String   @id @default(cuid())
  date         String   // "YYYY-MM-DD"
  zodiacSystem String   // "western" | "vedic"
  sign         String   // e.g. "aries" or "mesha"
  content      Json     // full horoscope data from API or computed

  createdAt    DateTime @default(now())

  @@unique([date, zodiacSystem, sign])
  @@map("daily_horoscope_cache")
}
```

Also add these relations to the existing `User` model:

```prisma
// Add inside the existing User model:
guruProfile      GuruProfile?
guruMemories     GuruMemory[]
guruSessions     GuruSession[]
guruUsage        UserGuruUsage?
guruSubscription GuruSubscription?
partnerProfiles  PartnerProfile[]
```

---

## 7. Feature 1: Dashboard (Birth Chart Map)

### Route: `/guru/dashboard`

### UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  COSMIC GURU          [Dashboard] [Chat] [Partner]    [⚙️]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────────────┐   ┌─────────────────────────┐  │
│   │   BIRTH CHART WHEEL  │   │  CHART DATA PANEL        │  │
│   │   (SVG D3 render)    │   │                          │  │
│   │   • All planets      │   │  System: [Western/Vedic] │  │
│   │   • 12 houses        │   │                          │  │
│   │   • Aspect lines     │   │  ☀️ Sun: Aries 14°32'    │  │
│   │                      │   │  🌙 Moon: Scorpio 7°18'  │  │
│   └──────────────────────┘   │  ↑ Ascendant: Cancer     │  │
│                               │  ...                     │  │
│   ┌──────────────────────────────────────────────────┐   │  │
│   │  CURRENT TRANSITS                                 │   │  │
│   │  Mars conjunct natal Sun (orb 1°2') — active now  │   │  │
│   └──────────────────────────────────────────────────┘   │  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Steps

**A. Birth Data Input (onboarding flow)**
- File: `src/app/guru/onboarding/page.tsx`
- Multi-step form: name → birthdate → birth time (with "unknown" option) → birth city (autocomplete via Nominatim) → zodiac system preference
- On submit: geocode city → store in `GuruProfile`

**B. Chart Calculation API**
- File: `src/app/api/guru/chart/route.ts`
- Input: `{ userId }` (reads from GuruProfile) or `{ birthDate, birthTime, lat, lng, timezone, system }`
- Uses `sweph` to compute:
  - Julian Day from UTC birth datetime
  - All planet positions (Sun through Pluto + Chiron + Rahu/Ketu for Vedic)
  - House cusps (Placidus for Western, Whole Sign for Vedic)
  - Ayanamsha correction if `system === "vedic"`
  - Ascendant, MC, IC, Descendant
  - Aspect table (conjunction 0°, sextile 60°, square 90°, trine 120°, opposition 180°)
  - For Vedic: Nakshatra, Dasha periods
- Returns: `ChartData` JSON object
- Cache: Store computed `chartData` in `GuruProfile.chartData` (Json field) — recompute only on profile change

**C. Birth Chart Wheel (SVG/D3)**
- File: `src/app/guru/_components/BirthChartWheel.tsx`
- D3-based SVG:
  - Outer ring: 12 zodiac signs (glyphs)
  - Middle ring: 12 houses (numbered)
  - Inner area: planet glyphs at their degree positions
  - Aspect lines drawn in the center (color-coded: trine=blue, square=red, sextile=green)
  - Toggle: Western / Vedic (calls recalculation)
- For Vedic mode: show Rashi (sign) + Nakshatra labels

**D. Transits Panel**
- File: `src/app/api/guru/transits/route.ts`
- Computes current planetary positions (today's date) vs. natal chart
- Returns list of active transits within orb (default 3° applying/separating)
- Cache in `DailyHoroscopeCache` — same data for all users with same natal config, refreshed daily

---

## 8. Feature 2: Spiritual Guru Chat

### Route: `/guru/chat`

### UI Layout

```
┌──────────────────────────────────────────────────────────────┐
│  🌙 Your Guru: SHIVA                    Model: [auto] ✨      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   [Today's Tip]  [Ask Anything]  [Deep Reading]             │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Chat messages render here with markdown             │     │
│  │ — streaming, with planet emoji and spiritual tone   │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  [ Type your question...                          ] [Send]   │
│                                                              │
│  Memory: 12 insights stored  |  Budget: 73% remaining       │
└──────────────────────────────────────────────────────────────┘
```

### System Prompt Architecture

The system prompt is assembled dynamically per-request in `src/lib/guru/system-prompt.ts`:

```typescript
export async function buildGuruSystemPrompt(userId: string): Promise<string> {
  const profile = await getGuruProfile(userId);
  const memories = await getActiveMemories(userId, { limit: 20, orderByImportance: true });
  const chartData = await getChartData(userId);
  const todayTransits = await getTodayTransits(userId);

  return `
# Your Identity
You are ${profile.guruName ?? "the Cosmic Guru"}, a deeply wise spiritual guide.
${buildPersonaFromConfig(profile)}

# The Seeker
Name: ${profile.preferredName}
Sun Sign: ${chartData.sun.sign} (${profile.zodiacSystem} system)
Moon Sign: ${chartData.moon.sign}
Ascendant: ${chartData.ascendant.sign}
Current Dasha: ${chartData.currentDasha ?? "unknown"} (Vedic: ${profile.zodiacSystem === "vedic"})
Numerology Life Path: ${profile.lifePath}

# Memories About This Seeker
${memories.map(m => `- ${m.summary}`).join("\n")}

# Today's Planetary Weather
${todayTransits.map(t => `- ${t.description}`).join("\n")}

# Knowledge Base
${await loadKnowledgeFiles(profile.guruBeliefSystem)}

# Rules
- Always address the seeker by name (${profile.preferredName})
- Adapt depth of answer to the complexity of the question
- Reference their actual chart data when relevant
- Use markdown formatting: headers, bullet points, **bold** for key insights
- End with one actionable spiritual practice or reflection
- Never fabricate planetary positions — use only the data provided above
- Respect the ${profile.zodiacSystem} system throughout
`;
}
```

### Chat Streaming API

- File: `src/app/api/guru/stream/route.ts`
- Pattern: same as `src/app/api/doc-gen/stream/route.ts`
- Steps:
  1. Auth check
  2. Load subscription → get monthly budget
  3. Load `UserGuruUsage` → calculate remaining budget
  4. Call `selectGuruModel()` → choose tier
  5. Build system prompt (via `buildGuruSystemPrompt`)
  6. Call `streamText()` with chosen model + MCP tools
  7. `onFinish`: update `GuruSession` token counts + `UserGuruUsage`
  8. After each complete response: call `extractAndStoreMemories()` async

### Memory Extraction

After each chat turn, run a lightweight extraction pass:

```typescript
// src/lib/guru/memory-extractor.ts
export async function extractAndStoreMemories(
  userId: string,
  sessionId: string,
  lastUserMessage: string,
  lastAssistantMessage: string
): Promise<void> {
  // Use a cheap model (free tier) to extract structured facts
  const extraction = await generateText({
    model: openRouterFreeModel,
    system: `Extract key facts, preferences, or life events mentioned by the user.
             Return JSON array: [{ type, summary, importance }]
             Types: "fact" | "preference" | "insight" | "life_event"
             Only extract genuinely new information. Return [] if nothing notable.`,
    prompt: `User said: "${lastUserMessage}"`,
    maxTokens: 200,
  });

  const memories = JSON.parse(extraction.text);
  for (const memory of memories) {
    await prisma.guruMemory.create({
      data: { userId, sessionId, ...memory, active: true }
    });
  }
}
```

### Sub-features

**Today's Tip:**
- Auto-triggered daily — generates one personalized spiritual tip based on:
  - Current transits vs. natal chart
  - Current Dasha period (if Vedic)
  - Numerology personal day number
  - Cached or fresh: store one tip per user per day in `DailyHoroscopeCache`

**Deep Reading:**
- Uses a longer context window + more detailed system prompt
- Costs more tokens → only available on Seeker tier and above

---

## 9. Feature 3: Partner Compatibility

### Route: `/guru/partner`

### UI Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Partner Compatibility                                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  YOU                          PARTNER                        │
│  ☀️ Aries | 🌙 Scorpio        [ Add Partner Birth Data ]    │
│  ↑ Cancer                     or select saved partner        │
│                                                              │
│  ┌──────────────────────────────────────────────────┐       │
│  │  COMPATIBILITY REPORT (AI Generated)              │       │
│  │  • Sun-Moon synastry score: 87%                   │       │
│  │  • Venus conjunct partner Jupiter (0°12') ✨       │       │
│  │  • Core values alignment: High                    │       │
│  │  • Growth challenges: Mars square Mars            │       │
│  └──────────────────────────────────────────────────┘       │
│                                                              │
│  Core Values I Seek in a Partner:                           │
│  [  ] Spiritual depth  [  ] Emotional availability          │
│  [  ] Intellectual match  [  ] Physical vitality            │
│  [ Generate Attraction Guidance ]                           │
└──────────────────────────────────────────────────────────────┘
```

### Implementation

**A. Partner Data Entry**
- File: `src/app/guru/partner/page.tsx`
- Same birth data form as user onboarding (name, date, time, place)
- Store in `PartnerProfile` model
- Support multiple saved partners (list/select)

**B. Synastry Calculation API**
- File: `src/app/api/guru/synastry/route.ts`
- Input: user natal chart + partner natal chart
- Compute:
  - Cross-aspects between all planets (e.g. user Venus conjunct partner Moon)
  - Composite chart (midpoint method)
  - House overlays (where partner's planets fall in user's houses)
  - Nodal connections (karmic indicators)
- Return structured `SynastryData` object

**C. AI Compatibility Report**
- System prompt includes both charts + core values checklist
- Provides:
  1. Overall energetic compatibility narrative
  2. Strengths (harmonious aspects)
  3. Growth edges (challenging aspects)
  4. Karmic connection indicators (South Node contacts)
  5. Attraction guidance ("what to embody / emit to attract this energy")

**D. Core Values Picker**
- Pre-defined list from `src/lib/guru/partner-values.ts`
- Categories: Spiritual, Emotional, Intellectual, Physical, Lifestyle
- User selects important values → stored in `GuruProfile.partnerValues` (Json)
- Injected into partner compatibility prompt as a filter/focus

---

## 10. Guru Configuration Window

### Route: Modal overlay, accessible from all guru pages via ⚙️ icon

### File: `src/app/guru/_components/GuruConfigModal.tsx`

### Config Sections

**1. Identity Setup (shown at onboarding, editable later)**
- Preferred name
- Birth data (date, time, city) — with recalculate button
- Zodiac system toggle (Western / Vedic)

**2. Guru Persona**
- Guru name input (default: "Cosmic Guide")
- Tradition spectrum slider: `0` (Ultra Modern / Law of Attraction / New Age) ↔ `100` (Ultra Traditional / Sanskrit / Vedic Orthodoxy)
- Belief system checkboxes:
  - Buddhism (Tibetan/Zen/Theravada sub-option)
  - Hinduism / Jyotish
  - Western Astrology
  - Numerology
  - Kabbalah
  - Tarot
  - Shamanic / Earth spirituality
  - Scientific Skepticism (adds disclaimer notes to AI responses)
- Tone selector: Warm & Nurturing / Direct & Challenging / Mystical & Poetic / Academic & Precise
- Language selector (EN, DE, ES, FR, IT, PT — passed to system prompt)

**3. Privacy & Memory**
- View stored memories (list, with delete per item)
- Toggle: "Allow Guru to remember life events"
- Toggle: "Allow Guru to remember preferences"
- "Clear all memories" button

**4. Subscription & Budget**
- Current plan display
- Monthly token budget remaining (progress bar)
- Model in use (derived from budget)
- Upgrade CTA

---

## 11. Memory & Personalization System

### Architecture: Context-Injected RAG-lite

No vector database needed for MVP. Use Postgres `GuruMemory` table with structured types and importance scoring.

**Memory Tiers:**

| Priority | Data | Source |
|---|---|---|
| Always injected | Birth chart, numerology numbers, zodiac system, guru config | `GuruProfile` |
| High priority (top 10) | Life events, strong preferences, partner info | `GuruMemory` type: `life_event`, `preference` importance ≥ 7 |
| Medium priority (fill remaining tokens) | Insights, casual facts | `GuruMemory` type: `insight`, `fact` importance 4–6 |
| Dropped when context full | Low-importance old memories | importance ≤ 3 or older than 90 days |

**Memory Context Budget:**
- Reserve 2000 tokens in context window for memories
- `getActiveMemories()` fetches ordered by `importance DESC, createdAt DESC`, stops when token estimate exceeds 2000

**Memory Lifecycle:**
- Auto-extracted after each chat turn (lightweight free-model pass)
- User can view/delete via Config Modal
- Memories tagged with `sessionId` for traceability
- Old memories (90+ days, importance ≤ 3) auto-archived (flagged `active = false`) by weekly cron

---

## 12. Subscription & Billing System

### Replace per-run Stripe PaymentIntents with monthly Stripe Subscriptions

### Subscription Plans

| Plan | Price | Monthly AI Budget | Features |
|---|---|---|---|
| **Free Seeker** | $0 | $0.50 (free models only) | Dashboard, 5 chat msgs/day, basic tip |
| **Seeker** | $9.99/mo | $3.00 | All features, 50 msgs/day, memory (20 items) |
| **Adept** | $19.99/mo | $8.00 | All features, 200 msgs/day, memory (100 items), deep readings |
| **Master** | $39.99/mo | $20.00 | Unlimited msgs, full memory, priority model, API access |

### Stripe Implementation

**Products & Prices (create in Stripe Dashboard):**
```
STRIPE_PRICE_SEEKER_MONTHLY=price_xxxxx
STRIPE_PRICE_ADEPT_MONTHLY=price_xxxxx
STRIPE_PRICE_MASTER_MONTHLY=price_xxxxx
```

**API Routes (new, under `/api/guru/billing/`):**
- `POST /api/guru/billing/checkout` — create Stripe Checkout Session (mode: subscription)
- `POST /api/guru/billing/portal` — create Stripe Customer Portal session (for manage/cancel)
- `POST /api/guru/billing/webhook` — handle Stripe subscription webhooks:
  - `customer.subscription.created` → create/update `GuruSubscription`, set `monthlyBudgetUsd`
  - `customer.subscription.updated` → update plan/status/budget
  - `customer.subscription.deleted` → downgrade to Free
  - `invoice.payment_succeeded` → reset monthly usage counters
  - `invoice.payment_failed` → set status `past_due`, restrict to free model

**Entitlement Check (middleware function):**
```typescript
// src/lib/guru/entitlements.ts
export async function getGuruEntitlements(userId: string): Promise<GuruEntitlements> {
  const sub = await getGuruSubscription(userId);
  const usage = await getUserGuruUsage(userId);

  return {
    plan: sub?.plan ?? "free",
    monthlyBudgetUsd: sub?.monthlyBudgetUsd ?? 0.50,
    remainingBudgetUsd: (sub?.monthlyBudgetUsd ?? 0.50) - (usage?.monthlySpentUsd ?? 0),
    dailyMessageLimit: PLAN_LIMITS[sub?.plan ?? "free"].dailyMessages,
    memoryItemLimit: PLAN_LIMITS[sub?.plan ?? "free"].memoryItems,
    canAccessDeepReadings: ["adept", "master"].includes(sub?.plan ?? "free"),
    canAccessPartnerFeature: ["seeker", "adept", "master"].includes(sub?.plan ?? "free"),
  };
}
```

### Migration from DocRun billing

- Keep `DocRun` model and billing routes untouched
- New subscription system runs in parallel under `/api/guru/billing/`
- Shared `stripeCustomerId` on `User` model — same Stripe customer, different subscription

---

## 13. Token Budget & Cost Control System

### File: `src/lib/guru/budget-guard.ts`

```typescript
export class BudgetGuard {
  /**
   * Check if user can make a request and which model to use.
   * Throws GuruBudgetExceededError if even free model is exhausted (rate limited).
   */
  static async check(userId: string): Promise<{
    modelTier: GuruModelTier;
    remainingBudgetUsd: number;
    warningLevel: "none" | "low" | "critical" | "exhausted";
  }> {
    const entitlements = await getGuruEntitlements(userId);
    const { remainingBudgetUsd, monthlyBudgetUsd } = entitlements;

    const ratio = remainingBudgetUsd / monthlyBudgetUsd;
    const modelTier = selectGuruModel(monthlyBudgetUsd, monthlyBudgetUsd - remainingBudgetUsd);

    return {
      modelTier,
      remainingBudgetUsd,
      warningLevel:
        ratio > 0.40 ? "none" :
        ratio > 0.20 ? "low" :
        ratio > 0.05 ? "critical" :
        "exhausted",
    };
  }

  /**
   * Estimate cost of a request before making it.
   * Checks if it would exceed budget; if yes, downgrade model.
   */
  static estimateAndDowngrade(
    modelTier: GuruModelTier,
    estimatedInputTokens: number,
    estimatedOutputTokens: number,
    remainingBudgetUsd: number
  ): GuruModelTier {
    const estimatedCost =
      (estimatedInputTokens / 1_000_000) * modelTier.costPerMInputUSD +
      (estimatedOutputTokens / 1_000_000) * modelTier.costPerMOutputUSD;

    if (estimatedCost > remainingBudgetUsd) {
      // Downgrade to next cheaper tier
      const currentIdx = GURU_MODEL_TIERS.findIndex(t => t.tier === modelTier.tier);
      return GURU_MODEL_TIERS[Math.min(currentIdx + 1, GURU_MODEL_TIERS.length - 1)];
    }
    return modelTier;
  }
}
```

### Token Usage Update (after each stream)

```typescript
// Called in onFinish callback of streamText
await prisma.$transaction([
  prisma.userGuruUsage.upsert({
    where: { userId },
    create: {
      userId,
      monthlyInputTokens: inputTokens,
      monthlyOutputTokens: outputTokens,
      monthlySpentUsd: costUsd,
      lifetimeInputTokens: inputTokens,
      lifetimeOutputTokens: outputTokens,
      lifetimeSpentUsd: costUsd,
    },
    update: {
      monthlyInputTokens: { increment: inputTokens },
      monthlyOutputTokens: { increment: outputTokens },
      monthlySpentUsd: { increment: costUsd },
      lifetimeInputTokens: { increment: inputTokens },
      lifetimeOutputTokens: { increment: outputTokens },
      lifetimeSpentUsd: { increment: costUsd },
    },
  }),
  prisma.guruSession.update({
    where: { id: sessionId },
    data: { inputTokens, outputTokens, estimatedCostUsd: costUsd, modelId, modelTier },
  }),
]);
```

### Monthly Reset Cron

```typescript
// src/app/api/cron/reset-monthly-usage/route.ts
export async function GET(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) return new Response("Unauthorized", { status: 401 });

  await prisma.userGuruUsage.updateMany({
    data: {
      monthlyInputTokens: 0,
      monthlyOutputTokens: 0,
      monthlySpentUsd: 0,
      lastResetAt: new Date(),
    },
  });

  return Response.json({ ok: true, resetAt: new Date() });
}
```

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/reset-monthly-usage",
      "schedule": "0 0 1 * *"
    }
  ]
}
```

---

## 14. API Route Map

```
/api/guru/
  chart/                  GET  — compute/return natal chart for current user
  chart/partner/          POST — compute natal chart for partner birth data
  synastry/               POST — compute synastry between two charts
  transits/               GET  — today's transits vs natal chart
  stream/                 POST — main streaming chat endpoint
  tip/                    GET  — today's personalized tip (cached per user per day)
  profile/                GET/PUT — read/update GuruProfile
  memory/                 GET — list memories
  memory/[id]/            DELETE — delete specific memory
  partner/                GET/POST — list/create partner profiles
  partner/[id]/           PUT/DELETE — update/delete partner profile
  billing/checkout/       POST — create Stripe subscription checkout session
  billing/portal/         POST — create Stripe customer portal session
  billing/webhook/        POST — Stripe webhook handler
  geocode/                GET — city search → lat/lng/timezone

/api/cron/
  reset-monthly-usage/    GET — monthly token counter reset (cron-protected)
  archive-old-memories/   GET — weekly memory archival (cron-protected)
```

---

## 15. File & Folder Structure

```
src/
  app/
    guru/
      page.tsx                        # Redirect → /guru/dashboard or /guru/onboarding
      layout.tsx                      # Guru shell: nav tabs, auth guard
      onboarding/
        page.tsx                      # Multi-step birth data + guru config form
      dashboard/
        page.tsx                      # Birth chart dashboard
      chat/
        page.tsx                      # Guru chat interface
      partner/
        page.tsx                      # Partner compatibility
      _components/
        GuruNav.tsx                   # Top tab navigation
        BirthChartWheel.tsx           # D3 SVG chart wheel
        ChartDataPanel.tsx            # Planet/house data table
        TransitsPanel.tsx             # Today's transits list
        GuruChatInterface.tsx         # Chat UI (useChat hook)
        GuruConfigModal.tsx           # Settings modal
        MemoryList.tsx                # Memory viewer/manager
        BudgetIndicator.tsx           # Token budget progress bar
        PricingPage.tsx               # Subscription plans UI
        PartnerForm.tsx               # Partner birth data form
        SynastryReport.tsx            # Compatibility report display
    api/
      guru/
        chart/route.ts
        chart/partner/route.ts
        synastry/route.ts
        transits/route.ts
        stream/route.ts
        tip/route.ts
        profile/route.ts
        memory/route.ts
        memory/[id]/route.ts
        partner/route.ts
        partner/[id]/route.ts
        billing/
          checkout/route.ts
          portal/route.ts
          webhook/route.ts
        geocode/route.ts
      cron/
        reset-monthly-usage/route.ts
        archive-old-memories/route.ts

  lib/
    guru/
      models.ts                       # GuruModelTier definitions, selectGuruModel()
      model-selector.ts               # Budget-based model selection logic
      system-prompt.ts                # Dynamic system prompt builder
      budget-guard.ts                 # BudgetGuard class
      entitlements.ts                 # Plan limits, getGuruEntitlements()
      chart-engine.ts                 # sweph wrapper: computeNatalChart(), computeSynastry()
      numerology.ts                   # Pure-TS numerology calculations
      geocoder.ts                     # Nominatim geocoding + GeoCache
      memory-extractor.ts             # Post-chat memory extraction
      knowledge/
        vedic-astrology.md
        western-astrology.md
        numerology.md
        buddhism.md
        hinduism.md
        spirituality-general.md
        partner-compatibility.md
        guru-personas.md
      partner-values.ts               # Pre-defined core values list
      constants.ts                    # PLAN_LIMITS, token budgets, etc.
      types.ts                        # TypeScript types: ChartData, GuruModelTier, etc.
```

---

## 16. Environment Variables

Add these to `.env.local` / Vercel dashboard (in addition to existing vars):

```bash
# ── Cosmic Guru ─────────────────────────────────────────────────────────────
# OpenRouter (already exists in auto-doc — reuse)
OPENROUTER_API_KEY=sk-or-...           # Free-tier key for testing, paid key for prod

# Astrology MCP (choose one)
VEDIKA_API_KEY=...                     # vedika.io — 22 Vedic/Western/KP tools
DIVINE_API_KEY=...                     # divineapi.com — 193 tools alternative

# Numerology (optional enhancement)
NUMEROLOGY_API_KEY=...                 # dashboard.numerologyapi.com

# Geocoding (optional — Nominatim is free, no key needed)
GOOGLE_MAPS_API_KEY=...               # Only if Nominatim rate limits are a problem

# Stripe (subscription-specific price IDs)
STRIPE_PRICE_SEEKER_MONTHLY=price_...
STRIPE_PRICE_ADEPT_MONTHLY=price_...
STRIPE_PRICE_MASTER_MONTHLY=price_...
STRIPE_GURU_WEBHOOK_SECRET=whsec_...   # Separate webhook endpoint from doc-gen

# Cron security
CRON_SECRET=...                        # Random 32-char string for cron route auth

# Feature flags
GURU_FORCE_FREE_MODEL=false            # Set to "true" for testing on free OpenRouter key
GURU_MCP_ENABLED=true                  # Enable/disable MCP tool calls
GURU_MEMORY_EXTRACTION_ENABLED=true    # Enable/disable post-chat memory extraction

# Swiss Ephemeris (if using sweph native package)
SWEPH_DATA_PATH=/app/public/ephe       # Path to .se1 ephemeris data files
```

---

## 17. Implementation Order

Build in this sequence to ensure each phase is deployable and testable:

### Phase 0 — Foundation (prerequisite)
1. Create git branch `cursor/cosmic-guru`
2. Install new npm packages (sweph, d3, radix-ui components, etc.)
3. Extend `prisma/schema.prisma` with all new models
4. Run `prisma db push` to apply schema
5. Add `User` relation fields for new models
6. Create `src/lib/guru/types.ts` and `src/lib/guru/constants.ts`

### Phase 1 — Core Calculation Engine
1. Implement `src/lib/guru/chart-engine.ts` (sweph wrapper)
   - Test with a known birth chart (e.g. 1990-06-15 14:30 Vienna) against published ephemeris
2. Implement `src/lib/guru/numerology.ts` (no external dep)
3. Implement `src/lib/guru/geocoder.ts` (Nominatim + DB cache)
4. Create `GET /api/guru/chart` endpoint

### Phase 2 — Auth & Onboarding
1. Create `src/app/guru/layout.tsx` (auth guard + nav)
2. Create onboarding multi-step form (`/guru/onboarding`)
3. Create `PUT /api/guru/profile` endpoint
4. Wire form submission → geocode → save `GuruProfile`

### Phase 3 — Dashboard
1. Create `BirthChartWheel.tsx` D3 component
2. Create `ChartDataPanel.tsx`
3. Create `GET /api/guru/transits` endpoint
4. Assemble `/guru/dashboard` page

### Phase 4 — Guru Chat (Core)
1. Create `src/lib/guru/models.ts` and `model-selector.ts`
2. Create `src/lib/guru/budget-guard.ts`
3. Create `src/lib/guru/system-prompt.ts` + knowledge `.md` files
4. Create `POST /api/guru/stream` endpoint
5. Create `GuruChatInterface.tsx` component
6. Assemble `/guru/chat` page

### Phase 5 — Memory System
1. Create `src/lib/guru/memory-extractor.ts`
2. Wire memory extraction into `onFinish` of stream route
3. Create `GET /api/guru/memory` and `DELETE /api/guru/memory/[id]`
4. Create `MemoryList.tsx` component
5. Build `GuruConfigModal.tsx` with memory management

### Phase 6 — Subscription & Billing
1. Create Stripe products + prices in dashboard
2. Create `GuruSubscription` create/read helpers
3. Create `/api/guru/billing/checkout`, `/portal`, `/webhook` routes
4. Create `src/lib/guru/entitlements.ts`
5. Build `PricingPage.tsx` and `BudgetIndicator.tsx`
6. Wire entitlement checks into stream route

### Phase 7 — Partner Feature
1. Create `/api/guru/chart/partner` and `/api/guru/synastry`
2. Create `PartnerForm.tsx`
3. Create `SynastryReport.tsx`
4. Assemble `/guru/partner` page

### Phase 8 — Polish & Optimization
1. Add `vercel.json` cron jobs
2. Implement daily tip caching
3. Add `openrouter/free` fallback chain in stream route
4. Add `GURU_FORCE_FREE_MODEL` override
5. Performance: lazy-load D3, code-split guru routes
6. Cosmic dark theme (deep navy/purple/gold color palette)

---

## 18. Claude Code CLI Instructions

When handing this document to Claude Code CLI, use this prompt:

---

```
You are building "Cosmic Guru" — an AI-powered spiritual horoscope SaaS web app.

The codebase is at /workspace and is an existing Next.js 16 app called "auto-doc".
Read the file /workspace/COSMIC_GURU_BLUEPRINT.md for the COMPLETE specification.

Follow the Implementation Order in Section 17 exactly, one phase at a time.

Key constraints:
1. DO NOT delete or modify any existing doc-gen functionality
2. All new routes live under /guru/* and /api/guru/*
3. Use the existing OpenRouter provider pattern from src/lib/doc-gen/models.ts
4. Use Prisma for ALL database access — no raw SQL
5. Keep all TypeScript types strict — no `any`
6. Every new Prisma model must be added to prisma/schema.prisma before use
7. Run `npx prisma db push` after schema changes
8. Knowledge .md files in src/lib/guru/knowledge/ must be substantive (500+ words each)
9. The sweph package requires native bindings — test with `@swisseph/node` first as it has bundled ephemeris data and simpler setup
10. Start with Phase 0 and Phase 1 — confirm chart calculations are accurate before building UI

Start with Phase 0: install packages, extend the schema, create type files.
After each phase, confirm what was built and ask to proceed to the next phase.
```

---

## Appendix A: Zodiac System Differences

| Aspect | Western (Tropical) | Vedic (Sidereal) |
|---|---|---|
| Zodiac reference | Vernal equinox (0° Aries) | Fixed stars (Lahiri ayanamsha ~24°) |
| Current offset | ~24° behind sidereal | — |
| House system | Placidus (default) | Whole Sign (default) |
| Outer planets | Uranus, Neptune, Pluto used | Uranus/Neptune/Pluto secondary |
| Node system | North/South Node | Rahu (ascending) / Ketu (descending) |
| Extra points | Chiron, Lilith, Part of Fortune | Upagrahas, Gulika, Maandi |
| Time lord system | Solar Arc, Profections | Vimshottari Dasha |
| Lunar mansions | — | 27 Nakshatras + Padas |
| Chart reading | Sun-sign focused | Ascendant (Lagna) focused |

## Appendix B: Subscription Plan Token Budgets — Justification

At current OpenRouter pricing (April 2026):
- `openrouter/auto` ≈ $3–15/M tokens (avg ~$5/M blended)
- `gemini-2.0-flash` ≈ $0.10/$0.40 per M in/out
- Free models: $0

| Plan ($9.99) | Budget $3.00 | @ $5/M blended = 600K tokens | ÷ 30 days = 20K tokens/day |
|---|---|---|---|
| ~20K tokens/day | ≈ 10 messages × 2K tokens each | Comfortably covers 50 msgs/day with model downgrading | ✓ |

The model ladder ensures that even as a user approaches their limit, they still receive answers — just from progressively lighter models. The free tier (`openrouter/free`) acts as the ultimate safety net with $0 cost.

## Appendix C: Data Privacy Notes

- Birth data (date, time, place) is sensitive — store encrypted at rest if possible (use existing AES-256-GCM pattern from `src/lib/services/token-encryption.ts`)
- Memory contents should be disclosed to users (Config Modal → Memory tab)
- GDPR: add "Delete my account + all data" endpoint under `/api/user/delete`
- No birth data is sent to third-party APIs unless user explicitly enables enhanced features

---

*Blueprint version 1.0 — Generated April 2026*
*Ready for Claude Code CLI implementation*
