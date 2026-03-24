# Design Standard: Corporate (Microsoft Fluent 2)
**Zweck:** Verträge, offizielle Angebote, Rechnungen, formelle Anschreiben.
**Fokus:** Vertrauen, Klarheit, klassische Proportionen.

## Design Tokens

- `@page margin`: `20mm 20mm 25mm 20mm` (Klassischer Briefstandard)
- `body font-size`: `11.5px`
- `line-height`: `1.6`
- `color-text`: `#111827` (Sehr dunkles Grau, weicher als reines Schwarz)
- `color-text-secondary`: `#4B5563`
- `section-title`: `20px`, `font-weight: 800`, `margin-bottom: 6px`

## Tabellen

Standard-Padding (`8px 10px`), KEINE Zebrastreifen. Header-Background in zartem `#F3F4F6`. Einfache horizontale Trennlinien.

## Spezial-Elemente

- Nutze `.total-bar` für Summenzeilen (dunkler Hintergrund `#111827`, weißer Text).
- Nutze `.info-card` für Metadaten (Datum, Ref.-Nr., Auftraggeber) oben rechts.
- Deckblatt mit starker Typografie: Firmenname groß, Dokumenttitel als H1.

## CSS-Richtlinien

```css
@page { margin: 20mm 20mm 25mm 20mm; }
body { font-size: 11.5px; line-height: 1.6; color: #111827; }
h1 { font-size: 24px; font-weight: 800; }
h2 { font-size: 20px; font-weight: 800; margin-bottom: 6px; }
h3 { font-size: 16px; font-weight: 700; }
table th { background: #F3F4F6; padding: 8px 10px; }
table td { padding: 8px 10px; }
.total-bar { background: #111827; color: #fff; font-weight: 700; }
```
