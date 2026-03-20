import { registerTemplate, type DocumentTemplate } from "../../template-registry";
import {
  BaukoordinationAngebot,
  BaukoordinationAngebotSchema,
  DEFAULT_BAUKOORDINATION,
} from "./types";
import { generateBaukoordinationHTML } from "./html-template";

export const baukoordinationTemplate: DocumentTemplate<BaukoordinationAngebot> =
  {
    type: "baukoordination",
    label: "Baukoordination Angebot",
    description:
      "Leistungsangebot für Baukoordination und ÖBA gemäß ÖIBA Leitfäden (LPH 1–9), mit Honorarübersicht, Leistungsbeschreibungen und Rechtsgrundlagen.",
    schema: BaukoordinationAngebotSchema,
    defaultData: DEFAULT_BAUKOORDINATION,
    generateHTML: (data: BaukoordinationAngebot) =>
      generateBaukoordinationHTML(data),
  };

export function registerBaukoordinationTemplate() {
  registerTemplate(baukoordinationTemplate);
}
