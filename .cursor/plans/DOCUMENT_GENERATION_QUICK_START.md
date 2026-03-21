# Document Generation Quick Start Guide

**tl;dr** — Fast reference for the auto-doc platform. Two generation pipelines, one dynamic design system.

---

## Platform Overview (2 min)

### Two Generation Pipelines

| Pipeline | Entry Point | Use When |
|---|---|---|
| **A — AI Engine** | `POST /api/doc-gen/stream` | Natural language prompt → Markdown → HTML |
| **B — Typed Templates** | `GET/POST /api/doc-gen/[id]` | Structured data with known schema |

```
Pipeline A:  Prompt ──► ai-engine.ts ──► Markdown ──► /render ──► HTML
Pipeline B:  Data   ──► template/[type]/html-template.ts ──► HTML
```

### Key Platform Files

```
src/lib/doc-gen/
├── ai-engine.ts          # buildSystemPrompt(), generateMarkdownDocument()
├── context-registry.ts   # 6 built-in contexts + custom
├── memory.ts             # Vercel Blob session memory
├── tools.ts              # propose_document_plan, validate_document, ...
├── sources/              # drive-source, github-source, mcp-source
└── templates/            # cost-plan, baukoordination, report, financial-summary
```

---

## Dynamic Design System — Key Concept

The design system is a **toolkit, not a preset**. The agent activates components based on what the content needs.

### Standard-Business Defaults

| Property | Value | Override when... |
|---|---|---|
| **Font** | Geist (Google Fonts CDN) | Never — always load via `<link>` |
| **Body font size** | `11px` | Technical/dense → `10.5px` · Presentation → `11.5px` |
| **Line height** | `1.6` | Table-heavy → `1.5` |
| **@page default** | `16mm 16mm 18mm 16mm` | Airy/letter → `20mm 20mm 22mm 20mm` · Very dense → `14mm 14mm 16mm 14mm` |
| **Primary color** | `#2F4538` (Hoam green) | CI from reference detected → override via `:root` |
| **Dark anchor** | `#1a1a1a` | Never override |
| **Section titles** | `#1a1a1a` | **Never** primary color |
| **Table header bg** | `#F4F4F4` | Never primary color |
| **Table row border** | `1px solid #f0f0f0` | |

### CSS Variables (Override System)

```css
:root {
  --color-primary:     #2F4538;  /* override to adapt CI */
  --color-dark:        #1a1a1a;
  --color-bg-subtle:   #fafafa;
  --color-bg-tint:     #eef2ff;  /* included-cards, highlights */
  --color-bg-warm:     #fff8f0;  /* excluded-cards */
  --color-border:      #e0e0e0;
  --color-border-tint: #c7d4f8;
  --color-border-warm: #efd9b4;
}
```

Agent injects overrides as `<style>:root { --color-primary: #hex; }</style>` when Design-Reasoning (Phase 3.5) identifies a different primary.

### Component Toolkit — Activate Only What Content Needs

| Component | Use only when... | Class |
|---|---|---|
| Grand total bar | Financial totals exist | `.total-bar` |
| Note cards | Included/excluded scope | `.note-card.included/.excluded/.info` |
| Source note | Citing norms, files, experts | `.source-note` |
| Summary box | KPIs / financial overview | `.summary-box` |
| Info cards | Key metrics (4 or fewer) | `.info-card` + `.info-grid` |
| Phase header | 5+ named sections | `.phase-header` + `.phase-badge` |
| Intro block | Page-level lead text | `.intro-block` (max 1× per page) |

---

## 15-Minute Template Implementation Checklist (Pipeline B)

- [ ] Define TypeScript interface in `types.ts`
- [ ] Create `DEFAULT_DATA` with realistic example
- [ ] Write `compute()` function for all calculations
- [ ] Add Geist font `<link>` to HTML `<head>`
- [ ] Build `sharedStyles()` — start from standard defaults, activate needed components
- [ ] Build `renderCoverPage()` (title → project name → meta → footer)
- [ ] Add `pageHeader()` / `pageFooter()` helpers — **hard-code company data** (no `data` param in footer)
- [ ] Create 2–3 content page functions
- [ ] Use `.total-bar` for grand total — never a table row
- [ ] Use `.note-card.included/.excluded/.info` — never `.scope-included/.scope-excluded`
- [ ] Assemble `generateHTML()` main export
- [ ] Register in `init.ts` via `registerTemplate()`
- [ ] Test with `http://localhost:3000/api/doc-gen/{id}/preview`
- [ ] Print to PDF and verify output

