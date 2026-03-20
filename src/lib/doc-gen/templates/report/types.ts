import { z } from "zod/v4";

/* ------------------------------------------------------------------ */
/*  Data interfaces                                                     */
/* ------------------------------------------------------------------ */

export interface ReportTableRow {
  cells: string[];
}

export interface ReportSection {
  title: string;
  content?: string;
  items?: string[];
  table?: {
    headers: string[];
    rows: ReportTableRow[];
    footerRow?: string[];
  };
  callout?: {
    type: "info" | "warning" | "success";
    text: string;
  };
}

export interface ReportMeta {
  title: string;
  subtitle?: string;
  projectRef: string;
  date: string;
  author?: string;
  recipient?: string;
  classification?: string;
  version?: string;
}

export interface ReportDocument {
  meta: ReportMeta;
  summary?: string;
  sections: ReportSection[];
  conclusion?: string;
  appendixNotes?: string[];
}

/* ------------------------------------------------------------------ */
/*  Zod schema                                                          */
/* ------------------------------------------------------------------ */

const ReportTableRowSchema = z.object({
  cells: z.array(z.string()),
});

const ReportSectionSchema = z.object({
  title: z.string(),
  content: z.string().optional(),
  items: z.array(z.string()).optional(),
  table: z
    .object({
      headers: z.array(z.string()),
      rows: z.array(ReportTableRowSchema),
      footerRow: z.array(z.string()).optional(),
    })
    .optional(),
  callout: z
    .object({
      type: z.enum(["info", "warning", "success"]),
      text: z.string(),
    })
    .optional(),
});

const ReportMetaSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  projectRef: z.string(),
  date: z.string(),
  author: z.string().optional(),
  recipient: z.string().optional(),
  classification: z.string().optional(),
  version: z.string().optional(),
});

export const ReportDocumentSchema = z.object({
  meta: ReportMetaSchema,
  summary: z.string().optional(),
  sections: z.array(ReportSectionSchema),
  conclusion: z.string().optional(),
  appendixNotes: z.array(z.string()).optional(),
});

/* ------------------------------------------------------------------ */
/*  Default data                                                        */
/* ------------------------------------------------------------------ */

export const DEFAULT_REPORT: ReportDocument = {
  meta: {
    title: "Projektstatusbericht",
    subtitle: "Quartalsbericht Q1 2026",
    projectRef: "RPT-2026-001",
    date: new Date().toLocaleDateString("de-AT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    author: "Eco Chalets GmbH",
    recipient: "Projekt-Stakeholder",
    classification: "Intern / Vertraulich",
    version: "1.0",
  },
  summary:
    "Dieser Bericht gibt einen Überblick über den aktuellen Projektstatus, die erzielten Fortschritte im Quartal sowie die nächsten Schritte. Das Projekt befindet sich im Plan und es wurden alle wesentlichen Meilensteine erreicht.",
  sections: [
    {
      title: "Projektstatus & Fortschritt",
      content:
        "Das Projekt verläuft planmäßig. Im Q1 2026 wurden die Vorplanungsphase abgeschlossen und die Einreichplanung begonnen. Alle Schlüsselpersonen sind informiert und die nächsten Schritte abgestimmt.",
      items: [
        "Vorplanung (LPH 2): Abgeschlossen am 15.02.2026",
        "Entwurfsplanung (LPH 3): Abgeschlossen am 01.03.2026",
        "Einreichplanung (LPH 4): In Bearbeitung, Abgabe geplant für 30.04.2026",
        "Kostenschätzung aktualisiert, innerhalb Budgetrahmen",
      ],
    },
    {
      title: "Kostenübersicht",
      table: {
        headers: ["Kostengruppe", "Geplant (€)", "Aktuell (€)", "Abweichung"],
        rows: [
          { cells: ["KG 200 – Herrichten & Erschließen", "48.000", "47.200", "–800"] },
          { cells: ["KG 300 – Bauwerk Rohbau", "310.000", "314.500", "+4.500"] },
          { cells: ["KG 400 – Bauwerk Technik", "85.000", "85.000", "±0"] },
          { cells: ["KG 500 – Außenanlagen", "24.000", "22.000", "–2.000"] },
          { cells: ["KG 700 – Honorare", "65.000", "65.000", "±0"] },
        ],
        footerRow: ["Gesamt", "532.000", "533.700", "+1.700"],
      },
    },
    {
      title: "Risiken & Maßnahmen",
      items: [
        "Lieferverzögerungen Rohbaumaterial: Frühzeitige Bestellung empfohlen (Maßnahme eingeleitet)",
        "Behördliche Rückmeldung ausstehend: Laufende Kommunikation mit Gemeinde",
        "Wetterbedingte Bauverzögerungen: Puffer von 3 Wochen im Terminplan",
      ],
      callout: {
        type: "warning",
        text: "Das Risiko lieferbedingter Verzögerungen wird als mittel eingestuft. Die Maßnahmen wurden mit dem ausführenden Unternehmen abgestimmt.",
      },
    },
    {
      title: "Nächste Schritte",
      items: [
        "Fertigstellung und Einreichung Einreichplanung (bis 30.04.2026)",
        "Kick-off Meeting mit Generalunternehmer (Mai 2026)",
        "Start Ausschreibung LPH 6 (Juni 2026)",
        "Aktualisierung Terminplan nach Baubewilligung",
      ],
    },
  ],
  conclusion:
    "Das Projekt ist auf Kurs. Alle wesentlichen Qualitäts- und Terminziele wurden im Q1 2026 erreicht. Die identifizierten Risiken sind bekannt und werden aktiv gesteuert. Der nächste Statusbericht erfolgt nach Erteilung der Baugenehmigung.",
  appendixNotes: [
    "Alle Kostangaben exkl. USt. (20 %)",
    "Planungsstand: Vorentwurf vom 01.03.2026",
    "Nächstes Steuerungsmeeting: 15.04.2026",
  ],
};
