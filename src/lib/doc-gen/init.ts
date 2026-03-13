import { registerCostPlanTemplate } from "./templates/cost-plan";

let initialized = false;

export function ensureTemplatesRegistered() {
  if (initialized) return;
  registerCostPlanTemplate();
  initialized = true;
}
