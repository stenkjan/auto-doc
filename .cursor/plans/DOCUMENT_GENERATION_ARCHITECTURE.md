# Document Generation Architecture
# Comprehensive Guide for the auto-doc Platform and AI Document Generation

---

**Purpose**: Documents the auto-doc platform architecture — from the AI engine and context system
to TypeScript templates, the dynamic design system, connectors, and memory. Serves as the
canonical reference for developers, AI agents, and template creators.

**Target Audience**: Developers extending the platform, AI systems processing document requests,
template creators, and agents using DOCUMENT_GENERATOR.md.

**Version**: 2.0.0 (March 2026)

---

## Table of Contents

1. [Core Philosophy](#1-core-philosophy)
2. [Architectural Patterns](#2-architectural-patterns)
3. [Data Modeling Strategy](#3-data-modeling-strategy)
4. [HTML Template Structure](#4-html-template-structure)
5. [Dynamic Design System](#5-dynamic-design-system)
6. [Content Extraction from Sources](#6-content-extraction-from-sources)
7. [AI Prompt Engineering](#7-ai-prompt-engineering)
8. [Quality Assurance Checklist](#8-quality-assurance-checklist)
9. [Implementation Workflow](#9-implementation-workflow)
10. [Platform Integration](#10-platform-integration)
10a. [AI Engine & Streaming](#10a-ai-engine--streaming)
10b. [Context System](#10b-context-system)
10c. [Memory System](#10c-memory-system)
10d. [Sources & Connectors](#10d-sources--connectors)
10e. [Render Route — Markdown → HTML Pipeline](#10e-render-route--markdown--html-pipeline)

---

## 1. Core Philosophy

### Design Principles

**1.1 Single Source of Truth**
- All content originates from a strongly-typed data structure
- Data → Multiple Outputs (HTML, PDF, Excel, etc.)
- Never hardcode values in templates; always reference data model

**1.2 Modular Page Architecture**
- Each page is an independent, self-contained function
- Pages can be added, removed, or reordered without breaking the document
- Shared utilities (headers, footers, styles) are centralized

**1.3 Standards-First Approach**
- Base all documents on recognized standards (ÖNORM, ÖIBA, industry best practices)
- Reference standards explicitly in the document
- Map content to standard phases/categories (e.g., ÖIBA LPH, ÖNORM KG)

**1.4 Print-Optimized from Day One**
- Design for A4 (210mm × 297mm) from the start
- Use CSS `@page` rules for proper print behavior
- Test print-to-PDF early and often


### Proven Success Patterns

From implementing Kostenplanung (8 pages) and Baukoordination (6 pages):

| Pattern | Implementation | Benefit |
|---------|----------------|---------|
| **Typed Data Models** | TypeScript interfaces for all document structures | Type safety, IDE autocomplete, validation |
| **Computation Layer** | Separate calculation functions from rendering | Testable logic, reusable across outputs |
| **Page Functions** | `renderCoverPage()`, `renderServiceDetails()`, etc. | Easy to understand, maintain, and extend |
| **Shared Styles** | Single `sharedStyles()` function returning CSS | Consistent design, single source of truth |
| **Default Data** | Complete example datasets | Testing, documentation, onboarding |

---

## 2. Architectural Patterns

### 2.0 Platform Overview

The platform operates through **two parallel generation pipelines** that share the same design system and quality standards:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     auto-doc PLATFORM                               │
│                                                                     │
│  Pipeline A: AI Engine (Prompt → Markdown → HTML)                  │
│  ─────────────────────────────────────────────────                  │
│  User Prompt ──► ai-engine.ts ──► Markdown ──► render/route.ts     │
│                  + context               └──► marked → HTML        │
│                  + memory                                           │
│                  + sources (Drive/GitHub/MCP)                       │
│                  + tools (validate, plan, ...)                      │
│                                                                     │
│  Pipeline B: Typed Templates (Data → TypeScript → HTML)            │
│  ──────────────────────────────────────────────────                 │
│  Structured Data ──► template/[type]/html-template.ts ──► HTML     │
│  (via Zod schema)    (generateHTML function)                        │
│                                                                     │
│  Both pipelines output A4-print-ready HTML served via:             │
│  /api/doc-gen/[id]  (templates)                                    │
│  /api/doc-gen/render (markdown → HTML)                             │
│  /api/doc-gen/stream (streaming AI generation)                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.1 File Structure

Full platform structure under `src/lib/doc-gen/`:

```
src/lib/doc-gen/
├── ai-engine.ts            # Core AI generation (generateMarkdownDocument, buildSystemPrompt)
├── context-registry.ts     # Client-safe context definitions (6 built-in)
├── context-registry.server.ts # Server-side context loading
├── drive-output.ts         # Google Drive upload integration
├── formatters.ts           # formatCurrency() and formatNumber() — Austrian locale
├── init.ts                 # Registers all templates via ensureTemplatesRegistered()
├── memory.ts               # Vercel Blob-backed session memory
├── models.ts               # AI model registry (Claude, Gemini, etc.)
├── template-registry.ts    # DocumentTemplate<T> interface + registry Map
├── tools.ts                # Vercel AI SDK tools for agent use
├── web-scraper.ts          # URL content extraction
│
├── contexts/               # Context markdown files (domain-specific AI instructions)
│   ├── general.md
│   ├── cost-plan.md
│   ├── baukoordination.md
│   ├── report.md
│   ├── financial-summary.md
│   └── summary.md
│
├── rules/                  # System-level instructions
│   ├── global-rules.md     # Company data, formatting, language rules
│   ├── user-permissions.md
│   └── document-types/
│       └── cost-plan.md
│
├── sources/                # External data connectors
│   ├── drive-source.ts     # Google Drive
│   ├── github-source.ts    # GitHub repositories
│   └── mcp-source.ts       # MCP servers
│
└── templates/              # Typed document generators (Pipeline B)
    ├── cost-plan/          # index.ts + types.ts + html-template.ts
    ├── baukoordination/
    ├── financial-summary/
    └── report/
```

Each template folder has exactly three files:
- `index.ts` — Registration + `DocumentTemplate<T>` export
- `types.ts` — TypeScript interfaces + Zod schema + `compute*()` + `DEFAULT_*`
- `html-template.ts` — `sharedStyles()` + page renderers + `generate*HTML()`


### 2.2 Core Modules Explained

**`types.ts`** – Data Contracts, Computations & Default Data

All three concerns are consolidated in a single file per template:

```typescript
// Interfaces
export interface DocumentData {
  meta: MetaInfo;
  content: ContentData;
  company: CompanyInfo;
  legal: LegalFramework;
}

export interface ComputedDocument {
  data: DocumentData;
  totalNet: number;
  totalGross: number;
  // ... other calculations
}

// Computation function (replaces old computations.ts)
export function computeDocument(data: DocumentData): ComputedDocument {
  // All derived values calculated here — no rendering logic
}

// Default data (replaces old defaultData.ts)
// Serves as test fixture, API documentation, and onboarding reference
export const DEFAULT_DOCUMENT: DocumentData = {
  meta: { projectRef: "DOC-2026-001", date: "2026-03-20", /* ... */ },
  content: { /* complete, realistic example data */ },
};
```

**`html-template.ts`** – Rendering Engine

```typescript
import { formatCurrency, formatNumber } from "../../formatters"; // shared utilities

function sharedStyles(): string { /* @page rule + all CSS */ }
function pageHeader(data: DocumentData): string { /* ... */ }
function pageFooter(): string { /* hard-coded company data — no parameter */ }

function renderCoverPage(data: DocumentData): string { /* ... */ }
function renderContentPage(data: DocumentData, computed: ComputedDocument): string { /* ... */ }

export function generateDocumentHTML(data: DocumentData): string {
  const computed = computeDocument(data);
  const pages = [renderCoverPage(data), renderContentPage(data, computed)];
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>${data.meta.title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>${sharedStyles()}</style>
</head>
<body>${pages.join("\n")}</body>
</html>`;
}
```

**`index.ts`** – Template Registration

```typescript
import { registerTemplate } from "../../template-registry";
import { generateDocumentHTML } from "./html-template";
import { DEFAULT_DOCUMENT, DocumentDataSchema } from "./types";

registerTemplate({
  id: "document-type",
  name: "Human Readable Name",
  generateHTML: generateDocumentHTML,
  schema: DocumentDataSchema,
  exampleData: DEFAULT_DOCUMENT,
});
```

**`src/lib/doc-gen/formatters.ts`** – Shared Austrian Formatters

```typescript
export function formatCurrency(amount: number): string;  // "€ 32.325"
export function formatNumber(n: number, decimals?: number): string;  // "1.234,56"
```

### 2.3 API Route Pattern

The unified platform serves all document types through a single dynamic route. Templates
are registered in `src/lib/doc-gen/init.ts` via `registerTemplate()` and served through
`/api/doc-gen/[id]` using the template registry.

**Unified Route** (`src/app/api/doc-gen/[id]/route.ts`)
```typescript
import { NextRequest, NextResponse } from "next/server";
import "@/lib/doc-gen/init";  // ensures all templates are registered
import { getTemplate } from "@/lib/doc-gen/template-registry";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const template = getTemplate(params.id);
  if (!template) {
    return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  }
  const html = template.generateHTML(template.exampleData);
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const template = getTemplate(params.id);
  if (!template) {
    return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  }
  try {
    const body = await request.json();
    const data = template.schema.parse(body.data ?? template.exampleData);
    const html = template.generateHTML(data);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
```

**Adding a New Template** — register in `init.ts`:
```typescript
// src/lib/doc-gen/init.ts
import "@/lib/doc-gen/templates/cost-plan";       // calls registerTemplate()
import "@/lib/doc-gen/templates/baukoordination";  // calls registerTemplate()
import "@/lib/doc-gen/templates/my-new-type";      // add here
```

---

## 3. Data Modeling Strategy

### 3.1 Hierarchical Organization

Group related data into nested interfaces:

```typescript
// ✅ Good - Organized hierarchy
interface ProjectInfo {
  name: string;
  address: string;
  type: string;
  planningBasis?: string;
}

interface DocumentData {
  project: ProjectInfo;
  // ...
}

// ❌ Bad - Flat structure
interface DocumentData {
  projectName: string;
  projectAddress: string;
  projectType: string;
  projectPlanningBasis?: string;
  // ... becomes unmaintainable
}
```


### 3.2 Array Structures for Repeated Elements

```typescript
// Services, phases, items - use arrays
interface ServicePosition {
  number: string;
  title: string;
  description: string[];  // ✅ Array for bullet points
  pricingType: "hourly" | "lumpsum" | "perUnit";
  // ... pricing fields
  netAmount: number;
}

interface DocumentData {
  services: ServicePosition[];  // ✅ Easily map to HTML
}
```

### 3.3 Pricing Flexibility Pattern

Support multiple pricing methods in one structure:

```typescript
interface ItemWithFlexiblePricing {
  pricingType: "hourly" | "lumpsum" | "perUnit" | "sqm";
  
  // Conditional fields based on type
  hours?: number;           // For "hourly"
  rate?: number;            // For "hourly" or "perUnit"
  lumpsumAmount?: number;   // For "lumpsum"
  units?: number;           // For "perUnit"
  unitPrice?: number;       // For "perUnit"
  sqm?: number;             // For "sqm"
  pricePerSqm?: number;     // For "sqm"
  
  netAmount: number;        // ✅ Always computed consistently
}

// Computation function handles all types
function calculateAmount(item: ItemWithFlexiblePricing): number {
  switch (item.pricingType) {
    case "hourly": return (item.hours || 0) * (item.rate || 0);
    case "lumpsum": return item.lumpsumAmount || 0;
    case "perUnit": return (item.units || 0) * (item.unitPrice || 0);
    case "sqm": return (item.sqm || 0) * (item.pricePerSqm || 0);
  }
}
```

### 3.4 Legal & Framework References

Always include structured legal context:

```typescript
interface LegalFramework {
  primaryStandard: string;      // e.g., "ÖNORM B 1801-1"
  secondaryStandards: string[]; // e.g., ["OIB Richtlinien", "Bauordnung"]
  disclaimer: string;           // Standard legal text
  additionalTerms: string[];    // Project-specific clauses
}
```

### 3.5 Company Branding Consistency

```typescript
interface CompanyInfo {
  name: string;
  address: string;
  contact: {
    person?: string;
    phone: string;
    email: string;
    website?: string;
  };
  registration: {
    firmenbuch?: string;  // FN number
    uid?: string;         // VAT ID
    chamberMembership?: string;
    insurance?: string;
  };
}
```


---

## 4. HTML Template Structure

### 4.1 Page Container Pattern

Every page uses consistent structure:

```html
<div class="page">
  <!-- Header (if not cover) -->
  ${pageHeader(data)}
  
  <!-- Page content -->
  <h2 class="section-title">Section Title</h2>
  <!-- ... content ... -->
  
  <!-- Footer -->
  ${pageFooter(data, pageNumber)}
</div>
```

**Key CSS for pages:**
```css
.page {
  max-width: 210mm;
  margin: 0 auto;
  padding: 24px 32px;
  break-after: page;        /* ✅ Force page break */
  position: relative;
  min-height: 297mm;        /* A4 height */
  display: flex;
  flex-direction: column;
}
```

### 4.2 Header & Footer Utilities

**Standard Header**
```typescript
function pageHeader(data: DocumentData): string {
  return `
    <div class="doc-header">
      <div class="header-logo">
        <img src="/logo.svg" alt="${data.company.name}" class="logo-img">
      </div>
      <div class="header-meta">
        <strong>${data.meta.projectRef}</strong><br>
        Datum: ${formatDate(data.meta.date)}<br>
        Projekt: ${data.project.name}
      </div>
    </div>`;
}
```

**Standard Footer** (3-column layout)
```typescript
function pageFooter(data: DocumentData, pageNum?: number): string {
  return `
    <div class="doc-footer">
      <div class="footer-left">
        <strong>${data.company.name}</strong><br>
        ${data.company.address}<br>
        ${data.company.registration.uid || ''}
      </div>
      <div class="footer-center">
        ${data.company.contact.phone}<br>
        <a href="mailto:${data.company.contact.email}">${data.company.contact.email}</a>
      </div>
      <div class="footer-right">
        ${data.company.contact.website || ''}<br>
        ${pageNum ? `Seite ${pageNum}` : ''}
      </div>
    </div>`;
}
```


### 4.3 Cover Page Pattern

```typescript
function renderCoverPage(data: DocumentData): string {
  return `
  <div class="page cover-page">
    <div class="cover-content">
      <!-- Logo (larger) -->
      <img src="/logo.svg" alt="${data.company.name}" class="cover-logo">
      
      <!-- Main title -->
      <h1 class="cover-title">${data.meta.documentTitle}</h1>
      <p class="cover-subtitle">${data.meta.documentSubtitle}</p>
      
      <!-- Project info card -->
      <div class="cover-project-info">
        <div class="cover-info-row">
          <span class="cover-label">Projekt:</span>
          <span class="cover-value">${data.project.name}</span>
        </div>
        <div class="cover-info-row">
          <span class="cover-label">Adresse:</span>
          <span class="cover-value">${data.project.address}</span>
        </div>
        <div class="cover-info-row">
          <span class="cover-label">Datum:</span>
          <span class="cover-value">${formatDate(data.meta.date)}</span>
        </div>
      </div>
      
      <!-- Legal reference -->
      <p class="cover-legal">
        Gemäß ${data.legal.primaryStandard}
      </p>
    </div>
    
    <!-- Cover footer (no page number) -->
    ${pageFooter(data)}
  </div>`;
}
```

### 4.4 Table Pattern

**Professional table structure:**

```typescript
function renderDataTable(items: Item[], computed: Computed): string {
  const rows = items.map(item => `
    <tr>
      <td class="table-center">${item.number}</td>
      <td>${item.title}</td>
      <td class="table-right">${formatCurrency(item.amount)}</td>
    </tr>
  `).join('');
  
  return `
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 60px;">Nr.</th>
          <th>Bezeichnung</th>
          <th style="width: 120px;" class="table-right">Betrag</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="row-subtotal">
          <td colspan="2" class="table-right"><strong>Summe netto</strong></td>
          <td class="table-right"><strong>${formatCurrency(computed.subtotal)}</strong></td>
        </tr>
        <tr class="row-vat">
          <td colspan="2" class="table-right">+ 20% USt</td>
          <td class="table-right">${formatCurrency(computed.vat)}</td>
        </tr>
        <tr class="row-total">
          <td colspan="2" class="table-right"><strong>Gesamt brutto</strong></td>
          <td class="table-right"><strong>${formatCurrency(computed.total)}</strong></td>
        </tr>
      </tbody>
    </table>
  `;
}
```


### 4.5 List Rendering Patterns

**Bullet Lists with Custom Markers:**

```typescript
// In data model
description: string[];  // Array of bullet points

// In template
const bullets = item.description.map(d => `<li>${d}</li>`).join('');

return `
  <div class="service-detail-block">
    <h4>${item.title}</h4>
    <ul class="service-description">
      ${bullets}
    </ul>
  </div>
`;

// CSS provides custom markers
.service-description li::before {
  content: "–";
  position: absolute;
  left: 0;
  color: #2F4538;
  font-weight: 600;
}
```

**Info Cards Grid:**

```typescript
function renderInfoCards(cards: InfoCard[]): string {
  const cardHtml = cards.map(card => `
    <div class="info-card">
      <h4 class="card-title">${card.title}</h4>
      <p class="card-content">${card.content}</p>
    </div>
  `).join('');
  
  return `
    <div class="info-grid">
      ${cardHtml}
    </div>
  `;
}

// CSS for responsive grid
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin: 16px 0;
}
```

---

## 5. Dynamic Design System

The design system is a **toolkit, not a template**. Components are activated selectively based on
content type, user instructions, and agent reasoning — not applied wholesale to every document.

### 5.0 Design-Reasoning Principle

Before generating HTML, the agent evaluates:

1. **Document type/tone** → formal business letter, technical report, presentation, contract
2. **Content signals** → heavy tables = compact margins; long prose = generous margins; financials = total-bar
3. **User instructions** → explicit style preferences override all other decisions
4. **Component necessity** → only activate components the content genuinely requires

This reasoning produces a **Design Decision Protocol** (see `DOCUMENT_GENERATOR.md §3.5`) before any HTML is written.

### 5.1 Standard Business Defaults

These values apply when no specific signals indicate otherwise:

```css
@page { size: A4; margin: 16mm 16mm 18mm 16mm; }  /* Standard */
body {
  font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
  font-size: 11px;
  line-height: 1.6;
  color: #1a1a1a;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
```

**Margin variants:**
- `16mm 16mm 18mm 16mm` — Standard default (most documents)
- `20mm 20mm 22mm 20mm` — Airy (letters, proposals, single-page)
- `14mm 14mm 16mm 14mm` — Dense (cost plans, table-heavy reports)

### 5.2 CSS Variables (Override System)

All color values use CSS custom properties so markdown content or agent overrides can adjust them:

```css
:root {
  --color-primary:      #2F4538;   /* Hoam brand green — default */
  --color-dark:         #1a1a1a;   /* Total-bar background, anchors */
  --color-text:         #1a1a1a;
  --color-text-secondary: #555;
  --color-text-muted:   #888;
  --color-text-light:   #aaa;
  --color-bg-subtle:    #fafafa;
  --color-bg-light:     #f4f4f4;
  --color-bg-tint:      #eef2ff;   /* Blue-tinted areas */
  --color-bg-warm:      #fff8f0;   /* Amber-tinted areas */
  --color-border:       #e0e0e0;
  --color-border-light: #f0f0f0;
  --color-border-tint:  #c7d4f8;
  --color-border-warm:  #efd9b4;
}
```

> **Agent override:** When Design-Reasoning identifies a different primary color (e.g., from CI
> in a reference file), inject a `<style>:root { --color-primary: [hex]; }</style>` block at the
> top of the document body. All components automatically inherit the change.

### 5.3 Typography Scale

```
Cover title:    34px / 800 / #1a1a1a / letter-spacing: -0.03em
Section title:  18–20px / 700–800 / #1a1a1a   ← NEVER primary color
Subsection:     12–13px / 700
Body:           11px / 1.6
Tables:         9.5–10.5px
Table headers:  7.5–9.5px / uppercase / muted
Footer:         7.5–9px
Source notes:   7.5px / italic
Minimum size:   7.5px (footer/sources only)
```

### 5.4 Component Toolkit

Components are **opt-in** — only include what the content requires:

| Component | When to use | Class |
|---|---|---|
| Page container | Always | `.page` |
| Document header | All pages except cover | `.doc-header` |
| Document footer | All pages | `.doc-footer` |
| **Grand total bar** | Whenever a final gross total exists | `.total-bar` |
| Note cards (scope) | Included/excluded scope sections | `.note-card.included/.excluded/.info` |
| Source note | When citing norms, files, or SVs | `.source-note` |
| Summary box | KPI dashboards, financial overviews | `.summary-box` |
| Info cards grid | Key metrics, project facts | `.info-card` + `.info-grid` |
| Phase header | Multi-phase documents (5+ sections) | `.phase-header` + `.phase-badge` |
| Intro block | Page-level lead-in text | `.intro-block` (1× per page max) |
| Table subtotal | Before VAT row | `.row-sum` |
| VAT row | After subtotal | `.row-vat` |
| N/A row | Items not yet priced | `.row-ne` |

### 5.5 Anti-Patterns

```
❌ section-title in primary color — always #1a1a1a
❌ Grand total as a table row — always .total-bar
❌ .scope-included / .scope-excluded — deprecated
❌ Green (#16a34a) or red (#dc2626) note-card titles — use blue-tint / amber
❌ @page margin: 20mm 25mm — outdated
❌ Hard-coding company address (Karmeliterplatz) — use Zösenberg 51, 8045 Weinitzen
❌ Applying all components to every document — only use what content requires
❌ Rewriting the entire file for amendments — always use targeted StrReplace
❌ Shadows in print media — @media screen only
```

---

## 6. Content Extraction from Sources

### 6.1 Reading Reference Documents

When AI extracts content from PDFs/documents:

**Chunk Large Files:**
```typescript
// For files >100k characters
const chunk1 = await readPDF(path, { offset: 0, limit: 50000 });
const chunk2 = await readPDF(path, { offset: 50000, limit: 50000 });
```

**Extract Structured Information:**
- Standards & norms (ÖNORM, ÖIBA, OIB)
- Legal clauses (AGB sections)
- Service descriptions (Leistungsbilder)
- Calculation methodologies
- Standard terms & conditions


### 6.2 Mapping Content to Data Model

**Example: ÖIBA Service Extraction**

From PDF Band 2/3 → TypeScript data:

```typescript
// PDF content (Band 3, B.2 - ÖBA):
// "Bauüberwachung und Koordination"
// "Termin- und Kostenverfolgung"
// "Qualitätskontrolle"
// "Rechnungsprüfung"

// Maps to:
{
  number: "10",
  title: "Örtliche Bauaufsicht",
  oeibPhase: "LPH 8",
  oeibReference: "B.2",
  description: [
    "Bauüberwachung und Koordination (B.2.1)",
    "Termin- und Kostenverfolgung (B.2.2)",
    "Qualitätskontrolle (B.2.3)",
    "Rechnungsprüfung (B.2.4)",
    "Übernahme und Abnahmen (B.2.6)",
    "Dokumentation (B.2.8)",
  ],
  pricingType: "hourly",
  hours: 75,
  rate: 85,
  netAmount: 6375,
}
```

### 6.3 Standards Reference Extraction

**Pattern for capturing legal framework:**

```typescript
// From multiple PDFs, extract:
interface ExtractedLegalContext {
  primaryStandard: string;      // "ÖNORM B 1801-1"
  relatedStandards: string[];   // ["ÖNORM A 2063", "ÖNORM B 2110"]
  regionalLaw: string;          // "Steiermärkische Bauordnung"
  euDirectives: string[];       // ["OIB Richtlinien 1-6"]
  agbSource: {
    name: string;               // "AGB Planung (Bundesinnung Bau)"
    version: string;            // "Ausgabe Juni 2007"
    applicableSections: string[]; // ["§ V", "§ VII", "§ IX"]
  };
}
```

### 6.4 Prompt-to-Data Extraction Logic

**User Prompt:**
```
"Angebot für Baukoordinationsarbeiten für Um- & Zubau
01 Grundlagenermittlung - Annahme 10 Stunden
02 Terminplanung - Annahme 20 stunden
03 Ausführungsplanung - Pauschalpreis 6.000€
..."
```

**AI Extraction Steps:**

1. **Identify Document Type** → `BaukoordinationAngebot`
2. **Parse Service List** → Array of 10 services
3. **Detect Pricing Patterns:**
   - "Annahme X Stunden" → `pricingType: "hourly"`
   - "Pauschalpreis X€" → `pricingType: "lumpsum"`
   - "pro Detail X€; Annahme Y Details" → `pricingType: "perUnit"`
4. **Map to ÖIBA Phases:**
   - "Grundlagenermittlung" → `LPH 1`, `B.1.1`
   - "Ausführungsplanung" → `LPH 5`, `B.1.5`
   - "Örtliche Bauaufsicht" → `LPH 8`, `B.2`
5. **Calculate Totals** → Ensure target sum (e.g., 32,000€)


---

## 7. AI Prompt Engineering

### 7.1 Structured Input Format

**For Platform AI Processing:**

```markdown
## Document Request

**Type**: [Baukoordination / Kostenplanung / Custom]

**Project Information:**
- Name: [Project Name]
- Address: [Full Address]
- Type: [Building Type]
- Planning Basis: [Reference to existing plans]

**Services Required:**
1. [Service Name] - [Pricing Method: hourly/lumpsum/perUnit] - [Details]
2. ...

**Financial Target:**
- Target Total: €X,XXX netto
- Hourly Rate: €XX/h (if applicable)

**Reference Documents:**
- [List of PDFs, links, or documents to extract content from]

**Special Requirements:**
- [Any project-specific clauses or modifications]

**Standards & Legal Framework:**
- [Applicable laws, norms, building codes]
```

### 7.2 AI Content Extraction Prompts

**Template for AI to use:**

```
Task: Extract structured data from the provided documents and user prompt to generate 
a [DOCUMENT_TYPE] document following the established template.

Input Sources:
1. User prompt with project details and service requirements
2. Reference PDFs: [list]
3. Standard templates: [applicable standards]

Output: Complete TypeScript data structure matching [INTERFACE_NAME]

Steps:
1. Parse user prompt for project metadata (name, address, date, etc.)
2. Extract service descriptions from reference PDFs (ÖIBA/ÖNORM texts)
3. Map user-specified services to standard phases (LPH 1-9)
4. Determine pricing for each service based on user input
5. Extract applicable legal clauses from AGB PDFs
6. Populate company branding from defaults
7. Calculate all totals and ensure target sum is met
8. Validate completeness of all required fields

Quality Checks:
- All services have ÖIBA/ÖNORM references
- Pricing calculations are correct
- Legal framework is complete
- Company information is present
- All arrays have content (no empty lists)
```


### 7.3 Content Quality Guidelines for AI

**Professional Tone:**
- Use formal German business language
- Reference standards explicitly (e.g., "gemäß ÖNORM B 1801-1")
- Include proper legal disclaimers
- Use industry-standard terminology

**Structure:**
- Group related services logically
- Map to recognized phases (ÖIBA LPH, ÖNORM KG)
- Provide clear service descriptions (3-5 bullet points each)
- Separate included/excluded scope

**Calculations:**
- Always show calculation basis
- Use transparent pricing tables
- Include subtotal, VAT (20%), and total
- Ensure numbers are realistic for Austrian market

**Legal Compliance:**
- Reference applicable building codes
- Include standard AGB excerpts
- Add proper disclaimers
- Cite relevant norms and standards

### 7.4 Prompt Caching Strategy (Vercel AI SDK)

To massively reduce AI token costs and TTFT (Time-To-First-Token) during iterative agentic loops (`maxSteps`), we strictly implement **Anthropic Prompt Caching**:
- **Static Context First**: `global-rules`, permissions, and extensive context files are passed in the `system` array with a `providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } }` breakpoint.
- **Large References**: Gathered context, uploaded files, and huge Markdown structures (`existingMarkdown`) in the `user` message also receive an `ephemeral` breakpoint.
- **Dynamic Content Last**: The active user query and dynamic tool calls are always appended at the very end to prevent cache invalidation.

---

## 8. Quality Assurance Checklist

### 8.1 Pre-Generation Validation

**Design System Compliance:**
- [ ] Geist font `<link>` is present in HTML `<head>`
- [ ] `@page` margin is `18mm 16mm 20mm 16mm` (not legacy `20mm 25mm`)
- [ ] Body font-size is `11px` or above
- [ ] `total-bar` component used for final gross total (not a table row)
- [ ] Note cards use unified `.note-card` system
- [ ] `pageFooter()` is parameter-free with hard-coded company data
- [ ] Header logo is `height: 32px` and wrapped in `<a href="https://hoam-house.com">`

**Data Completeness:**
- [ ] All required fields populated
- [ ] No undefined/null values in critical fields
- [ ] Arrays have minimum 1 item where required
- [ ] Dates are valid ISO strings
- [ ] All pricing amounts are numbers (not strings)

**Business Logic:**
- [ ] Total calculations are correct
- [ ] VAT is exactly 20%
- [ ] All service amounts sum to subtotal
- [ ] Hourly rate × hours = amount (for hourly items)
- [ ] Unit price × units = amount (for per-unit items)

**Standards Compliance:**
- [ ] All services mapped to ÖIBA/ÖNORM phases
- [ ] References use correct notation (e.g., "LPH 5", "B.1.1")
- [ ] Legal framework includes all required standards
- [ ] AGB references are accurate

### 8.2 Post-Generation Checks

**Visual Quality:**
- [ ] All pages render correctly (6 for Baukoordination, 8 for Kostenplanung)
- [ ] Geist font loads (check Network tab — `fonts.googleapis.com` request present)
- [ ] `total-bar` component renders for grand total (dark background, large white amount)
- [ ] Note cards use `.note-card.included/.excluded/.info` classes (not legacy scope classes)
- [ ] Section titles are dark (`#1a1a1a`), not primary brand color
- [ ] No orphaned headers (header without content)
- [ ] Tables fit on single page
- [ ] Page breaks occur at logical points
- [ ] Images/logos load successfully

**Content Accuracy:**
- [ ] All data from model appears in HTML
- [ ] Formatted numbers use Austrian locale (1.234,56)
- [ ] Dates display as DD.MM.YYYY
- [ ] Currency symbols show correctly (€)
- [ ] No template placeholders remain (${...})

**Print Quality:**
- [ ] Print preview shows proper A4 pages
- [ ] Margins are consistent
- [ ] Colors print correctly
- [ ] Text is legible at print size
- [ ] Footer appears on every page


### 8.3 TypeScript Linting

**Required Checks:**
```bash
npm run lint
```

**Common Issues to Prevent:**
- [ ] No unused imports
- [ ] No `any` types
- [ ] All function parameters typed
- [ ] No `@typescript-eslint/no-unused-vars` errors
- [ ] Proper optional chaining (`?.`) for nullable fields

**Build Validation:**
```bash
npm run build
```
- [ ] Build completes without errors
- [ ] No type mismatches
- [ ] All imports resolve correctly

---

## 9. Implementation Workflow

### 9.1 Starting a New Document Type

**Step 1: Define Data Model** (1-2 hours)
```typescript
// src/lib/{type}/types.ts
export interface {Type}Document {
  meta: MetaInfo;
  project: ProjectInfo;
  content: {Type}Content;
  company: CompanyInfo;
  legal: LegalFramework;
}
```

**Step 2: Create Default Data** (1 hour)
```typescript
// src/lib/{type}/defaultData.ts
export const DEFAULT_{TYPE}: {Type}Document = {
  // Complete example with realistic data
};
```

**Step 3: Build Computations** (1-2 hours)
```typescript
// src/lib/{type}/computations.ts
export function compute{Type}(data: {Type}Document): Computed{Type} {
  // All calculations
}
```

**Step 4: Create Page Functions** (3-4 hours)
```typescript
// src/lib/{type}/{Type}Template.ts
function renderCoverPage(data: {Type}Document): string { }
function renderContentPage1(data: {Type}Document, computed: Computed{Type}): string { }
// ... more pages
```

**Step 5: Design CSS** (2-3 hours)
```typescript
function sharedStyles(): string {
  return `
    @page { size: A4; margin: 20mm 25mm; }
    /* ... all styles ... */
  `;
}
```

**Step 6: Assemble Main Export** (30 min)
```typescript
export function generate{Type}HTML(data: {Type}Document): string {
  const computed = compute{Type}(data);
  const pages = [/* all pages */];
  return `<!DOCTYPE html>...`;
}
```

**Step 7: Create API Routes** (1 hour)
```typescript
// src/app/api/{type}/route.ts
// src/app/api/{type}/preview/route.ts
```

**Step 8: Test & Iterate** (2-3 hours)
- Run linter
- Test preview endpoint
- Print to PDF
- Adjust spacing, typography
- Verify calculations

**Total Time Estimate:** 12-17 hours for complete document type


### 9.2 Iterative Refinement Process

**First Pass: Basic Structure**
1. Get data model working
2. Render simple pages (cover + 1-2 content pages)
3. Basic CSS (no styling yet)
4. Verify data flows through

**Second Pass: Complete Content**
1. Add all pages
2. Complete all sections
3. Add tables, lists, info boxes
4. Ensure all data appears

**Third Pass: Professional Polish**
1. Refine typography (sizes, weights, spacing)
2. Add color scheme
3. Perfect table styling
4. Adjust page breaks
5. Add visual elements (borders, backgrounds)

**Fourth Pass: Print Optimization**
1. Test print-to-PDF
2. Check margins and spacing
3. Verify page breaks
4. Ensure colors print
5. Test on physical printer (if available)

**Final Pass: Quality Assurance**
1. Run full checklist (Section 8)
2. Peer review (if team)
3. Client preview (if applicable)
4. Documentation complete

---

## 10. Platform Integration

### 10.1 Registry Pattern

The unified platform maintains a template registry populated at startup via `registerTemplate()`:

```typescript
// src/lib/doc-gen/template-registry.ts
export interface DocumentTemplate<T = unknown> {
  id: string;
  name: string;
  generateHTML: (data: T) => string;
  schema: ZodSchema<T>;
  exampleData: T;
}

const registry = new Map<string, DocumentTemplate>();

export function registerTemplate<T>(template: DocumentTemplate<T>): void {
  registry.set(template.id, template as DocumentTemplate);
}

export function getTemplate(id: string): DocumentTemplate | undefined {
  return registry.get(id);
}

export function listTemplates(): DocumentTemplate[] {
  return Array.from(registry.values());
}
```

Templates self-register when their `index.ts` is imported (see Section 2.3).

### 10.2 Unified API Interface

```typescript
// src/app/api/doc-gen/[type]/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  const generator = DOCUMENT_GENERATORS[params.type];
  if (!generator) {
    return NextResponse.json({ error: "Unknown type" }, { status: 404 });
  }
  
  const body = await request.json();
  const data = body.data || generator.exampleData;
  
  if (!generator.validateData(data)) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
  
  const html = generator.generateHTML(data);
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
```


### 10.3 AI Integration Layer

**For AI Document Generation Platform:**

```typescript
// src/lib/doc-gen/ai-processor.ts
import { DOCUMENT_GENERATORS } from "./registry";

export interface AIDocumentRequest {
  userPrompt: string;           // Natural language request
  attachedFiles: string[];      // PDF paths/URLs
  documentType?: string;        // Auto-detected if not provided
  targetLanguage: string;       // "de" default
}

export async function processAIDocumentRequest(
  request: AIDocumentRequest
): Promise<{ type: string; data: unknown; html: string }> {
  
  // 1. Detect document type if not provided
  const type = request.documentType || await detectDocumentType(request.userPrompt);
  
  // 2. Extract content from attached files
  const extractedContent = await extractFromPDFs(request.attachedFiles);
  
  // 3. Use Claude API to structure data
  const structuredData = await claudeExtractStructuredData({
    prompt: request.userPrompt,
    extractedContent,
    targetInterface: DOCUMENT_GENERATORS[type].exampleData,
  });
  
  // 4. Validate structured data
  if (!DOCUMENT_GENERATORS[type].validateData(structuredData)) {
    throw new Error("AI generated invalid data structure");
  }
  
  // 5. Generate HTML
  const html = DOCUMENT_GENERATORS[type].generateHTML(structuredData);
  
  return { type, data: structuredData, html };
}
```

### 10.4 Storage & Versioning

**Hash-Based Document Storage:**

```typescript
// Like Kostenplanung pattern
import crypto from "crypto";

export function storeDocument(html: string, data: unknown): string {
  const hash = crypto.createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex")
    .substring(0, 16);
  
  // Store in database or file system
  saveToStorage(`documents/${hash}.html`, html);
  saveToStorage(`documents/${hash}.json`, JSON.stringify(data, null, 2));
  
  return hash; // Return shareable ID
}

// Access via: /api/doc-gen/view/{hash}
```

### 10.5 Multi-Format Output

**Platform supports multiple outputs from single data:**

```typescript
export interface DocumentOutputs {
  html: string;
  pdf?: Buffer;      // Puppeteer conversion
  excel?: Buffer;    // ExcelJS generation
  docx?: Buffer;     // Future: Word format
}

export async function generateAllFormats(
  type: string,
  data: unknown
): Promise<DocumentOutputs> {
  const html = DOCUMENT_GENERATORS[type].generateHTML(data);
  
  return {
    html,
    pdf: await htmlToPDF(html),
    excel: await dataToExcel(type, data),
  };
}
```

---

## 11. Key Learnings & Best Practices

### 11.1 What Works Well

✅ **Strongly Typed Data Models**
- Catches errors early
- Enables IDE autocomplete
- Self-documenting code

✅ **Modular Page Functions**
- Easy to add/remove/reorder pages
- Testable in isolation
- Clear responsibility

✅ **Computation Separation**
- Pure functions for calculations
- Reusable across formats (HTML, Excel, PDF)
- Easily testable

✅ **Default/Example Data**
- Living documentation
- Instant testing
- Onboarding new developers

✅ **CSS in Template File**
- Single file deployment
- No external CSS dependencies
- Works in email if needed


### 11.2 Common Pitfalls to Avoid

❌ **Hardcoding Values in Templates**
- Always reference data model
- Use constants for repeated values

❌ **Inline Styles in HTML**
- Keep all CSS in `sharedStyles()`
- Maintain separation of concerns

❌ **Forgetting Print Testing**
- Test print/PDF early
- Don't assume screen = print

❌ **Ignoring Austrian Conventions**
- Use correct date format (DD.MM.YYYY)
- Use correct number format (1.234,56)
- Include proper legal references

❌ **Empty Arrays/Undefined Values**
- Always provide fallbacks
- Use optional chaining (`?.`)
- Validate data before generation

❌ **Inconsistent Spacing**
- Use CSS variables or constants
- Don't mix px/rem/em randomly
- Test on different page counts

### 11.3 Performance Considerations

**HTML Generation Speed:**
- Template string concatenation is fast
- No need for complex frameworks
- Typical generation: <100ms for 6-8 pages

**Large Documents:**
- Consider pagination for 20+ pages
- Split into multiple HTML files if needed
- Use lazy loading for very large tables

**PDF Conversion:**
- Puppeteer adds ~2-3 seconds
- Consider async queue for bulk generation
- Cache generated PDFs by hash

---

## 12. Future Enhancements

### Roadmap for Platform Evolution

**Phase 1: Core Templates** ✓
- Kostenplanung (8 pages)
- Baukoordination (6 pages)
- Established patterns

**Phase 2: AI Integration** (Next)
- Claude API for content extraction
- Natural language → structured data
- Multi-document analysis

**Phase 3: Extended Formats**
- Excel generation from data model
- Word document output
- Interactive web versions

**Phase 4: Collaboration Features**
- Document versioning
- Comment/review system
- Multi-user editing

**Phase 5: Template Marketplace**
- User-created templates
- Template sharing
- Industry-specific packs


---

## 13. Reference Implementations

### 13.1 Kostenplanung Generator

**Location:** `src/lib/doc-gen/templates/cost-plan/`

**Characteristics:**
- 8-page A4 document
- ÖNORM B 1801-1 compliant
- Complex calculation model (10 cost groups)
- Multiple project phases
- Gantt chart visualization
- Excel companion file

**Key Patterns Used:**
- Array-based phase modeling
- Optional phases (flagged)
- Cost group breakdown tables
- Timeline/Gantt rendering
- Percentage-based allocations

**Best For:** Projects requiring detailed cost breakdowns, multi-phase planning

### 13.2 Baukoordination Generator

**Location:** `src/lib/doc-gen/templates/baukoordination/`

**Characteristics:**
- 6-page A4 document
- ÖIBA Leitfäden compliant
- Flexible pricing (hourly/lump/unit)
- Service-oriented structure
- Legal terms integration
- AGB references

**Key Patterns Used:**
- Service position arrays
- Mixed pricing types
- ÖIBA phase mapping (LPH 1-9)
- Legal clause integration
- Scope definition (included/excluded)

**Best For:** Service proposals, construction coordination, consulting agreements

---

## 14. Tools & Technologies

### Core Stack

| Tool | Purpose | Why |
|------|---------|-----|
| **TypeScript** | Type-safe data modeling | Prevents errors, enables autocomplete |
| **Next.js API Routes** | HTTP endpoints | Serverless, easy deployment |
| **Template Literals** | HTML generation | Fast, simple, no dependencies |
| **CSS @page** | Print layout | Standard, widely supported |
| **Intl API** | Number/date formatting | Built-in, locale-aware |

### Optional Enhancements

| Tool | Purpose | When to Use |
|------|---------|-------------|
| **Puppeteer** | HTML → PDF | Need actual PDF files (not just print) |
| **ExcelJS** | Excel generation | Editable spreadsheets required |
| **Claude API** | AI extraction | Auto-generate from documents |
| **Google Drive API** | File I/O | Document storage/sharing |

---

## 15. Testing Strategy

### 15.1 Unit Tests

```typescript
// src/lib/baukoordination/__tests__/computations.test.ts
import { computeBaukoordination, calculateServiceAmount } from "../computations";

describe("Baukoordination Computations", () => {
  it("calculates hourly service correctly", () => {
    const service = {
      pricingType: "hourly",
      hours: 10,
      rate: 85,
    };
    expect(calculateServiceAmount(service)).toBe(850);
  });
  
  it("calculates total with VAT", () => {
    const computed = computeBaukoordination(DEFAULT_BAUKOORDINATION);
    expect(computed.vat).toBe(computed.subtotalNet * 0.20);
    expect(computed.totalGross).toBe(computed.subtotalNet + computed.vat);
  });
});
```

### 15.2 Integration Tests

```typescript
// Test full HTML generation
describe("BaukoordinationTemplate", () => {
  it("generates valid HTML", () => {
    const html = generateBaukoordinationHTML(DEFAULT_BAUKOORDINATION);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
  });
  
  it("includes all 6 pages", () => {
    const html = generateBaukoordinationHTML(DEFAULT_BAUKOORDINATION);
    const pageCount = (html.match(/class="page"/g) || []).length;
    expect(pageCount).toBe(6);
  });
  
  it("renders all service positions", () => {
    const html = generateBaukoordinationHTML(DEFAULT_BAUKOORDINATION);
    DEFAULT_BAUKOORDINATION.services.forEach(s => {
      expect(html).toContain(s.title);
    });
  });
});
```


### 15.3 Visual Regression Testing

```typescript
// Using Playwright or Puppeteer
import { chromium } from "playwright";

describe("Visual Tests", () => {
  it("matches expected PDF output", async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    const html = generateBaukoordinationHTML(DEFAULT_BAUKOORDINATION);
    await page.setContent(html);
    
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
    });
    
    // Compare against baseline
    expect(pdf).toMatchPDFSnapshot();
    
    await browser.close();
  });
});
```

---

## 16. Documentation Standards

### For Each Document Type

**Required Files:**

1. **README.md** in lib folder
   - Overview
   - Usage examples
   - Data model summary

2. **{TYPE}_GUIDE.md** in docs/
   - Complete user guide
   - Business context
   - Legal/standards explanation
   - Workflow instructions

3. **Inline Comments**
   - Section separators in template
   - Complex calculation explanations
   - Non-obvious design decisions

**Example Structure:**

```typescript
/* ------------------------------------------------------------------ */
/*  Page 3: Detaillierter Leistungsumfang                            */
/*  Purpose: Show all 10 services with ÖIBA-compliant descriptions   */
/* ------------------------------------------------------------------ */

function renderServiceDetails(data: BaukoordinationAngebot): string {
  // Map services to detail blocks with custom bullets
  const serviceBlocks = data.services.map(s => {
    // ... implementation
  });
  
  // ... rest of function
}
```

---

## 17. Deployment Considerations

### 17.1 Environment Variables

```env
# .env.local
CLAUDE_API_KEY=sk-ant-...          # For AI extraction
GOOGLE_DRIVE_CREDENTIALS=...       # For file I/O
PUPPETEER_EXECUTABLE_PATH=...      # For PDF generation
```

### 17.2 Serverless Constraints

**Next.js API Routes:**
- 50MB max payload size
- 10s execution timeout (Vercel Hobby)
- 250MB max response size

**Solutions:**
- Keep documents under 5MB HTML
- Use streaming for large PDFs
- Async job queue for bulk generation

### 17.3 CDN & Caching

```typescript
// Cache generated documents by hash
export async function GET(
  request: NextRequest,
  { params }: { params: { hash: string } }
) {
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable", // 1 year
    },
  });
}
```

---

## 18. Security & Privacy

### 18.1 Data Handling

- **No PII in URLs** - Use hashes, not names/addresses
- **Sanitize Input** - Escape HTML in user-provided text
- **Validate Data** - Type check all inputs
- **Rate Limiting** - Prevent abuse of generation endpoints

### 18.2 Document Access Control

```typescript
interface DocumentAccess {
  hash: string;
  ownerUserId: string;
  createdAt: Date;
  expiresAt?: Date;
  password?: string;       // Optional password protection
  accessLog: AccessEntry[];
}

// Verify access before serving
export async function verifyAccess(hash: string, userId: string): Promise<boolean> {
  const doc = await getDocumentMetadata(hash);
  return doc.ownerUserId === userId || doc.isPublic;
}
```


---

## 19. Quick Reference

### Essential Code Snippets

**Austrian Number Formatting:**
```typescript
// Currency
new Intl.NumberFormat("de-AT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
}).format(32325); // "€ 32.325"

// Decimal
new Intl.NumberFormat("de-AT", {
  minimumFractionDigits: 2,
}).format(1234.56); // "1.234,56"

// Date
new Intl.DateTimeFormat("de-AT").format(new Date("2026-03-20")); // "20.03.2026"
```

**Page Break Control:**
```css
.page {
  break-after: page;        /* Force break after */
  break-inside: avoid;      /* Prevent breaking inside */
}

.section-title {
  break-after: avoid;       /* Keep header with content */
}
```

**Flexbox Footer Push:**
```css
.page {
  display: flex;
  flex-direction: column;
  min-height: 297mm;
}

.doc-footer {
  margin-top: auto;         /* Push to bottom */
}
```

**Conditional Rendering:**
```typescript
${data.optional ? `<div>Optional content</div>` : ''}
${data.items.length > 0 ? renderTable(data.items) : '<p>Keine Daten</p>'}
```

---

## 20. Glossary

### Austrian Construction Terms

| Term | Meaning | Usage |
|------|---------|-------|
| **ÖNORM** | Austrian Standards Institute norms | Legal compliance reference |
| **ÖIBA** | Österreichische Ingenieur- und Bauholding-Architekten | Service description guidelines |
| **OIB** | Österreichisches Institut für Bautechnik | Building regulations |
| **LPH** | Leistungsphase (Service Phase) | ÖIBA phase numbering (1-9) |
| **KG** | Kostengruppe (Cost Group) | ÖNORM cost categorization (0-9) |
| **AGB** | Allgemeine Geschäftsbedingungen | General terms & conditions |
| **ÖBA** | Örtliche Bauaufsicht | On-site construction supervision |
| **EFH** | Einfamilienhaus | Single-family house |
| **USt** | Umsatzsteuer | VAT (20% standard) |
| **FN** | Firmenbuch | Company register number |
| **UID** | Umsatzsteuer-Identifikationsnummer | VAT ID |

### Technical Terms

| Term | Meaning |
|------|---------|
| **Template Literal** | JavaScript string with embedded expressions |
| **Computation Layer** | Pure functions for calculations separate from rendering |
| **Default Data** | Example dataset for testing and documentation |
| **Hash-based Storage** | Using content hash as document identifier |
| **Print-optimized** | Designed specifically for PDF/print output |

---

## 21. Contact & Support

### For Platform Developers

**Documentation Issues:**
- Check existing implementations first (Kostenplanung, Baukoordination)
- Review this architecture document
- Consult individual TYPE_GUIDE.md files

**Implementation Questions:**
- Follow the 9-step workflow (Section 9.1)
- Use DEFAULT_DATA as template
- Test early and often with print preview

**Bug Reports:**
- Include data model that causes issue
- Provide generated HTML excerpt
- Note expected vs actual output

### Contributing New Document Types

1. Follow established file structure
2. Use TypeScript interfaces
3. Include complete default data
4. Write comprehensive tests
5. Document business context
6. Submit PR with examples

---

## 22. Conclusion

This architecture represents the dual-pipeline approach to professional document generation:
TypeScript templates for structured, typed data; and the AI engine for natural-language-driven
generation with contextual reasoning, dynamic design, and source traceability.

Key principles across both pipelines:

1. **Dynamic Design** — Design is derived from content and user intent, not imposed by a fixed template
2. **Source Traceability** — Every extracted value carries an origin tag (user input, file, calculation, norm, assumption)
3. **Quality Gates** — Validation runs after generation: spelling, number cross-checks, source conformity
4. **Modular Composition** — Pages and components are independent, activated only when needed
5. **Connector-Ready** — Drive, GitHub, MCP sources feed context into generation
6. **Memory-Enabled** — Session memory persists context across multi-turn document workflows

**Success Metrics:**
- Template generation speed: <100ms for 6-8 pages
- AI generation (streaming): 10-40 seconds depending on complexity and model
- Print quality: Professional, customer-ready on first attempt
- Amendment precision: Targeted StrReplace — no full regeneration needed

---

## 10a. AI Engine & Streaming

**Files:** `src/lib/doc-gen/ai-engine.ts`, `src/app/api/doc-gen/stream/route.ts`

The AI engine powers Pipeline A — natural language → Markdown → HTML.

### System Prompt Architecture

```typescript
export async function buildSystemPrompt(contextId?: string): Promise<SystemPart[]> {
  const globalRules = await loadContextContent("rules/global-rules.md");
  const permissions = await loadContextContent("rules/user-permissions.md");
  const context = await resolveContext(contextId ?? DEFAULT_CONTEXT_ID);
  const contextContent = context ? await loadContextContent(context.filePath) : "";

  return [
    { type: "text", text: "[Agent identity + core instructions]" },
    {
      type: "text",
      text: `--- SYSTEM CONTEXT ---\n${globalRules}\n${permissions}\n${contextContent}`,
      providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } }
      // ↑ Prompt caching — static context cached across turns
    }
  ];
}
```

### User Message with Resources

```typescript
export function buildUserMessage(
  prompt: string,
  existingMarkdown?: string,
  resources?: Resource[]
): UserPart[]
```

When `resources` are provided, a meta-block is prepended:
```
[QUELLEN: 3 Dateien]
- Datei: bericht.pdf (type: file)
- Datei: bauplanung.docx (type: file)
- URL: https://... (type: web)
---
[User prompt follows]
```

### Streaming Endpoint

`/api/doc-gen/stream` — Accepts:
```typescript
{
  messages: ModelMessage[];
  modelId: string;
  contextId?: string;
  existingMarkdown?: string;
  resources?: Resource[];
  sessionId?: string;
}
```

Uses `streamText` with `maxSteps: 5` (tool-calling agent loop) and `maxDuration: 300`.

---

## 10b. Context System

**Files:** `src/lib/doc-gen/context-registry.ts`, `src/lib/doc-gen/context-registry.server.ts`

Contexts are domain-specific markdown files that extend the system prompt with specialized knowledge.

### Built-in Contexts

| ID | Label | Specialization |
|---|---|---|
| `general` | Allgemein | General document assistant |
| `cost-plan` | Kostenplanung | ÖNORM B 1801-1 cost estimation |
| `baukoordination` | Baukoordination & ÖBA | ÖIBA LPH 1–9 coordination proposals |
| `report` | Bericht & Protokoll | Status reports, minutes, analysis |
| `financial-summary` | Finanzzusammenfassung | Financial reports, KPI dashboards |
| `summary` | Zusammenfassung & Analyse | Document summarization |

### Custom Contexts

Users can create additional contexts via `POST /api/doc-gen/contexts`:
- Stored as `.md` files in `src/lib/doc-gen/contexts/custom/`
- Full CRUD via `/api/doc-gen/contexts` (GET, POST, PUT, DELETE)
- Automatically available alongside built-in contexts

---

## 10c. Memory System

**File:** `src/lib/doc-gen/memory.ts`

Session-scoped memory backed by **Vercel Blob**. Enables multi-turn document workflows where context from earlier messages informs later ones.

```typescript
// Namespace: doc-gen/memory/{sessionId}/{key}.md
await saveMemory(sessionId, "project-context", markdownText);
const entries = await loadMemory(sessionId);
await clearMemory(sessionId);
```

**Use cases:**
- Storing extracted project metadata across multiple generation steps
- Remembering user preferences within a session
- Accumulating document iterations (changelog)

---

## 10d. Sources & Connectors

**Files:** `src/lib/doc-gen/sources/`, `src/app/api/doc-gen/sources/`

Three connector types fetch external content into document generation:

| Connector | File | Config fields |
|---|---|---|
| Google Drive | `drive-source.ts` | `folderId`, `fileTypes` |
| GitHub | `github-source.ts` | `owner`, `repo`, `path`, `branch` |
| MCP Server | `mcp-source.ts` | `serverUrl`, `toolName`, `params` |

Sources are stored in the database with full CRUD via `/api/doc-gen/sources`:
- `GET /api/doc-gen/sources` — list all
- `POST /api/doc-gen/sources` — create
- `PATCH /api/doc-gen/sources/:id` — update
- `DELETE /api/doc-gen/sources/:id` — delete

Fetching: `POST /api/doc-gen/fetch-source { sourceId, query? }` — dispatches to the right connector and returns content as a `Resource` object.

---

## 10e. Render Route — Markdown → HTML Pipeline

**File:** `src/app/api/doc-gen/render/route.ts`

Converts AI-generated Markdown to print-ready A4 HTML.

```
POST /api/doc-gen/render
Body: { markdown: string }
Returns: styled HTML document
```

### Pipeline

```
markdown string
    ↓
marked.parse() — GFM, no hard breaks
    ↓
bodyHtml string
    ↓
wrap in HTML shell with:
  - Geist font CDN link
  - documentStyles() — full CSS with :root variables
  - .doc-header (logo + company meta)
  - .page-wrapper (A4 container)
  - bodyHtml
  - .doc-footer (company data)
```

### CSS Variables in Render Route

The render route CSS exposes `:root` variables so markdown content can inject `<style>` blocks to override the design:

```html
<!-- In markdown content -->
<style>:root { --color-primary: #3D6CE1; }</style>
```

### Company Data (canonical)

```
Eco Chalets GmbH · Zösenberg 51, 8045 Weinitzen
FN 615495s · UID: ATU80031207
Tel: +43 664 3949605 · mail@hoam-house.com · hoam-house.com
```

---

**Document Version:** 2.0.0
**Last Updated:** March 21, 2026
**Status:** Production-Ready
**Next Review:** June 2026

---

## 23. Changelog — March 2026 UI & Model Tier Refactoring

### 23.1 Overview

A series of changes were made to the doc-gen UI (`src/app/doc-gen/page.tsx`), the model registry (`src/lib/doc-gen/models.ts`), and environment configuration (`.env`) to introduce:

1. **Info popovers on all dropdown items** (hover + click, with fullscreen document preview)
2. **Simplified 4-tier model selection** (replacing the raw model list)
3. **Multi-provider AI backend** (OpenRouter + Anthropic + Google Gemini)

---

### 23.2 New UI Components

**`src/app/doc-gen/_components/InfoPopover.tsx`**

Reusable ⓘ trigger button. Manages hover/pin/X-close state — not used for rendering the popover box itself (that is done inline in the panel for correct overflow/positioning), but kept as a utility reference.

**`src/app/doc-gen/_components/FullscreenDocViewer.tsx`**

Full-viewport modal that renders an iframe over the doc-gen page with:
- `backdrop-filter: blur(4px)` + dark overlay
- `iframe src` pointing to a template URL (e.g. `/api/doc-gen/baukoordination`)
- Escape key + X button close
- `z-index: 9999`

---

### 23.3 Design Dropdown — Info Buttons & Previews

Each design option now has an ⓘ button on the right of the row. Hovering or clicking shows a **176×300 portrait box** positioned to the left of the dropdown panel. The box contains a scaled-down iframe preview of the corresponding document template.

**Design → Template URL mapping:**

| Design Standard | Preview URL | Document type |
|---|---|---|
| Corporate (Fluent) | `/api/doc-gen/baukoordination` | Service proposal |
| Data-Heavy (Carbon) | `/api/doc-gen/cost-plan` | Cost plan |
| Editorial (Butterick) | `/api/doc-gen/report` | Report |
| Eigenes Design | *(text placeholder)* | N/A |

Clicking the preview box (not the X) opens `FullscreenDocViewer` with the same URL.

**Popover state pattern** (managed inline in `page.tsx`):
```typescript
const [hoveredDesignInfoId, setHoveredDesignInfoId] = useState<string | null>(null);
const [pinnedDesignInfoId, setPinnedDesignInfoId] = useState<string | null>(null);
const activeDesignInfoId = pinnedDesignInfoId ?? hoveredDesignInfoId;
// + designHideTimer ref with 200ms delay for mouse-bridge behavior
```

**Panel structure** (avoids `overflow-hidden` clipping the popover):
```
Outer panel div (position: absolute, no overflow-hidden)
├── Info box (position: absolute, right: 100%, if active)
└── Inner visual div (overflow-hidden, rounded-xl, shadow)
    └── Items with ⓘ trigger buttons
```

---

### 23.4 Model Dropdown — 4-Tier System

The raw `AI_MODELS.map()` list was replaced with **4 fixed tier items**. Same ⓘ popover pattern (176px wide, auto-height, white text on `bg-gray-700`).

**`src/app/doc-gen/page.tsx` state change:**
- Removed: `selectedModelId`, `AI_MODELS` import, `DEFAULT_MODEL_ID`
- Added: `selectedTierId` (default `"standard"`), `MODEL_TIERS` import
- `bodyRef.current.modelId` now resolved from `MODEL_TIERS.find(t => t.tierId === selectedTierId).modelId`

---

### 23.5 Model Registry — `src/lib/doc-gen/models.ts`

#### New `AIProvider` type
```typescript
export type AIProvider = "openrouter" | "anthropic" | "google";
```

#### New providers added
```typescript
// Google Gemini — uses AUTO_DOC_GEMINI_KEY
const googleProvider = createGoogleGenerativeAI({
  apiKey: process.env.AUTO_DOC_GEMINI_KEY ?? "",
});
```

#### `ModelTier` interface + `MODEL_TIERS` constant
```typescript
export interface ModelTier {
  tierId: "schnell" | "standard" | "smart" | "pro";
  label: string;
  description: string;
  modelId: string; // must exist in AI_MODELS
}
```

#### Current tier → model mapping

| Tier | Label | Model (now) | Model (when credits active) |
|---|---|---|---|
| `schnell` | SCHNELL (KOSTENLOS) | `openrouter/free` | — |
| `standard` | STANDARD | `google/gemini-2.0-flash` | — |
| `smart` | SMART | `google/gemini-1.5-pro` | `anthropic/claude-sonnet-4-5` ¹ |
| `pro` | PRO | `anthropic/claude-sonnet-4-5` | — |

¹ SMART switches to Claude Sonnet 4.5 automatically when `SMART_USE_CLAUDE=true` is set in `.env`.

#### `getLanguageModel()` — virtual `"smart"` model
```typescript
if (model.id === "smart") {
  if (process.env.SMART_USE_CLAUDE === "true" && process.env.ANTHROPIC_API_KEY?.trim()) {
    return anthropicProvider("claude-sonnet-4-5");
  }
  return googleProvider("gemini-1.5-pro");
}
```

#### `getTier()` helper
```typescript
export function getTier(tierId: string): ModelTier | undefined
```

---

### 23.6 Environment Variables Added

| Variable | Purpose | Required for |
|---|---|---|
| `AUTO_DOC_GEMINI_KEY` | Google AI Studio key | STANDARD + SMART tiers |
| `SMART_USE_CLAUDE` | `"true"` → SMART uses Claude Sonnet 4.5 | SMART tier Claude upgrade |
| `ANTHROPIC_API_KEY` | Anthropic direct API | SMART (when enabled) + PRO |

**To activate Claude Sonnet 4.5 for the SMART tier** (after adding Anthropic credits):
```env
SMART_USE_CLAUDE=true
```

---

### 23.7 New Model Entries in `AI_MODELS`

| ID | Provider | Label | Cost (input/output per 1M) |
|---|---|---|---|
| `google/gemini-2.0-flash-lite` | google | Gemini 2.0 Flash Lite | $0.075 / $0.30 |
| `google/gemini-2.0-flash` | google | Gemini 2.0 Flash | $0.10 / $0.40 |
| `google/gemini-1.5-pro` | google | Gemini 1.5 Pro | $1.25 / $5.00 |
| `smart` | google *(virtual)* | Smart (auto) | runtime-resolved |
| `anthropic/claude-3-5-haiku-20241022` | anthropic | Claude 3.5 Haiku | $0.80 / $4.00 |
| `anthropic/claude-3-5-sonnet-20241022` | anthropic | Claude 3.5 Sonnet | $3.00 / $15.00 |
| `openrouter/auto` | openrouter | Auto Router | varies |


