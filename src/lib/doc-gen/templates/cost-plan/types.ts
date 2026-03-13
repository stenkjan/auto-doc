import { z } from "zod/v4";

export interface AbbruchPlot {
  grundstueckNr: string;
  laenge: number;
  breite: number;
  geschosse: number;
  geschosshoehe: number;
  preisProM3: number;
}

export interface KostengruppeEntry {
  bezeichnung: string;
  anteil: number | null;
  hinweis?: string;
}

export interface HousePhaseData {
  hausTyp: string;
  nutzflaeche: number;
  preisProM2: number;
  preisquelle: string;
  optional: boolean;
  kostengruppen: Record<string, KostengruppeEntry>;
  enthalten: string[];
  nichtEnthalten: string[];
  ergaenzend: string[];
}

export interface PartnerData {
  kostenaufteilung: string[];
  touristischeNutzung: string;
  vertragsdauer: string;
  nachVertragsablauf: string;
}

export interface TimelineEntry {
  phase: string;
  beschreibung: string;
  start: string;
  dauer: string;
  ende: string;
}

export interface KostenplanungData {
  projectRef: string;
  clientName: string;
  date: string;
  phase1: {
    plots: AbbruchPlot[];
    hinweise: string[];
  };
  phases: HousePhaseData[];
  partner: PartnerData;
  timeline: TimelineEntry[];
}

export interface ComputedAbbruchPlot extends AbbruchPlot {
  grundflaeche: number;
  bri: number;
  kosten: number;
}

export interface ComputedKostengruppe {
  kg: string;
  bezeichnung: string;
  anteil: number | null;
  betrag: number | null;
  hinweis?: string;
}

export interface ComputedHousePhase {
  phase: HousePhaseData;
  gebaeudekosten: number;
  kostengruppen: ComputedKostengruppe[];
}

export interface ComputedKostenplanung {
  data: KostenplanungData;
  phase1: {
    plots: ComputedAbbruchPlot[];
    summe: number;
  };
  phases: ComputedHousePhase[];
  gesamtkosten: number;
}

function computeHousePhase(phase: HousePhaseData): ComputedHousePhase {
  const gebaeudekosten = phase.nutzflaeche * phase.preisProM2;
  const kostengruppen: ComputedKostengruppe[] = Object.entries(
    phase.kostengruppen
  ).map(([kg, entry]) => ({
    kg,
    bezeichnung: entry.bezeichnung,
    anteil: entry.anteil,
    betrag: entry.anteil !== null ? Math.round(gebaeudekosten * entry.anteil) : null,
    hinweis: entry.hinweis,
  }));
  return { phase, gebaeudekosten, kostengruppen };
}

export function computeKostenplanung(
  data: KostenplanungData
): ComputedKostenplanung {
  const computedPlots: ComputedAbbruchPlot[] = data.phase1.plots.map(
    (plot) => {
      const grundflaeche = plot.laenge * plot.breite;
      const bri = grundflaeche * plot.geschosse * plot.geschosshoehe;
      const kosten = bri * plot.preisProM3;
      return { ...plot, grundflaeche, bri, kosten };
    }
  );

  const phase1Summe = computedPlots.reduce((sum, p) => sum + p.kosten, 0);
  const computedPhases = data.phases.map(computeHousePhase);

  const nonOptionalPhasesTotal = computedPhases
    .filter((cp) => !cp.phase.optional)
    .reduce((sum, cp) => sum + cp.gebaeudekosten, 0);

  return {
    data,
    phase1: { plots: computedPlots, summe: phase1Summe },
    phases: computedPhases,
    gesamtkosten: phase1Summe + nonOptionalPhasesTotal,
  };
}

// ---- Zod schema for validation ----

const AbbruchPlotSchema = z.object({
  grundstueckNr: z.string(),
  laenge: z.number(),
  breite: z.number(),
  geschosse: z.number(),
  geschosshoehe: z.number(),
  preisProM3: z.number(),
});

const KostengruppeEntrySchema = z.object({
  bezeichnung: z.string(),
  anteil: z.number().nullable(),
  hinweis: z.string().optional(),
});

const HousePhaseDataSchema = z.object({
  hausTyp: z.string(),
  nutzflaeche: z.number(),
  preisProM2: z.number(),
  preisquelle: z.string(),
  optional: z.boolean(),
  kostengruppen: z.record(z.string(), KostengruppeEntrySchema),
  enthalten: z.array(z.string()),
  nichtEnthalten: z.array(z.string()),
  ergaenzend: z.array(z.string()),
});

