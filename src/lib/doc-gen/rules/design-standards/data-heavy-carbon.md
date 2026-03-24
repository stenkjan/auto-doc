# Design Standard: Data-Heavy (IBM Carbon)
**Zweck:** Kostenpläne, technische Datenblätter, komplexe Auswertungen.
**Fokus:** Informationsdichte, Tabellen-Lesbarkeit, mathematische Präzision.

## Design Tokens

- `@page margin`: `14mm 14mm 18mm 14mm` (Maximaler Platz für Tabellen)
- `body font-size`: `10.5px` (Kompakt)
- `line-height`: `1.5`
- `color-text`: `#161616` (IBM Gray 100)
- `color-border`: `#E0E0E0`
- `section-title`: `16px`, `font-weight: 700`, `margin-bottom: 4px` (Kompaktere Überschriften)

## Tabellen

Enges Padding (`4px 8px`). Verwende IMMER Zebra-Striping (`#FAFAFA` für gerade Zeilen), um das Lesen langer Zeilen zu erleichtern. Numerische Werte strikt rechtsbündig (`text-align: right`). Vertikale Linien erlaubt.

## Spezial-Elemente

- Nutze `.info-grid` für KPIs oben auf der Seite (Gesamtkosten, Zeitraum, Projektnummer).
- Nutze `.total-bar` für Summenzeilen.
- Kompakte Überschriftenhierarchie: kein übermäßiger Weißraum zwischen Sektionen.

## CSS-Richtlinien

```css
@page { margin: 14mm 14mm 18mm 14mm; }
body { font-size: 10.5px; line-height: 1.5; color: #161616; }
h1 { font-size: 18px; font-weight: 700; }
h2 { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
h3 { font-size: 13px; font-weight: 600; }
table th { background: #E0E0E0; padding: 4px 8px; font-weight: 700; }
table td { padding: 4px 8px; border-bottom: 1px solid #E0E0E0; }
table tr:nth-child(even) td { background: #FAFAFA; }
.text-right { text-align: right; }
.total-bar { background: #161616; color: #fff; font-weight: 700; }
.info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
```