---

## Essential Code Template (Pipeline B)

```typescript
// MyDocumentTemplate.ts

function sharedStyles(): string {
  return `
    /* Standard-Default — adjust in Design-Reasoning based on content */
    @page { size: A4; margin: 16mm 16mm 18mm 16mm; }

    :root {
      --color-primary: #2F4538;
      --color-dark: #1a1a1a;
      --color-bg-subtle: #fafafa;
      --color-bg-tint: #eef2ff;
      --color-bg-warm: #fff8f0;
      --color-border: #e0e0e0;
      --color-border-tint: #c7d4f8;
      --color-border-warm: #efd9b4;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      line-height: 1.6;
      color: #1a1a1a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      max-width: 210mm; margin: 0 auto; padding: 24px 32px;
      break-after: page; min-height: 267mm;
      display: flex; flex-direction: column;
    }

    /* Titles: always #1a1a1a — NEVER primary color */
    .section-title    { font-size: 18px; font-weight: 800; color: #1a1a1a; margin-bottom: 4px; }
    .section-subtitle { font-size: 10.5px; color: #555; margin-bottom: 13px; }

    /* Grand total — always .total-bar, never a table row */
    .total-bar {
      background: var(--color-dark); color: #fff; border-radius: 8px;
      padding: 10px 13px; display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 11px;
    }
    .total-bar .label  { font-size: 10.5px; font-weight: 700; }
    .total-bar .amount { font-size: 19px; font-weight: 800; letter-spacing: -0.3px; }

    /* Note cards — blue-tint/amber, never green/red */
    .notes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 11px; }
    .note-card { border-radius: 7px; padding: 9px 11px; font-size: 9.5px; }
    .note-card-full { grid-column: 1 / -1; }
    .note-card h4 { font-size: 8px; font-weight: 700; text-transform: uppercase;
                    letter-spacing: 1px; margin-bottom: 6px; }
    .note-card.included { background: var(--color-bg-tint); border: 1px solid var(--color-border-tint); }
    .note-card.excluded { background: var(--color-bg-warm); border: 1px solid var(--color-border-warm); }
    .note-card.info     { background: var(--color-bg-subtle); border: 1px solid var(--color-border); }
    .note-card.included h4 { color: var(--color-primary); }
    .note-card.excluded h4 { color: #c07010; }
    .note-card.info h4     { color: #555; }
    .note-card ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 3px; }
    .note-card li { display: flex; gap: 6px; font-size: 8.5px; color: #444; }
    .note-card.included li::before { content: "✓"; color: var(--color-primary); font-weight: 700; }
    .note-card.excluded li::before { content: "○"; color: #c07010; }
    .note-card.info li::before     { content: "–"; color: #999; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 9.5px; }
    thead th {
      background: #f4f4f4; padding: 5px 8px; text-align: left;
      font-size: 7.5px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.7px; color: #888; border-bottom: 1.5px solid var(--color-border);
    }
    tbody td { padding: 5px 8px; border-bottom: 1px solid var(--color-border-light, #f0f0f0); vertical-align: top; }
    .text-right { text-align: right; white-space: nowrap; }
    .row-sum { background: var(--color-bg-tint); border-top: 1.5px solid var(--color-border-tint); }
    .row-sum td { font-weight: 700; color: #1a1a1a; }

    /* Header / Footer */
    .doc-header {
      display: flex; justify-content: space-between; align-items: flex-end;
      border-bottom: 2.5px solid var(--color-primary);
      padding-bottom: 10px; margin-bottom: 13px;
    }
    .doc-footer {
      border-top: 1px solid var(--color-border); padding-top: 8px; margin-top: auto;
      display: flex; justify-content: space-between;
      font-size: 7.5px; color: #aaa; line-height: 1.65;
    }

    @media screen {
      body { background: #c8c8c8; padding: 24px 20px; }
      .page { background: #fff; padding: 14mm; margin: 0 auto 24px;
              box-shadow: 0 8px 40px rgba(0,0,0,0.15); border-radius: 3px; }
    }
    @media print {
      body { padding: 0; background: white; }
      .page { padding: 0; max-width: none; min-height: auto; box-shadow: none; }
    }
  `;
}

function pageFooter(): string {
  // Hard-coded — no data parameter. Keeps footer consistent regardless of input.
  return `
    <div class="doc-footer">
      <div><strong>Eco Chalets GmbH</strong><br>Zösenberg 51, 8045 Weinitzen<br>FN 615495s · UID: ATU80031207</div>
      <div style="text-align:center;">Tel: +43 664 3949605<br><a href="mailto:mail@hoam-house.com">mail@hoam-house.com</a></div>
      <div style="text-align:right;"><a href="https://hoam-house.com">hoam-house.com</a></div>
    </div>`;
}

export function generateMyDocumentHTML(data: MyDocument): string {
  const computed = computeMyDocument(data);
  const pages = [renderCoverPage(data), /* ... more pages ... */];
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document – ${data.meta.projectRef}</title>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>${sharedStyles()}</style>
</head>
<body>${pages.join("\n")}</body>
</html>`;
}
```

---

## Common Patterns

### Austrian Formatting
```typescript
formatCurrency(32325);     // "€ 32.325"
formatNumber(155, 0);      // "155"
// Date: new Intl.DateTimeFormat("de-AT").format(new Date("2026-03-20")) → "20.03.2026"
```

### Table with Totals
```html
<table>
  <thead><tr><th>Position</th><th class="text-right">Betrag netto</th></tr></thead>
  <tbody>
    <!-- rows -->
    <tr class="row-sum">
      <td>Summe netto</td>
      <td class="text-right">${formatCurrency(subtotal)}</td>
    </tr>
    <tr class="row-vat">
      <td>+ 20% USt.</td>
      <td class="text-right">${formatCurrency(vat)}</td>
    </tr>
  </tbody>
</table>
<!-- Grand total — ALWAYS total-bar, NEVER a table row -->
<div class="total-bar">
  <span class="label">Gesamt brutto (inkl. 20% USt.)</span>
  <span class="amount">${formatCurrency(totalGross)}</span>
</div>
```

### Section Header
```html
<!-- Always pair section-title with section-subtitle -->
<h2 class="section-title">Haupttitel</h2>
<p class="section-subtitle">Beschreibender Untertitel oder Normreferenz</p>
```

### Page Break
```css
.page { break-after: page; }
.section-title { break-after: avoid; }
```

---

## Testing

```bash
# Typed templates
http://localhost:3000/api/doc-gen/{id}/preview

# AI streaming (Pipeline A)
POST http://localhost:3000/api/doc-gen/stream
Body: { "messages": [...], "modelId": "claude-sonnet-4-5", "contextId": "general" }

# Markdown → HTML render
POST http://localhost:3000/api/doc-gen/render
Body: { "markdown": "# Test\n\nHello..." }

# Run linter
npm run lint
```

---

## Full Documentation

See `.cursor/plans/DOCUMENT_GENERATION_ARCHITECTURE.md` (v2.0) for:
- Full platform architecture (AI engine, context system, memory, sources)
- Dynamic design system and reasoning principles
- Quality assurance checklists
- Source fingerprinting and QA gate
- Amendment mode and PATCH endpoint plan

---

## Example Implementations

- **Kostenplanung**: `src/lib/doc-gen/templates/cost-plan/`
- **Baukoordination**: `src/lib/doc-gen/templates/baukoordination/`
- **Financial Summary**: `src/lib/doc-gen/templates/financial-summary/`
- **Report**: `src/lib/doc-gen/templates/report/`

---

**Time Estimate:** 12–17 hours for a complete typed template
**AI generation:** Works immediately — provide prompt + contextId
**Design:** Dynamic — agent reasons from content, activates components as needed
