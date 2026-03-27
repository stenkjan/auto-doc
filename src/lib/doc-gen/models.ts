import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

export type AIProvider = "openrouter" | "anthropic" | "google";

export interface ModelPricing {
  /** Cost per 1M input tokens in USD */
  inputPerM: number;
  /** Cost per 1M output tokens in USD */
  outputPerM: number;
}

export interface AIModel {
  id: string;
  provider: AIProvider;
  label: string;
  description: string;
  contextWindow: string;
  paid?: boolean;
  /** Whether this model reliably produces complete styled HTML documents for PDF rendering */
  supportsHtmlOutput?: boolean;
  /** Approximate pricing per 1M tokens in USD (for cost estimation) */
  pricing?: ModelPricing;
}

export const AI_MODELS: AIModel[] = [
  // ── Free models (OpenRouter) ────────────────────────────────────────
  {
    id: "openrouter/free",
    provider: "openrouter",
    label: "Free Router",
    description: "Automatisch – wählt das beste kostenlose Modell",
    contextWindow: "200k",
    paid: false,
  },
  {
    id: "openrouter/auto",
    provider: "openrouter",
    label: "Auto Router",
    description: "OpenRouter – wählt automatisch das beste verfügbare Modell (Gemini, Claude, etc.)",
    contextWindow: "200k",
    paid: true, // costs whatever model actually runs — not free
  },
  {
    id: "openrouter/optimus-alpha",
    provider: "openrouter",
    label: "Optimus Alpha",
    description: "Kostenlos – stark bei realen Aufgaben & Code",
    contextWindow: "1M",
    paid: false,
  },
  {
    id: "openrouter/quasar-alpha",
    provider: "openrouter",
    label: "Quasar Alpha",
    description: "Kostenlos – gut bei langen Dokumenten",
    contextWindow: "1M",
    paid: false,
  },
  {
    id: "openrouter/cypher-alpha",
    provider: "openrouter",
    label: "Cypher Alpha",
    description: "Kostenlos – allgemein & Code",
    contextWindow: "1M",
    paid: false,
  },
  {
    id: "openrouter/meta-llama/llama-4-scout",
    provider: "openrouter",
    label: "Llama 4 Scout",
    description: "Meta – kostenlos, 10M Kontext",
    contextWindow: "10M",
    paid: false,
  },
  {
    id: "openrouter/mistralai/mistral-small-3.1-24b-instruct:free",
    provider: "openrouter",
    label: "Mistral Small 3.1",
    description: "Mistral – kostenlos, gut für einfache Dokumente",
    contextWindow: "128k",
    paid: false,
  },
  // ── Google Gemini (direct via AUTO_DOC_GEMINI_KEY) ─────────────────
  {
    id: "google/gemini-2.0-flash-lite",
    provider: "google",
    label: "Gemini 2.0 Flash Lite",
    description: "Google – ultra-schnell und günstig, ideal für einfache Dokumente",
    contextWindow: "1M",
    paid: true,
    supportsHtmlOutput: false,
    pricing: { inputPerM: 0.075, outputPerM: 0.3 },
  },
  {
    id: "google/gemini-2.0-flash",
    provider: "google",
    label: "Gemini 2.0 Flash",
    description: "Google – schnell, solide Qualität für die meisten Dokumente",
    contextWindow: "1M",
    paid: true,
    supportsHtmlOutput: true,
    pricing: { inputPerM: 0.1, outputPerM: 0.4 },
  },
  {
    id: "google/gemini-1.5-pro",
    provider: "google",
    label: "Gemini 1.5 Pro",
    description: "Google – höchste Gemini-Qualität, 2M Kontext",
    contextWindow: "2M",
    paid: true,
    supportsHtmlOutput: true,
    pricing: { inputPerM: 1.25, outputPerM: 5.0 },
  },
  // ── Virtual SMART model — resolved at runtime to Gemini 1.5 Pro or Claude Sonnet 4.5 ──
  {
    id: "smart",
    provider: "google",  // default; overridden at runtime when SMART_USE_CLAUDE=true
    label: "Smart (auto)",
    description: "Dynamisch: Gemini 1.5 Pro (Standard) oder Claude Sonnet 4.5 (wenn aktiviert)",
    contextWindow: "2M",
    paid: true,
    supportsHtmlOutput: true,
    pricing: { inputPerM: 1.25, outputPerM: 5.0 },
  },
  // ── Paid models (Anthropic direct) ─────────────────────────────────
  {
    id: "anthropic/claude-3-5-haiku-20241022",    provider: "anthropic",
    label: "Claude 3.5 Haiku",
    description: "Schnell & günstig – ideal für einfache Dokumente",
    contextWindow: "200k",
    paid: true,
    supportsHtmlOutput: true,
    pricing: { inputPerM: 0.8, outputPerM: 4.0 },
  },
  {
    id: "anthropic/claude-3-5-sonnet-20241022",
    provider: "anthropic",
    label: "Claude 3.5 Sonnet",
    description: "Ausgewogen – hohe Präzision bei großem Kontext",
    contextWindow: "200k",
    paid: true,
    supportsHtmlOutput: true,
    pricing: { inputPerM: 3.0, outputPerM: 15.0 },
  },
  {
    id: "anthropic/claude-sonnet-4-5",
    provider: "anthropic",
    label: "Claude Sonnet 4.5",
    description: "Empfohlen – beste Qualität für professionelle Dokumente",
    contextWindow: "200k",
    paid: true,
    supportsHtmlOutput: true,
    pricing: { inputPerM: 3.0, outputPerM: 15.0 },
  },
  {
    id: "anthropic/claude-opus-4-5",
    provider: "anthropic",
    label: "Claude Opus 4.5",
    description: "Maximale Qualität – für komplexe Dokumente",
    contextWindow: "200k",
    paid: true,
    supportsHtmlOutput: true,
    pricing: { inputPerM: 15.0, outputPerM: 75.0 },
  },
  // ── Paid models (via OpenRouter) ────────────────────────────────────
  {
    id: "openrouter/anthropic/claude-sonnet-4-5",
    provider: "openrouter",
    label: "Claude Sonnet 4.5 (OR)",
    description: "Claude Sonnet via OpenRouter – kein separater API Key nötig",
    contextWindow: "200k",
    paid: true,
    supportsHtmlOutput: true,
    pricing: { inputPerM: 3.0, outputPerM: 15.0 },
  },
  {
    id: "openrouter/anthropic/claude-3-5-sonnet",
    provider: "openrouter",
    label: "Claude 3.5 Sonnet (OR)",
    description: "Claude 3.5 Sonnet via OpenRouter – ausgewogen, hohe Präzision",
    contextWindow: "200k",
    paid: true,
    supportsHtmlOutput: true,
    pricing: { inputPerM: 3.0, outputPerM: 15.0 },
  },
  {
    id: "openrouter/google/gemini-2.0-flash-lite",
    provider: "openrouter",
    label: "Gemini 2.0 Flash Lite (OR)",
    description: "Google – schnell, günstig, geeignet für einfache Dokumente",
    contextWindow: "1M",
    paid: true,
    supportsHtmlOutput: false,
    pricing: { inputPerM: 0.075, outputPerM: 0.3 },
  },
  {
    id: "openrouter/openai/gpt-4o",
    provider: "openrouter",
    label: "GPT-4o",
    description: "OpenAI – stark bei strukturierten Dokumenten",
    contextWindow: "128k",
    paid: true,
    supportsHtmlOutput: true,
    pricing: { inputPerM: 2.5, outputPerM: 10.0 },
  },
];

