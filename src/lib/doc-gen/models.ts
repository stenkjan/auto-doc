export type AIProvider = "openrouter" | "anthropic";

export interface AIModel {
  id: string;
  provider: AIProvider;
  label: string;
  description: string;
  contextWindow: string;
  paid?: boolean;
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
  },
  {
    id: "anthropic/claude-opus-4-5",
    provider: "anthropic",
    label: "Claude Opus 4.5",
    description: "Maximale Qualität – für komplexe Dokumente",
    contextWindow: "200k",
    paid: true,
  },
  // ── Paid models (via OpenRouter) ────────────────────────────────────
  {
    id: "openrouter/anthropic/claude-sonnet-4-5",
    provider: "openrouter",
    label: "Claude Sonnet 4.5 (OR)",
    description: "Claude Sonnet via OpenRouter – kein separater API Key nötig",
    contextWindow: "200k",
    paid: true,
  },
  {
    id: "openrouter/openai/gpt-4o",
    provider: "openrouter",
    label: "GPT-4o",
    description: "OpenAI – stark bei strukturierten Dokumenten",
    contextWindow: "128k",
    paid: true,
  },
];

export const DEFAULT_MODEL_ID = "openrouter/free";

export function getModel(id: string): AIModel | undefined {
  return AI_MODELS.find((m) => m.id === id);
}

export function getModelsByProvider(provider: AIProvider): AIModel[] {
  return AI_MODELS.filter((m) => m.provider === provider);
}
