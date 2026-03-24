# Design Standard: Editorial (Butterick's Practical Typography)
**Zweck:** Konzepte, Projektbeschreibungen, Essays, Gutachten (viel Fließtext).
**Fokus:** Ermüdungsfreies Lesen, Weißraum, eleganter Textfluss.

## Design Tokens

- `@page margin`: `25mm 25mm 30mm 25mm` (Großzügiger Weißraum)
- `body font-size`: `12px` (Groß und leserlich)
- `line-height`: `1.7` (Luftiger Zeilenabstand)
- `color-text`: `#202020`
- `section-title`: `22px`, `font-weight: 800`, `letter-spacing: -0.02em`

## Fließtext-Kontrolle

Beschränke die Breite von Fließtext-Absätzen künstlich auf `max-width: 650px`, um die ideale Zeilenlänge (45–90 Zeichen) zu erzwingen. Zentriere den Content-Block auf der Seite.

## Tabellen

Sehr luftig, weites Padding (`10px 14px`). Nur horizontale Trennlinien (`border-bottom`), NIEMALS vertikale Linien. Keine Zebrastreifen. Klare, leichte Linien.

## Spezial-Elemente

- Nutze großzügige Blockquotes (linker Rand `4px solid #E0E0E0`, Padding `12px 20px`) für Zitate/Highlights.
- Seitenumbrüche explizit vor jedem neuen Hauptkapitel.
- Keine `.total-bar` oder dichte Datentabellen — passt nicht zum Stil.

## CSS-Richtlinien

```css
@page { margin: 25mm 25mm 30mm 25mm; }
body { font-size: 12px; line-height: 1.7; color: #202020; }
.content { max-width: 650px; margin: 0 auto; }
h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; }
h2 { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 8px; }
h3 { font-size: 16px; font-weight: 700; }
table th { padding: 10px 14px; border-bottom: 2px solid #202020; font-weight: 700; }
table td { padding: 10px 14px; border-bottom: 1px solid #E0E0E0; }
blockquote { border-left: 4px solid #E0E0E0; padding: 12px 20px; color: #4B5563; }
```
