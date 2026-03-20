export interface AIContext {
  id: string;
  label: string;
  description: string;
  filePath: string;
  custom?: boolean;
}

export const BUILTIN_CONTEXTS: AIContext[] = [
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
    id: "baukoordination",
    label: "Baukoordination & ÖBA",
    description: "Angebote für Baukoordination und ÖBA gemäß ÖIBA Leitfäden (LPH 1–9)",
    filePath: "contexts/baukoordination.md",
  },
  {
    id: "report",
    label: "Bericht & Protokoll",
    description: "Statusberichte, Protokolle, Analysen und Dokumentation",
    filePath: "contexts/report.md",
  },
  {
    id: "financial-summary",
    label: "Finanzzusammenfassung",
    description: "Finanzberichte, Controlling und KPI-Dashboards",
    filePath: "contexts/financial-summary.md",
  },
  {
    id: "summary",
    label: "Zusammenfassung & Analyse",
    description: "Dokumente zusammenfassen und strukturiert aufbereiten",
    filePath: "contexts/summary.md",
  },
];

export const AI_CONTEXTS = BUILTIN_CONTEXTS;

export const DEFAULT_CONTEXT_ID = "general";

export function getContext(id: string): AIContext | undefined {
  return BUILTIN_CONTEXTS.find((c) => c.id === id);
}
