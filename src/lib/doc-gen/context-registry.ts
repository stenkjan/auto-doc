export interface AIContext {
  id: string;
  label: string;
  description: string;
  filePath: string;
}

export const AI_CONTEXTS: AIContext[] = [
  {
    id: "general",
    label: "Allgemein",
    description: "Vielseitiger Dokumenten-Assistent ohne Fachkontext",
    filePath: "contexts/general.md",
  },
  {
    id: "cost-plan",
    label: "Kostenplanung",
    description: "Kostenschätzung gemäß ÖNORM B 1801-1",
    filePath: "contexts/cost-plan.md",
  },
  {
    id: "summary",
    label: "Zusammenfassung & Analyse",
    description: "Dokumente zusammenfassen und strukturiert aufbereiten",
    filePath: "contexts/summary.md",
  },
];

export const DEFAULT_CONTEXT_ID = "general";

export function getContext(id: string): AIContext | undefined {
  return AI_CONTEXTS.find((c) => c.id === id);
}
