export type AIProvider = "openrouter";

export interface AIModel {
  id: string;
  provider: AIProvider;
  label: string;
  description: string;
  contextWindow: string;
}

export const AI_MODELS: AIModel[] = [
  {
    id: "openrouter/free",
    provider: "openrouter",
    label: "Free Router",
    description: "Automatisch – wählt das beste kostenlose Modell",
    contextWindow: "200k",
  },
  {
    id: "openrouter/optimus-alpha",
    provider: "openrouter",
    label: "Optimus Alpha",
    description: "Kostenlos – stark bei realen Aufgaben & Code",
    contextWindow: "1M",
  },
  {
    id: "openrouter/quasar-alpha",
    provider: "openrouter",
    label: "Quasar Alpha",
    description: "Kostenlos – gut bei langen Dokumenten",
    contextWindow: "1M",
  },
  {
    id: "openrouter/cypher-alpha",
    provider: "openrouter",
    label: "Cypher Alpha",
    description: "Kostenlos – allgemein & Code",
    contextWindow: "1M",
  },
  {
    id: "openrouter/meta-llama/llama-4-scout",
    provider: "openrouter",
    label: "Llama 4 Scout",
    description: "Meta – kostenlos, 10M Kontext",
    contextWindow: "10M",
  },
  {
    id: "openrouter/mistralai/mistral-small-3.1-24b-instruct:free",
    provider: "openrouter",
    label: "Mistral Small 3.1",
    description: "Mistral – kostenlos, gut für einfache Dokumente",
    contextWindow: "128k",
  },
];

export const DEFAULT_MODEL_ID = "openrouter/free";

export function getModel(id: string): AIModel | undefined {
  return AI_MODELS.find((m) => m.id === id);
}

export function getModelsByProvider(provider: AIProvider): AIModel[] {
  return AI_MODELS.filter((m) => m.provider === provider);
}
