import { registerTemplate, type DocumentTemplate } from "../../template-registry";
import { KostenplanungData, KostenplanungDataSchema, DEFAULT_KOSTENPLANUNG_DATA } from "./types";
import { generateKostenplanungHTML } from "./html-template";

export const costPlanTemplate: DocumentTemplate<KostenplanungData> = {
  type: "cost-plan",
  label: "Kostenplanung",
  description:
    "Kostenschätzung in der Vorentwurfsphase gemäß ÖNORM B 1801-1 mit Abbruchkosten, Errichtungskosten, Kostengruppen 0–9, Partnermodell und Terminplanung.",
  schema: KostenplanungDataSchema,
  defaultData: DEFAULT_KOSTENPLANUNG_DATA,
  generateHTML: (data: KostenplanungData) => generateKostenplanungHTML(data),
};

export function registerCostPlanTemplate() {
  registerTemplate(costPlanTemplate);
}