export const DEFAULT_MODEL_ID = "openrouter/free";

/* ------------------------------------------------------------------ */
/*  Simplified 4-Tier Model Configuration                              */
/* ------------------------------------------------------------------ */

export interface ModelTier {
  tierId: "schnell" | "standard" | "smart" | "pro";
  label: string;
  description: string;
  /** The underlying AI model ID (must exist in AI_MODELS) */
  modelId: string;
}

export const MODEL_TIERS: ModelTier[] = [
  {
    tierId: "schnell",
    label: "SCHNELL (KOSTENLOS)",
    description:
      "Ausreichend für die meisten einfachen Dokumente wie kurze Tabellen, Zusammenfassungen und Kurzinformationen.",
    modelId: "openrouter/free",
  },
  {
    tierId: "standard",
    label: "STANDARD",
    description:
      "Effiziente Erstellung von Inhalten mit größerem Kontext und höherer Präzision.",
    modelId: "google/gemini-2.0-flash",
  },
  {
    tierId: "smart",
    label: "SMART",
    description: "KI-gestützte Modellauswahl für individuelle Konfigurationen.",
    // Runtime-resolved: Gemini 1.5 Pro now; set SMART_USE_CLAUDE=true → Claude Sonnet 4.5
    modelId: "smart",
  },
  {
    tierId: "pro",
    label: "PRO",
    description:
      "Der größte Kontext und das stärkste Modell und maßgeschneiderte Prompts für die besten Ergebnisse.",
    // Requires Anthropic credits — best Claude model for professional document generation
    modelId: "anthropic/claude-sonnet-4-5",
  },
];

export const DEFAULT_TIER_ID: ModelTier["tierId"] = "standard";

export function getTier(tierId: string): ModelTier | undefined {
  return MODEL_TIERS.find((t) => t.tierId === tierId);
}

export function getModel(id: string): AIModel | undefined {
  return AI_MODELS.find((m) => m.id === id);
}

