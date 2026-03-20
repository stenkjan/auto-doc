import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type AIProvider = "openrouter" | "anthropic";

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
  // ── Paid models (Anthropic direct) ─────────────────────────────────
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
/*  Vercel AI SDK Language Model Provider                               */
/* ------------------------------------------------------------------ */

const anthropicProvider = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
});

const openRouterProvider = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  baseURL: "https://openrouter.ai/api/v1",
  headers: {
    "HTTP-Referer": "https://hoam-house.com",
    "X-Title": "Auto Doc Generator",
  },
});

/**
 * Get a Vercel AI SDK LanguageModel instance for a given model ID.
 */
export function getLanguageModel(modelId: string): LanguageModel {
  const model = getModel(modelId);
  if (!model) throw new Error(`Unbekanntes Modell: ${modelId}`);

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
