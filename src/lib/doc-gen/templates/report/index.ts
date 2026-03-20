import { registerTemplate, type DocumentTemplate } from "../../template-registry";
import { ReportDocument, ReportDocumentSchema, DEFAULT_REPORT } from "./types";
import { generateReportHTML } from "./html-template";

export const reportTemplate: DocumentTemplate<ReportDocument> = {
  type: "report",
  label: "Bericht",
  description:
    "Flexibler Berichts-Generator für Statusberichte, Protokolle, Analysen und allgemeine Dokumentation. Unterstützt Textabschnitte, Aufzählungen, Tabellen und Hinweisboxen.",
  schema: ReportDocumentSchema,
  defaultData: DEFAULT_REPORT,
  generateHTML: (data: ReportDocument) => generateReportHTML(data),
};

export function registerReportTemplate() {
  registerTemplate(reportTemplate);
}