export function getModelsByProvider(provider: AIProvider): AIModel[] {
  return AI_MODELS.filter((m) => m.provider === provider);
}

/** USD → EUR conversion rate (approximate, update periodically) */
const USD_TO_EUR = 0.92;

/**
 * Estimate cost in EUR for a given model and token counts.
 * Returns null if the model has no pricing (free models).
 */
export function estimateCostEur(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): { usd: number; eur: number; formatted: string } | null {
  const model = getModel(modelId);
  if (!model?.pricing) return null;
  const usd =
    (inputTokens / 1_000_000) * model.pricing.inputPerM +
    (outputTokens / 1_000_000) * model.pricing.outputPerM;
  const eur = usd * USD_TO_EUR;
  const formatted =
    eur < 0.001
      ? "< € 0,001"
      : `€ ${eur.toFixed(4).replace(".", ",")}`;
  return { usd, eur, formatted };
}

/* ------------------------------------------------------------------ */
/*  Provider Color Map (for spending bar UI)                           */
/* ------------------------------------------------------------------ */

export const PROVIDER_COLORS: Record<AIProvider, string> = {
  anthropic: "#8B5CF6",  // purple
  google: "#3B82F6",     // blue
  openrouter: "#22C55E", // green
};

/* ------------------------------------------------------------------ */
/*  Pre-Flight Cost Estimation                                          */
/* ------------------------------------------------------------------ */

/** Approximate token count from character count (~4 chars/token for European text) */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate total cost in EUR for a planned run before sending.
 * Returns null if model is free (no pricing).
 *
 * @param modelId - The AI model ID
 * @param promptChars - Total character count of prompt + resources
 * @param systemOverheadTokens - Estimated system prompt tokens (default: 3000)
 * @param expectedOutputTokens - Estimated output tokens (default: 6000 for doc generation)
 */
export function estimateRunCostEur(
  modelId: string,
  promptChars: number,
  systemOverheadTokens = 3000,
  expectedOutputTokens = 6000
): {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  eur: number;
  formatted: string;
} | null {
  const model = getModel(modelId);
  if (!model?.pricing) return null;

  const inputFromPrompt = Math.ceil(promptChars / 4);
  const totalInputTokens = inputFromPrompt + systemOverheadTokens;

  const usd =
    (totalInputTokens / 1_000_000) * model.pricing.inputPerM +
    (expectedOutputTokens / 1_000_000) * model.pricing.outputPerM;
  const eur = usd * USD_TO_EUR;
  const formatted =
    eur < 0.001
      ? "< € 0,001"
      : `€ ${eur.toFixed(4).replace(".", ",")}`;

  return {
    estimatedInputTokens: totalInputTokens,
    estimatedOutputTokens: expectedOutputTokens,
    eur,
    formatted,
  };
}

/* ------------------------------------------------------------------ */
/*  Vercel AI SDK Language Model Provider                               */
/* ------------------------------------------------------------------ */

const anthropicProvider = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
});

const openRouterProvider = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  baseURL: "https://openrouter.ai/api/v1",
  // Force Chat Completions format — OpenRouter does not support the OpenAI Responses API
  headers: {
    "HTTP-Referer": "https://hoam-house.com",
    "X-Title": "Auto Doc Generator",
  },
});

const googleProvider = createGoogleGenerativeAI({
  apiKey: process.env.AUTO_DOC_GEMINI_KEY ?? "",
});

/**
 * Get a Vercel AI SDK LanguageModel instance for a given model ID.
 */
export function getLanguageModel(modelId: string): LanguageModel {
  const model = getModel(modelId);
  if (!model) throw new Error(`Unbekanntes Modell: ${modelId}`);

  // SMART virtual model: Gemini 1.5 Pro by default.
  // Set SMART_USE_CLAUDE=true in .env once Anthropic credits are active → auto-switches to Claude Sonnet 4.5.
  if (model.id === "smart") {
    if (process.env.SMART_USE_CLAUDE === "true" && process.env.ANTHROPIC_API_KEY?.trim()) {
      return anthropicProvider("claude-sonnet-4-5");
    }
    return googleProvider("gemini-1.5-pro");
  }

  if (model.provider === "google") {
    return googleProvider(model.id.replace(/^google\//, ""));
  }

  if (model.provider === "anthropic") {
    const actualId = model.id.replace(/^anthropic\//, "");
    return anthropicProvider(actualId);
  }

  // OpenRouter: strip the "openrouter/" prefix for the API call
  const OPENROUTER_ALIASES = ["openrouter/free", "openrouter/auto"];
  const actualModel = OPENROUTER_ALIASES.includes(model.id)
    ? model.id
    : model.id.replace(/^openrouter\//, "");

  return openRouterProvider(actualModel);
}
