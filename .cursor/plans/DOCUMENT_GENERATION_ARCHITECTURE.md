# Document Generation Architecture
# Comprehensive Guide for Building Professional PDF-Ready HTML Documents

---

**Purpose**: This document extracts the proven methodologies from Kostenplanung and Baukoordination
generators to establish a reusable architectural pattern for creating high-quality, professional
documents from structured data and AI-extracted content.

**Target Audience**: Developers building the unified document generation platform, AI systems
processing document requirements, and future template creators.

**Version**: 1.0.0 (March 2026)

---

## Table of Contents

1. [Core Philosophy](#1-core-philosophy)
2. [Architectural Patterns](#2-architectural-patterns)
3. [Data Modeling Strategy](#3-data-modeling-strategy)
4. [HTML Template Structure](#4-html-template-structure)
5. [CSS Design System](#5-css-design-system)
6. [Content Extraction from Sources](#6-content-extraction-from-sources)
7. [AI Prompt Engineering](#7-ai-prompt-engineering)
8. [Quality Assurance Checklist](#8-quality-assurance-checklist)
9. [Implementation Workflow](#9-implementation-workflow)
10. [Platform Integration](#10-platform-integration)

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

### 2.1 File Structure

Each document type lives under `src/lib/doc-gen/templates/{document-type}/` with exactly three files:

```
src/lib/doc-gen/templates/{document-type}/
├── index.ts          # Registration + DocumentTemplate<T> export via registerTemplate()
├── types.ts          # Interfaces + Zod schema + compute*() + DEFAULT_*
└── html-template.ts  # sharedStyles() + page renderers + generate*HTML()
```

> **Note:** `computations.ts`, `defaultData.ts`, and PascalCase `{DocumentType}Template.ts`
> files are **not** part of the unified platform. Computation logic and default data live
> inside `types.ts`. The template file uses kebab-case directory naming.

Shared utilities live at the `doc-gen` level:

```
src/lib/doc-gen/
├── formatters.ts          # Shared formatCurrency() and formatNumber() (Austrian locale)
├── template-registry.ts   # DocumentTemplate<T> interface + registry map
├── init.ts                # Calls registerTemplate() for each document type
└── templates/
    ├── cost-plan/
    ├── baukoordination/
    ├── financial-summary/
    └── report/
```


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

## 5. CSS Design System

### 5.1 Essential @page Rule

```css
@page {
  size: A4;                         /* 210mm × 297mm */
  margin: 18mm 16mm 20mm 16mm;      /* top right bottom left */
}
```

**Critical for:**
- Consistent, space-efficient print margins
- Proper page size in print/PDF
- Professional print appearance

> **Note:** Use `18mm 16mm 20mm 16mm` (asymmetric) — not the legacy `20mm 25mm`. The
> asymmetric value recovers ~18mm of horizontal printable space per page, enabling
> more content-dense layouts without increasing font sizes.

### 5.2 Typography Scale

Always load Geist via Google Fonts — it is the canonical document font and produces
a noticeably more professional output than system fallbacks:

```html
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

```css
/* Base */
body {
  font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  font-size: 11px;             /* Body text — do not go below 11px */
  line-height: 1.5;
  color: #1a1a1a;
}

/* Hierarchy */
.cover-title    { font-size: 36px; font-weight: 700; letter-spacing: -0.03em; } /* H1 - Cover */
.section-title  { font-size: 20px; font-weight: 700; color: #1a1a1a; }          /* H2 - NOT primary color */
.section-subtitle { font-size: 12px; color: #666; margin-bottom: 20px; }        /* Always pair with section-title */
.subsection-title { font-size: 13px; font-weight: 700; }                        /* H3 - Subsections */

/* Special contexts */
table       { font-size: 10.5px; }
.doc-footer { font-size: 9px; }
```

> **Key rule:** `.section-title` must use `color: #1a1a1a` (dark), **not** the
> primary brand color. This keeps pages readable and avoids visual noise. Use
> `.section-subtitle` beneath every major section heading for context.


### 5.3 Color Palette

**Professional & Austrian Business Standards:**

```css
:root {
  /* Primary brand color */
  --color-primary: #2F4538;      /* Professional green */
  
  /* Text colors */
  --color-text: #1a1a1a;         /* Main text */
  --color-text-secondary: #666;  /* Meta info */
  --color-text-light: #999;      /* Footer, notes */
  
  /* Background colors */
  --color-bg-table: #F4F4F4;     /* Table headers */
  --color-bg-info: #FAFAFA;      /* Info boxes */
  --color-bg-highlight: #F8F8F8; /* Totals, highlights */
  
  /* Border colors */
  --color-border: #e0e0e0;
  --color-border-light: #f0f0f0;
}

/* Application */
.section-title { color: #1a1a1a; } /* dark — NOT primary color, see 5.2 */
thead th { background: var(--color-bg-table); }
```

### 5.4 Spacing System

```css
/* Consistent spacing scale (8px base) */
.spacing-xs { margin: 4px; }
.spacing-sm { margin: 8px; }
.spacing-md { margin: 16px; }
.spacing-lg { margin: 24px; }
.spacing-xl { margin: 32px; }

/* Section spacing */
.section-title { 
  margin-top: 8px; 
  margin-bottom: 12px; 
}

.subsection-title {
  margin-top: 16px;
  margin-bottom: 8px;
}
```

### 5.5 Table Styling

```css
table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 8px;
  font-size: 10.5px;
}

thead th {
  background: #F4F4F4;
  font-weight: 600;
  text-align: left;
  padding: 6px 8px;        /* tighter than 8px 10px — saves vertical space */
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #444;
  border-bottom: 1px solid #ddd;  /* 1px — not 2px */
}

tbody td {
  padding: 5px 8px;
  border-bottom: 1px solid #f0f0f0;
  vertical-align: top;
}

/* Alignment helpers */
.text-right  { text-align: right; }
.font-semibold { font-weight: 600; }

/* Subtotal row (before VAT) */
.row-subtotal td {
  border-top: 2px solid #1a1a1a;
  padding-top: 8px;
  font-size: 11px;
}

/* Sum row (table-internal totals) */
.row-sum td {
  border-top: 2px solid #1a1a1a;
  font-weight: 700;
  padding-top: 8px;
  font-size: 11px;
}
```

> **Deprecated:** `.row-total` (table row with heavy double border + grey background)
> — this is replaced by the `total-bar` component (see 5.7). Never use a table row
> for the final gross total; use `total-bar` instead.


### 5.6 Print-Specific CSS

```css
/* Screen preview (development) */
@media screen {
  body {
    background: #e5e5e5;
    padding: 20px 0;
  }
  .page {
    background: #fff;
    box-shadow: 0 2px 20px rgba(0,0,0,0.1);
    border-radius: 4px;
    margin-bottom: 20px;
  }
}

/* Print optimization */
@media print {
  body { 
    padding: 0; 
    background: white;
  }
  .page { 
    padding: 0; 
    max-width: none; 
    min-height: auto;
    box-shadow: none;
  }
}

/* Ensure colors print */
body {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
```

### 5.7 Component Patterns

**Info Box:**
```css
.info-section {
  background: #FAFAFA;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 16px;
}
```

**Grand Total Bar** *(canonical pattern — always use instead of a table row)*:
```css
.total-bar {
  background: #1a1a1a;
  color: #fff;
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  margin-bottom: 18px;
}
.total-bar .label  { font-size: 12px; font-weight: 500; }
.total-bar .amount { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
```

Usage:
```html
<div class="total-bar">
  <span class="label">Gesamthonorar brutto (inkl. 20% USt.)</span>
  <span class="amount">${formatCurrency(computed.totalGross)}</span>
</div>
```

**Unified Note Cards** *(canonical pattern — replaces scope-included/scope-excluded)*:

Use `.note-card` with `.included`, `.excluded`, or `.info` modifiers inside a `.notes-grid`. Never use custom `scope-included` / `scope-excluded` classes.

```css
.notes-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.note-card {
  background: #FAFAFA;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 9.5px;
  line-height: 1.55;
}
.note-card-full { grid-column: 1 / -1; }  /* spans full width */
.note-card h4 {
  font-size: 10px;
  font-weight: 600;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.note-card.included h4 { color: #16a34a; }
.note-card.excluded h4 { color: #dc2626; }
.note-card.info h4     { color: var(--color-primary); }
.note-card ul { list-style: none; padding: 0; }
.note-card li { padding-left: 12px; position: relative; margin-bottom: 2px; color: #555; }
.note-card li::before { content: "–"; position: absolute; left: 0; color: #999; }
```

Usage:
```html
<div class="notes-grid">
  <div class="note-card included">
    <h4>Im Leistungsumfang enthalten</h4>
    <ul><li>…</li></ul>
  </div>
  <div class="note-card excluded">
    <h4>Nicht enthalten</h4>
    <ul><li>…</li></ul>
  </div>
  <div class="note-card info note-card-full">
    <h4>Ergänzende Angaben</h4>
    <ul><li>…</li></ul>
  </div>
</div>
```

**Visual Separator / Header-Footer:**
```css
.doc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid var(--color-primary);
  padding-bottom: 16px;
  margin-bottom: 20px;
}
.doc-header a { text-decoration: none; }   /* logo is always a link */
.logo-img { height: 32px; width: auto; }   /* header logo size */

.doc-footer {
  border-top: 1px solid #e0e0e0;
  padding-top: 12px;
  margin-top: auto;                         /* push to page bottom with flexbox */
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: #999;
}
```

> **Footer best practice:** Hard-code company data in `pageFooter()` — do not accept
> a `data` parameter. This eliminates a class of potential null-reference errors and
> keeps every footer consistent regardless of input data.

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

This architecture represents proven patterns from generating professional Austrian construction
documents. The key principles are:

1. **Data-First Design** - Structure drives everything
2. **Modular Composition** - Pages are independent units
3. **Standards Compliance** - Reference industry norms
4. **Print Optimization** - Design for A4 from start
5. **Type Safety** - TypeScript catches errors early

By following these patterns, new document types can be implemented efficiently while maintaining
high quality and professional standards.

**Success Metrics:**
- Time to implement new type: ~15 hours
- Generation speed: <100ms for 6-8 pages
- Print quality: Professional, customer-ready
- Maintenance: Minimal (data-driven)

---

**Document Version:** 1.0.0  
**Last Updated:** March 20, 2026  
**Status:** Production-Ready  
**Next Review:** June 2026

