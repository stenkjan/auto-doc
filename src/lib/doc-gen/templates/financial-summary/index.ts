import { registerTemplate, type DocumentTemplate } from "../../template-registry";
import {
  FinancialSummaryDocument,
  FinancialSummaryDocumentSchema,
  DEFAULT_FINANCIAL_SUMMARY,
} from "./types";
import { generateFinancialSummaryHTML } from "./html-template";

export const financialSummaryTemplate: DocumentTemplate<FinancialSummaryDocument> =
  {
    type: "financial-summary",
    label: "Finanzzusammenfassung",
    description:
      "Finanzieller Übersichtsbericht mit Einnahmen-Ausgaben-Rechnung, KPI-Dashboard, Periodenvergleich und Trendanalyse. Ideal für Quartals- und Jahresberichte.",
    schema: FinancialSummaryDocumentSchema,
    defaultData: DEFAULT_FINANCIAL_SUMMARY,
    generateHTML: (data: FinancialSummaryDocument) =>
      generateFinancialSummaryHTML(data),
  };

export function registerFinancialSummaryTemplate() {
  registerTemplate(financialSummaryTemplate);
}
