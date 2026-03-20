import { z } from "zod/v4";

/* ------------------------------------------------------------------ */
/*  Data interfaces                                                     */
/* ------------------------------------------------------------------ */

export type PricingType = "hourly" | "lumpsum" | "perUnit";

export interface ServicePosition {
  number: string;
  title: string;
  oeibPhase: string;
  oeibReference: string;
  description: string[];
  pricingType: PricingType;
  hours?: number;
  rate?: number;
  lumpsumAmount?: number;
  units?: number;
  unitPrice?: number;
  netAmount: number;
}

export interface ProjectInfo {
  name: string;
  address: string;
  type: string;
  planningBasis?: string;
}

export interface DocumentMeta {
  projectRef: string;
  title: string;
  subtitle: string;
  date: string;
  validUntil?: string;
  version?: string;
}

export interface LegalFramework {
  primaryStandard: string;
  additionalStandards: string[];
  agbReference: string;
  disclaimer: string;
  paymentTerms: string[];
}

export interface BaukoordinationAngebot {
  meta: DocumentMeta;
  project: ProjectInfo;
  services: ServicePosition[];
  legal: LegalFramework;
}

/* ------------------------------------------------------------------ */
/*  Computed values                                                      */
/* ------------------------------------------------------------------ */

export interface ComputedBaukoordination {
  data: BaukoordinationAngebot;
  subtotalNet: number;
  vat: number;
  totalGross: number;
}

export function calculateServiceAmount(s: ServicePosition): number {
  switch (s.pricingType) {
    case "hourly":
      return (s.hours ?? 0) * (s.rate ?? 0);
    case "lumpsum":
      return s.lumpsumAmount ?? 0;
    case "perUnit":
      return (s.units ?? 0) * (s.unitPrice ?? 0);
    default:
      return s.netAmount;
  }
}

export function computeBaukoordination(
  data: BaukoordinationAngebot
): ComputedBaukoordination {
  const subtotalNet = data.services.reduce(
    (sum, s) => sum + s.netAmount,
    0
  );
  const vat = Math.round(subtotalNet * 0.2);
  const totalGross = subtotalNet + vat;
  return { data, subtotalNet, vat, totalGross };
}

/* ------------------------------------------------------------------ */
/*  Zod schema                                                          */
/* ------------------------------------------------------------------ */

const ServicePositionSchema = z.object({
  number: z.string(),
  title: z.string(),
  oeibPhase: z.string(),
  oeibReference: z.string(),
  description: z.array(z.string()),
  pricingType: z.enum(["hourly", "lumpsum", "perUnit"]),
  hours: z.number().optional(),
  rate: z.number().optional(),
  lumpsumAmount: z.number().optional(),
  units: z.number().optional(),
  unitPrice: z.number().optional(),
  netAmount: z.number(),
});

const ProjectInfoSchema = z.object({
  name: z.string(),
  address: z.string(),
  type: z.string(),
  planningBasis: z.string().optional(),
});

const DocumentMetaSchema = z.object({
  projectRef: z.string(),
  title: z.string(),
  subtitle: z.string(),
  date: z.string(),
  validUntil: z.string().optional(),
  version: z.string().optional(),
});

const LegalFrameworkSchema = z.object({
  primaryStandard: z.string(),
  additionalStandards: z.array(z.string()),
  agbReference: z.string(),
  disclaimer: z.string(),
  paymentTerms: z.array(z.string()),
});

export const BaukoordinationAngebotSchema = z.object({
  meta: DocumentMetaSchema,
  project: ProjectInfoSchema,
  services: z.array(ServicePositionSchema),
  legal: LegalFrameworkSchema,
});

/* ------------------------------------------------------------------ */
/*  Default data                                                        */
/* ------------------------------------------------------------------ */

