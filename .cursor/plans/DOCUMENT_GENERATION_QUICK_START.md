# Document Generation Quick Start Guide

**tl;dr** - Fast reference for implementing new document types using established patterns.

## 5-Minute Overview

### What We Built

Two production-ready document generators:
1. **Kostenplanung** (8 pages) - ÖNORM B 1801-1 cost estimation
2. **Baukoordination** (6 pages) - ÖIBA construction coordination proposal

Both follow identical architectural patterns for consistency and maintainability.

### Core Pattern

```
Data Model → Computations → Page Functions → CSS → HTML Output
```

**Key Files (per template in `src/lib/doc-gen/templates/{type}/`):**
- `index.ts` - Registration + `DocumentTemplate<T>` export
- `types.ts` - TypeScript interfaces + Zod schema + `compute*()` + `DEFAULT_*`
- `html-template.ts` - `sharedStyles()` + page renderers + `generate*HTML()`

---

## Design System Reference

All document generators share the same base design system:

| Property | Value | Notes |
|---|---|---|
| **Font** | Geist (Google Fonts CDN) | Always load via `<link>` in `<head>` |
| **Body font size** | `11px` | |
| **Line height** | `1.5` | |
| **@page margins** | `18mm 16mm 20mm 16mm` | Top / Right / Bottom / Left |
| **Page min-height** | `297mm` | A4 height |
| **Kostenplanung primary** | `#3D6CE1` | Blue |
| **Baukoordination primary** | `#2F4538` | Forest green |
| **Dark text** | `#1a1a1a` | |
| **Muted text** | `#666` | Section subtitles |
| **Table header bg** | `#F4F4F4` | |
| **Table border** | `1px solid #f0f0f0` | Rows (not headers) |

---

## 15-Minute Implementation Checklist

- [ ] Define TypeScript interface in `types.ts`
- [ ] Create `DEFAULT_DATA` with realistic example
- [ ] Write `compute()` function for calculations
- [ ] Add Geist font `<link>` to HTML `<head>`
- [ ] Build `sharedStyles()` with `@page` rule (use canonical margins)
- [ ] Build `renderCoverPage()` function (title → project name → meta → subtitle)
- [ ] Add page `header()` / `footer()` helpers (hard-code company data)
- [ ] Create 2–3 content page functions
- [ ] Use `total-bar` for grand total display
- [ ] Use `.note-card.included/.excluded/.info` for scope breakdowns
- [ ] Assemble `generateHTML()` main export
- [ ] Register template in `init.ts` via `registerTemplate()`
- [ ] Test with `http://localhost:3000/api/doc-gen/{id}/preview`
- [ ] Print to PDF and verify output

---

## Essential Code Template