const PartnerDataSchema = z.object({
  kostenaufteilung: z.array(z.string()),
  touristischeNutzung: z.string(),
  vertragsdauer: z.string(),
  nachVertragsablauf: z.string(),
});

const TimelineEntrySchema = z.object({
  phase: z.string(),
  beschreibung: z.string(),
  start: z.string(),
  dauer: z.string(),
  ende: z.string(),
});

export const KostenplanungDataSchema = z.object({
  projectRef: z.string(),
  clientName: z.string(),
  date: z.string(),
  phase1: z.object({
    plots: z.array(AbbruchPlotSchema),
    hinweise: z.array(z.string()),
  }),
  phases: z.array(HousePhaseDataSchema),
  partner: PartnerDataSchema,
  timeline: z.array(TimelineEntrySchema),
});

// ---- Shared constants ----

const SHARED_KOSTENGRUPPEN: Record<string, KostengruppeEntry> = {
  "0": { bezeichnung: "Grund", anteil: null, hinweis: "separat" },
  "1": { bezeichnung: "Aufschließung", anteil: 0.05 },
  "2": { bezeichnung: "Bauwerk – Rohbau", anteil: 0.33 },
  "3": { bezeichnung: "Bauwerk – Technik", anteil: 0.17 },
  "4": { bezeichnung: "Bauwerk – Ausbau", anteil: 0.2 },
  "5": { bezeichnung: "Einrichtung", anteil: null, hinweis: "nach Bedarf" },
  "6": { bezeichnung: "Außenanlagen", anteil: null, hinweis: "nach Bedarf" },
  "7": { bezeichnung: "Honorare", anteil: 0.12 },
  "8": { bezeichnung: "Nebenkosten", anteil: 0.05 },
  "9": { bezeichnung: "Reserven", anteil: 0.08 },
};

const SHARED_ENTHALTEN: string[] = [
  "Bauwerkkosten (Kostenbereiche 2–4) aus Erhebung",
  "Aufschläge auf die Bauwerkkosten: ca. 2 %–10 %",
  "Bauliche Aufschließung (Kostenbereich 1)",
  "Planungs- und Projektnebenleistungen (Kostenbereiche 7 + 8): ca. 7 %–20 %",
  "Umsatzsteuer (20 %)",
];

const SHARED_NICHT_ENTHALTEN: string[] = [
  "Grundstückskosten (Kostenbereich 0)",
  "Sonstige Aufschließung (Kostenbereich 1) nach Bedarf",
  "Erschwernisse nach Bedarf",
  "Einrichtung (Kostenbereich 5) nach Bedarf",
  "Außenanlagen (Kostenbereich 6) nach Bedarf",
  "Finanzierung (anteiliger Kostenbereich 8) nach Bedarf",
  "Reserven über 8 % (Kostenbereich 9) nach Bedarf",
];

const SHARED_ERGAENZEND: string[] = [
  "Kleinere, individuell gestaltete Bauwerke (z. B. Ein- und Zweifamilienhaus) können einen Aufschlag bis zu 30 % erfordern – im Ansatz berücksichtigt",
  "Nebengeschoße mit einfacher Ausstattung (z. B. Keller): ca. 40 %–70 % der Hauptgeschoße",
  "(Tief-)Garagen: ca. 20 %–50 % der Hauptgeschoße",
];

const SHARED_PREISQUELLE =
  "Empfehlungen für Herstellungskosten 2025 (Roland Popp), Steiermark hochwertig inkl. EFH-Aufschlag";

