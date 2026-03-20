import { registerCostPlanTemplate } from "./templates/cost-plan";
import { registerBaukoordinationTemplate } from "./templates/baukoordination";
import { registerReportTemplate } from "./templates/report";
import { registerFinancialSummaryTemplate } from "./templates/financial-summary";

let initialized = false;

export function ensureTemplatesRegistered() {
  if (initialized) return;
  registerCostPlanTemplate();
  registerBaukoordinationTemplate();
  registerReportTemplate();
  registerFinancialSummaryTemplate();
  initialized = true;
}