```typescript
// MyDocumentTemplate.ts

function sharedStyles(): string {
  return `
    @page { size: A4; margin: 18mm 16mm 20mm 16mm; }

    body {
      font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #1a1a1a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      max-width: 210mm; margin: 0 auto; padding: 24px 32px;
      break-after: page; min-height: 297mm;
      display: flex; flex-direction: column;
    }

    /* Section titles: dark, not primary color */
    .section-title  { font-size: 20px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.02em; margin-bottom: 4px; }
    .section-subtitle { font-size: 12px; color: #666; margin-bottom: 20px; }

    /* Grand total block */
    .total-bar {
      background: #1a1a1a; color: #fff; border-radius: 8px;
      padding: 12px 16px; display: flex; justify-content: space-between;
      align-items: center; margin-top: 16px;
    }
    .total-bar .label  { font-size: 12px; font-weight: 500; }
    .total-bar .amount { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }

    /* Scope / note cards */
    .notes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .note-card {
      background: #FAFAFA; border: 1px solid #eee; border-radius: 8px;
      padding: 10px 12px; font-size: 9.5px; line-height: 1.55;
    }
    .note-card-full { grid-column: 1 / -1; }
    .note-card h4 { font-size: 10px; font-weight: 600; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.3px; }
    .note-card.included h4 { color: #16a34a; }
    .note-card.excluded h4 { color: #dc2626; }
    .note-card.info h4     { color: var(--color-primary, #3D6CE1); }
    .note-card ul { list-style: none; padding: 0; }
    .note-card li { padding-left: 12px; position: relative; margin-bottom: 2px; color: #555; }
    .note-card li::before { content: "–"; position: absolute; left: 0; color: #999; }

    /* Footer */
    .doc-footer {
      border-top: 1px solid #e0e0e0; padding-top: 12px; margin-top: auto;
      display: flex; justify-content: space-between; align-items: flex-end;
      font-size: 9px; color: #999; line-height: 1.6;
    }

    /* Screen preview */
    @media screen {
      body { background: #e5e5e5; padding: 20px 0; }
      .page { background: #fff; box-shadow: 0 2px 20px rgba(0,0,0,0.1); border-radius: 4px; margin-bottom: 20px; }
    }
  `;
}

function pageHeader(data: MyDocument): string {
  return `
    <div class="doc-header">
      <a href="https://hoam-house.com" title="Hoam">
        <img src="/0-homebutton-nest-haus.svg" alt="Hoam" class="logo-img" style="height:32px;">
      </a>
      <div class="header-meta" style="text-align:right; font-size:10px; color:#666;">
        <strong>${data.meta.projectRef}</strong><br>
        Datum: ${data.meta.date}
      </div>
    </div>`;
}

function pageFooter(): string {
  return `
    <div class="doc-footer">
      <div><strong>Eco Chalets GmbH</strong><br>Karmeliterplatz 8, 8010 Graz<br>FN 615495s · UID: ATU80031207</div>
      <div style="text-align:center;">Tel: +43 (0) 664 3949605<br><a href="mailto:mail@hoam-house.com">mail@hoam-house.com</a></div>
      <div style="text-align:right;"><a href="https://hoam-house.com">hoam-house.com</a></div>
    </div>`;
}

function renderCoverPage(data: MyDocument): string {
  return `
  <div class="page cover-page" style="display:flex;flex-direction:column;align-items:center;text-align:center;">
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;">
      <img src="/0-homebutton-nest-haus.svg" alt="Hoam" style="height:64px;margin-bottom:40px;">
      <h1 style="font-size:36px;font-weight:700;color:#1a1a1a;letter-spacing:-0.03em;margin-bottom:12px;">
        Document Title
      </h1>
      <p style="font-size:18px;font-weight:500;color:var(--color-primary);margin-bottom:24px;">
        ${data.project.name}
      </p>
      <div style="font-size:12px;color:#666;line-height:1.8;margin-bottom:32px;">
        <p>Referenz: ${data.meta.projectRef}</p>
        <p>Datum: ${data.meta.date}</p>
      </div>
      <p style="font-size:13px;color:#999;font-style:italic;">Subtitle / standard reference</p>
    </div>
    ${pageFooter()}
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
formatDate("2026-03-20");  // "20.03.2026"
```

### Table with Totals Row
```html
<table>
  <thead>
    <tr><th>Item</th><th class="text-right">Betrag</th></tr>
  </thead>
  <tbody>
    <!-- rows -->
    <tr class="row-sum">
      <td>Summe netto</td>
      <td class="text-right">${formatCurrency(subtotal)}</td>
    </tr>
  </tbody>
</table>

<!-- Grand total — always use total-bar, not a table row -->
<div class="total-bar">
  <span class="label">Gesamt brutto (inkl. 20% USt.)</span>
  <span class="amount">${formatCurrency(totalGross)}</span>
</div>
```

### Scope / Note Cards
```html
<!-- Never use custom scope-included / scope-excluded classes.
     Always use the unified note-card system: -->
<div class="notes-grid">
  <div class="note-card included">
    <h4>Im Leistungsumfang enthalten</h4>
    <ul>
      <li>Item A</li>
      <li>Item B</li>
    </ul>
  </div>
  <div class="note-card excluded">
    <h4>Nicht enthalten</h4>
    <ul>
      <li>Item C</li>
    </ul>
  </div>
  <div class="note-card info note-card-full">
    <h4>Ergänzende Angaben</h4>
    <ul>
      <li>Item D</li>
    </ul>
  </div>
</div>
```

### Page Break Control
```css
.page { break-after: page; }           /* New page after */
.section-title { break-after: avoid; } /* Keep with content */
```

### Section Header Pattern
```html
<!-- Always pair section-title with section-subtitle -->
<h2 class="section-title">Haupttitel</h2>
<p class="section-subtitle">Beschreibender Untertitel oder Normreferenz</p>
```

---

## Testing

```bash
# Check if dev server already running (do not restart unnecessarily)
# Open preview URL in browser:
http://localhost:3000/api/doc-gen/{id}/preview

# Print to PDF
Press Ctrl+P → Save as PDF → Verify A4 page breaks

# Run linter
npm run lint
```

---

## Full Documentation

See `.cursor/plans/DOCUMENT_GENERATION_ARCHITECTURE.md` for comprehensive guide including:
- Complete architectural patterns
- AI integration strategies
- Quality assurance checklists
- Platform integration guidelines
- 1800+ lines of detailed documentation

---

## Example Implementations

- **Kostenplanung**: `src/lib/doc-gen/templates/cost-plan/`
- **Baukoordination**: `src/lib/doc-gen/templates/baukoordination/`
- **Financial Summary**: `src/lib/doc-gen/templates/financial-summary/`
- **Report**: `src/lib/doc-gen/templates/report/`

---

**Time Estimate:** 12–17 hours for a complete professional document type
**Difficulty:** Intermediate (TypeScript + HTML/CSS knowledge required)
**Success Rate:** 100% when following established patterns