export const DEFAULT_KOSTENPLANUNG_DATA: KostenplanungData = {
  projectRef: "KP-2025-001",
  clientName: "Projekt Arlberg Hoam",
  date: new Date().toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }),
  phase1: {
    plots: [
      {
        grundstueckNr: "1713/2",
        laenge: 14,
        breite: 20,
        geschosse: 3,
        geschosshoehe: 3.0,
        preisProM3: 40,
      },
      {
        grundstueckNr: "1723/1",
        laenge: 12,
        breite: 22,
        geschosse: 2.5,
        geschosshoehe: 3.0,
        preisProM3: 40,
      },
    ],
    hinweise: [
      "Abbruchkosten exkl. USt.",
      "Kosten inkl. Entsorgungskosten ausgehend von Baurestmassen",
      "Ohne Berücksichtigung allfälliger Beseitigung von Problemstoffen",
      "Nicht enthalten: Stilllegung Versorgungsleitungen, Abbruchbewilligung, Beweissicherung, Abbruchkonzept, Demontage/Entsorgung Inventar",
      "Kostenschätzung basierend auf: Empfehlungen für Abbruchkosten 2025, Hauptverband der Gerichtssachverständigen (Roland Popp)",
      "Bauart: Ziegelmauerwerk, frei stehendes EFH in Massivbauweise",
    ],
  },
  phases: [
    {
      hausTyp: "Hoam Haus Typ 1",
      nutzflaeche: 155,
      preisProM2: 4500,
      preisquelle: SHARED_PREISQUELLE,
      optional: false,
      kostengruppen: { ...SHARED_KOSTENGRUPPEN },
      enthalten: [...SHARED_ENTHALTEN],
      nichtEnthalten: [...SHARED_NICHT_ENTHALTEN],
      ergaenzend: [...SHARED_ERGAENZEND],
    },
    {
      hausTyp: "Hoam Haus Typ 2",
      nutzflaeche: 135,
      preisProM2: 4500,
      preisquelle: SHARED_PREISQUELLE,
      optional: true,
      kostengruppen: { ...SHARED_KOSTENGRUPPEN },
      enthalten: [...SHARED_ENTHALTEN],
      nichtEnthalten: [...SHARED_NICHT_ENTHALTEN],
      ergaenzend: [...SHARED_ERGAENZEND],
    },
    {
      hausTyp: "Hoam Haus Typ 3",
      nutzflaeche: 90,
      preisProM2: 4500,
      preisquelle: SHARED_PREISQUELLE,
      optional: true,
      kostengruppen: { ...SHARED_KOSTENGRUPPEN },
      enthalten: [...SHARED_ENTHALTEN],
      nichtEnthalten: [...SHARED_NICHT_ENTHALTEN],
      ergaenzend: [...SHARED_ERGAENZEND],
    },
  ],
  partner: {
    kostenaufteilung: [
      "Abbruch- und Erschließungskosten trägt der Grundstückseigentümer.",
      "Hoam trägt die Kosten des Hoam Hauses.",
    ],
    touristischeNutzung:
      "Projekt wird gemeinsam gestartet und touristisch genutzt. Umsätze/Gewinne nach individueller Vereinbarung aufgeschlüsselt.",
    vertragsdauer:
      "Mindestvertragsdauer 10 Jahre, danach optionale Verlängerung möglich.",
    nachVertragsablauf:
      "Hoam Haus wird abgebaut, Grundstück steht dem Eigentümer wieder frei zur Verfügung.",
  },
  timeline: [
    {
      phase: "Planung & Bewilligung",
      beschreibung: "Vorentwurf, Einreichung, Bewilligung",
      start: "März 2026",
      dauer: "6–9 Monate",
      ende: "Nov 2026",
    },
    {
      phase: "PH 1: Abbruch",
      beschreibung: "Abbruch Bestandsgebäude",
      start: "Dez 2026",
      dauer: "~2 Monate",
      ende: "Jan 2027",
    },
    {
      phase: "Aufschließung",
      beschreibung: "Grundstückserschließung",
      start: "Feb 2027",
      dauer: "2 Monate",
      ende: "März 2027",
    },
    {
      phase: "PH 2: Hoam Typ 1 – Vorproduktion",
      beschreibung: "Fertigung in Produktionsstätte",
      start: "Apr 2027",
      dauer: "4 Monate",
      ende: "Juli 2027",
    },
    {
      phase: "PH 2: Hoam Typ 1 – Aufbau",
      beschreibung: "Montage vor Ort",
      start: "Aug 2027",
      dauer: "2 Wochen",
      ende: "Aug 2027",
    },
    {
      phase: "PH 3: Hoam Typ 2 – Vorproduktion",
      beschreibung: "Fertigung in Produktionsstätte",
      start: "Aug 2027",
      dauer: "4 Monate",
      ende: "Dez 2027",
    },
    {
      phase: "PH 3: Hoam Typ 2 – Aufbau",
      beschreibung: "Montage vor Ort",
      start: "Dez 2027",
      dauer: "2 Wochen",
      ende: "Jan 2028",
    },
    {
      phase: "PH 4: Hoam Typ 3 – Vorproduktion",
      beschreibung: "Fertigung in Produktionsstätte",
      start: "Jan 2028",
      dauer: "4 Monate",
      ende: "Apr 2028",
    },
    {
      phase: "PH 4: Hoam Typ 3 – Aufbau",
      beschreibung: "Montage vor Ort",
      start: "Mai 2028",
      dauer: "2 Wochen",
      ende: "Mai 2028",
    },
  ],
};
