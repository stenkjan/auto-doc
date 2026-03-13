export type AIProvider = "anthropic" | "openrouter" | "gemini";

export interface AIModel {
  id: string;
  provider: AIProvider;
  label: string;
  description: string;
  contextWindow: string;
}

export const AI_MODELS: AIModel[] = [
  // Anthropic (direct)
  {
    id: "claude-sonnet-4-20250514",
    provider: "anthropic",
    label: "Claude Sonnet 4",
    description: "Schnell & günstig – empfohlen für die meisten Dokumente",
    contextWindow: "200k",
  },
  {
    id: "claude-opus-4-5",
    provider: "anthropic",
    label: "Claude Opus 4.5",
    description: "Stärkste Claude-Version – für komplexe Dokumente",
    contextWindow: "200k",
  },

  // Google Gemini (direct)
  {
    id: "gemini-2.5-pro-preview-03-25",
    provider: "gemini",
    label: "Gemini 2.5 Pro",
    description: "Google – stark bei strukturierten Daten & langen Texten",
    contextWindow: "1M",
  },
  {
    id: "gemini-2.0-flash",
    provider: "gemini",
    label: "Gemini 2.0 Flash",
    description: "Google – sehr schnell & kostengünstig",
    contextWindow: "1M",
  },

  // OpenRouter (access to many models via one key)
  {
    id: "openrouter/anthropic/claude-sonnet-4",
    provider: "openrouter",
    label: "Claude Sonnet 4 (via OpenRouter)",
    description: "Claude über OpenRouter – flexibles Billing",
    contextWindow: "200k",
  },
  {
    id: "openrouter/google/gemini-2.5-pro-preview-03-25",
    provider: "openrouter",
    label: "Gemini 2.5 Pro (via OpenRouter)",
    description: "Gemini über OpenRouter – flexibles Billing",
    contextWindow: "1M",
  },
  {
    id: "openrouter/meta-llama/llama-4-scout",
    provider: "openrouter",
    label: "Llama 4 Scout (via OpenRouter)",
    description: "Meta – kostenlos verfügbar, gute Qualität",
    contextWindow: "10M",
  },
  {
    id: "openrouter/mistralai/mistral-small-3.1-24b-instruct",
    provider: "openrouter",
    label: "Mistral Small 3.1 (via OpenRouter)",
    description: "Mistral – sehr günstig, gut für einfache Dokumente",
    contextWindow: "128k",
  },
];

export const DEFAULT_MODEL_ID = "claude-sonnet-4-20250514";

export function getModel(id: string): AIModel | undefined {
  return AI_MODELS.find((m) => m.id === id);
}

export function getModelsByProvider(provider: AIProvider): AIModel[] {
  return AI_MODELS.filter((m) => m.provider === provider);
}