export const DEFAULT_BAUKOORDINATION: BaukoordinationAngebot = {
  meta: {
    projectRef: "BK-2026-001",
    title: "Baukoordination Angebot",
    subtitle:
      "Leistungsangebot gemäß ÖIBA Leitfäden – Koordination und Bauaufsicht",
    date: new Date().toLocaleDateString("de-AT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    validUntil: "30.06.2026",
    version: "1.0",
  },
  project: {
    name: "Neubau EFH – Musterstraße 12, Graz",
    address: "Musterstraße 12, 8010 Graz",
    type: "Einfamilienhaus (Neubau, Massivbauweise)",
    planningBasis: "Vorentwurf vom 01.03.2026",
  },
  services: [
    {
      number: "01",
      title: "Grundlagenermittlung",
      oeibPhase: "LPH 1",
      oeibReference: "B.1.1",
      description: [
        "Erfassen der Planungsgrundlagen und Bestandsaufnahme (B.1.1.1)",
        "Klären der Aufgabenstellung und Analysieren der Einflüsse (B.1.1.2)",
        "Erstellen der Aufgabenbeschreibung (B.1.1.3)",
        "Koordination aller Planungsbeteiligten in LPH 1",
      ],
      pricingType: "hourly",
      hours: 10,
      rate: 95,
      netAmount: 950,
    },
    {
      number: "02",
      title: "Vorplanung",
      oeibPhase: "LPH 2",
      oeibReference: "B.1.2",
      description: [
        "Analysieren der Grundlagen, Abstimmen der Zielvorstellungen (B.1.2.1)",
        "Erarbeiten eines Planungskonzepts incl. Untersuchung alternativer Lösungsansätze (B.1.2.2)",
        "Integrationsplanung Tragwerk und Haustechnik",
        "Kostenrahmen gemäß ÖNORM B 1801-1, KG 200–700",
      ],
      pricingType: "hourly",
      hours: 15,
      rate: 95,
      netAmount: 1425,
    },
    {
      number: "03",
      title: "Entwurfsplanung",
      oeibPhase: "LPH 3",
      oeibReference: "B.1.3",
      description: [
        "Durcharbeiten des Planungskonzepts (B.1.3.1)",
        "Koordination aller Fachplanungen (Statik, HLS, Elektro)",
        "Kostenschätzung gemäß ÖNORM B 1801-1",
        "Abstimmen und Integrieren der Fachplanungen",
      ],
      pricingType: "hourly",
      hours: 20,
      rate: 95,
      netAmount: 1900,
    },
    {
      number: "04",
      title: "Einreichplanung",
      oeibPhase: "LPH 4",
      oeibReference: "B.1.4",
      description: [
        "Erarbeiten und Zusammenstellen der Unterlagen für die Einreichplanung (B.1.4.1)",
        "Koordination der Einreichunterlagen aller Fachplaner",
        "Einreichen des Bauansuchens bei der zuständigen Baubehörde",
        "Begleitende Verhandlungen mit der Behörde",
      ],
      pricingType: "lumpsum",
      lumpsumAmount: 2800,
      netAmount: 2800,
    },
    {
      number: "05",
      title: "Ausführungsplanung",
      oeibPhase: "LPH 5",
      oeibReference: "B.1.5",
      description: [
        "Erarbeiten der Ausführungs-, Detail- und Konstruktionspläne (B.1.5.1)",
        "Koordination der Ausführungspläne aller Fachplaner",
        "Übergabe der Pläne an ausführende Unternehmen",
        "Planfortschreibung und Änderungsmanagement",
      ],
      pricingType: "hourly",
      hours: 25,
      rate: 95,
      netAmount: 2375,
    },
    {
      number: "06",
      title: "Ausschreibung",
      oeibPhase: "LPH 6",
      oeibReference: "B.1.6",
      description: [
        "Ermitteln und Zusammenstellen von Mengen als Grundlage für das Leistungsverzeichnis (B.1.6.1)",
        "Aufstellen von Leistungsverzeichnissen (B.1.6.2)",
        "Koordination LV aller Fachgewerke",
        "Kostenschätzung Errichtungskosten",
      ],
      pricingType: "lumpsum",
      lumpsumAmount: 3200,
      netAmount: 3200,
    },
    {
      number: "07",
      title: "Vergabe",
      oeibPhase: "LPH 7",
      oeibReference: "B.1.7",
      description: [
        "Auswerten und Zusammenstellen der Angebote (B.1.7.1)",
        "Preisspiegel und Vergabevorschlag",
        "Vorbereiten und Mitwirken bei Vergabeverhandlungen",
        "Kostenkontrolle Vergabe vs. Kostenschätzung",
      ],
      pricingType: "hourly",
      hours: 15,
      rate: 95,
      netAmount: 1425,
    },
    {
      number: "08",
      title: "Örtliche Bauaufsicht (ÖBA)",
      oeibPhase: "LPH 8",
      oeibReference: "B.2",
      description: [
        "Bauüberwachung und Koordination der ausführenden Unternehmen (B.2.1)",
        "Termin- und Kostenverfolgung (B.2.2)",
        "Qualitätskontrolle der ausgeführten Leistungen (B.2.3)",
        "Rechnungsprüfung und Massenermittlung (B.2.4)",
        "Übernahme und Abnahmen (B.2.6)",
        "Baudokumentation und Fotodokumentation (B.2.8)",
      ],
      pricingType: "hourly",
      hours: 75,
      rate: 85,
      netAmount: 6375,
    },
    {
      number: "09",
      title: "Dokumentation & Projektabschluss",
      oeibPhase: "LPH 9",
      oeibReference: "B.3",
      description: [
        "Zusammenstellen der Dokumentationsunterlagen (B.3.1)",
        "Übergabe der Bestandspläne und technischen Unterlagen",
        "Abschlussbericht und Kostenfeststellung gemäß ÖNORM B 1801-1",
        "Mängelmanagement in der Gewährleistungsphase",
      ],
      pricingType: "perUnit",
      units: 4,
      unitPrice: 380,
      netAmount: 1520,
    },
    {
      number: "10",
      title: "Bauleitung (zusätzlich)",
      oeibPhase: "LPH 8",
      oeibReference: "B.2.5",
      description: [
        "Koordination der Baustellenlogistik",
        "Anwesenheit vor Ort bei Schlüsselgewerken",
        "Protokollierung von Baubesprechungen",
      ],
      pricingType: "lumpsum",
      lumpsumAmount: 2800,
      netAmount: 2800,
    },
  ],
  legal: {
    primaryStandard: "ÖIBA Leitfaden Band 2 & 3",
    additionalStandards: [
      "ÖNORM B 1801-1 (Kostengliederung)",
      "ÖNORM B 2110 (Allgemeine Vertragsbestimmungen)",
      "OIB Richtlinien 1–6",
      "Steiermärkische Bauordnung 2017 i.d.g.F.",
    ],
    agbReference:
      "AGB Planung (Bundesinnung Bau, Ausgabe Juni 2007), §§ V, VII, IX",
    disclaimer:
      "Dieses Angebot wurde nach bestem Wissen auf Basis der vorliegenden Planungsunterlagen erstellt. Stundensätze gelten für die Planungsleistungen eines qualifizierten Fachplaners (Architekt/ZT). Änderungen im Planungsumfang, unvorhergesehene Erschwernisse oder Änderungen durch den Auftraggeber können zu Mehrkosten führen und sind gesondert zu vereinbaren.",
    paymentTerms: [
      "Abschlagsrechnung nach Abschluss jeder Leistungsphase (30 Tage netto)",
      "Schlussrechnung nach vollständiger Fertigstellung (14 Tage netto)",
      "Skontoabzug ausgeschlossen",
    ],
  },
};
