import { z } from "zod/v4";

/* ------------------------------------------------------------------ */
/*  Data interfaces                                                     */
/* ------------------------------------------------------------------ */

export type LineItemType = "income" | "expense" | "neutral";

export interface FinancialLineItem {
  category: string;
  description: string;
  amount: number;
  type: LineItemType;
  note?: string;
}

export interface FinancialPeriod {
  label: string;
  income: number;
  expense: number;
}

export interface FinancialKPI {
  label: string;
  value: string;
  trend?: "up" | "down" | "neutral";
  note?: string;
}

export interface FinancialMeta {
  title: string;
  subtitle?: string;
  projectRef: string;
  date: string;
  period: string;
  currency?: string;
  author?: string;
}

export interface FinancialSummaryDocument {
  meta: FinancialMeta;
  executive?: string;
  lineItems: FinancialLineItem[];
  periods?: FinancialPeriod[];
  kpis?: FinancialKPI[];
  notes?: string[];
}

/* ------------------------------------------------------------------ */
/*  Computed values                                                     */
/* ------------------------------------------------------------------ */

export interface ComputedFinancialSummary {
  data: FinancialSummaryDocument;
  totalIncome: number;
  totalExpense: number;
  netResult: number;
  margin: number;
  incomeItems: FinancialLineItem[];
  expenseItems: FinancialLineItem[];
}

export function computeFinancialSummary(
  data: FinancialSummaryDocument
): ComputedFinancialSummary {
  const incomeItems = data.lineItems.filter((i) => i.type === "income");
  const expenseItems = data.lineItems.filter((i) => i.type === "expense");
  const totalIncome = incomeItems.reduce((s, i) => s + i.amount, 0);
  const totalExpense = expenseItems.reduce((s, i) => s + i.amount, 0);
  const netResult = totalIncome - totalExpense;
  const margin = totalIncome > 0 ? (netResult / totalIncome) * 100 : 0;
  return { data, totalIncome, totalExpense, netResult, margin, incomeItems, expenseItems };
}

/* ------------------------------------------------------------------ */
/*  Zod schema                                                          */
/* ------------------------------------------------------------------ */

const FinancialLineItemSchema = z.object({
  category: z.string(),
  description: z.string(),
  amount: z.number(),
  type: z.enum(["income", "expense", "neutral"]),
  note: z.string().optional(),
});

const FinancialPeriodSchema = z.object({
  label: z.string(),
  income: z.number(),
  expense: z.number(),
});

const FinancialKPISchema = z.object({
  label: z.string(),
  value: z.string(),
  trend: z.enum(["up", "down", "neutral"]).optional(),
  note: z.string().optional(),
});

const FinancialMetaSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  projectRef: z.string(),
  date: z.string(),
  period: z.string(),
  currency: z.string().optional(),
  author: z.string().optional(),
});

export const FinancialSummaryDocumentSchema = z.object({
  meta: FinancialMetaSchema,
  executive: z.string().optional(),
  lineItems: z.array(FinancialLineItemSchema),
  periods: z.array(FinancialPeriodSchema).optional(),
  kpis: z.array(FinancialKPISchema).optional(),
  notes: z.array(z.string()).optional(),
});

/* ------------------------------------------------------------------ */
/*  Default data                                                        */
/* ------------------------------------------------------------------ */

export const DEFAULT_FINANCIAL_SUMMARY: FinancialSummaryDocument = {
  meta: {
    title: "Finanzzusammenfassung",
    subtitle: "Projekt-Finanzbericht Q1 2026",
    projectRef: "FIN-2026-001",
    date: new Date().toLocaleDateString("de-AT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    period: "01.01.2026 – 31.03.2026",
    currency: "EUR",
    author: "Eco Chalets GmbH",
  },
  executive:
    "Das Quartal Q1 2026 schloss mit einem positiven Ergebnis ab. Die Einnahmen lagen im Plan, während die Ausgaben leicht unter Budget blieben. Die Liquidität ist gesichert. Das Netto-Ergebnis beträgt € 42.800 (Marge: 23,8 %).",
  lineItems: [
    { category: "Vermietung", description: "Hoam Haus Typ 1 – Saisoneinnahmen", amount: 58000, type: "income" },
    { category: "Vermietung", description: "Hoam Haus Typ 2 – Saisoneinnahmen", amount: 42000, type: "income" },
    { category: "Nebenleistungen", description: "Zusatzleistungen & Extras", amount: 9800, type: "income" },
    { category: "Vermittlungsgebühren", description: "Provisionen Buchungsplattformen", amount: 8900, type: "income" },
    { category: "Personalkosten", description: "Betriebspersonal & Hausmeister", amount: 22400, type: "expense" },
    { category: "Betriebskosten", description: "Energie, Wasser, Heizung", amount: 8600, type: "expense" },
    { category: "Reinigung & Wartung", description: "Reinigungsdienstleistungen", amount: 6200, type: "expense" },
    { category: "Marketing", description: "Online-Marketing & Plattformgebühren", amount: 4800, type: "expense" },
    { category: "Versicherung", description: "Betriebs- & Haftpflichtversicherung", amount: 2800, type: "expense" },
    { category: "Allgemeine Kosten", description: "Büro, Verwaltung, Sonstiges", amount: 3200, type: "expense" },
    { category: "Rückstellung", description: "Reparatur- & Instandhaltungsrückstellung", amount: 5000, type: "expense" },
    { category: "Zinsen", description: "Fremdkapitalzinsen", amount: 4000, type: "expense" },
  ],
  periods: [
    { label: "Q1 2025", income: 148000, expense: 99200 },
    { label: "Q2 2025", income: 172000, expense: 108400 },
    { label: "Q3 2025", income: 219000, expense: 131400 },
    { label: "Q4 2025", income: 136000, expense: 97600 },
    { label: "Q1 2026", income: 179700, expense: 136900 },
  ],
  kpis: [
    { label: "Auslastungsquote", value: "84 %", trend: "up", note: "+6 % vs. Vorjahr" },
    { label: "Durchschnittl. Tagessatz", value: "€ 285", trend: "up", note: "+12 % vs. Q1 2025" },
    { label: "Kostenkennzahl", value: "€ 76/Nacht", trend: "neutral" },
    { label: "EBITDA-Marge", value: "23,8 %", trend: "up", note: "Ziel: 20 %" },
    { label: "Liquiditätsreserve", value: "€ 84.500", trend: "neutral" },
    { label: "Investitionsquote", value: "2,8 % des Umsatzes", trend: "neutral" },
  ],
  notes: [
    "Alle Beträge in Euro (€), exkl. USt. sofern nicht anders angegeben.",
    "Abschreibungen sind nicht in den laufenden Betriebskosten enthalten.",
    "Nächste Überprüfung: 30.06.2026 (Halbjahrsbericht).",
    "Planungsbasis: Jahresbudget 2026, genehmigt durch Geschäftsführung am 15.01.2026.",
  ],
};
