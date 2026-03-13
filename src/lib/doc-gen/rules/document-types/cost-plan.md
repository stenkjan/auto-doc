# Dokumenttyp: Kostenplanung (cost-plan)

## Beschreibung
Kostenschätzung in der Vorentwurfsphase gemäß ÖNORM B 1801-1. Enthält Abbruchkosten, Errichtungskosten nach Haustypen, Kostengruppen 0–9, Partnerschaftsmodell und Terminplanung.

## Pflichtfelder
- `projectRef`: Projektreferenz (z. B. "KP-2025-001")
- `clientName`: Kundenname / Projektbezeichnung
- `date`: Erstellungsdatum
- `phase1.plots`: Mindestens ein Abbruch-Grundstück mit Maßen und Preisen
- `phases`: Mindestens eine Hausphase mit Typ, Nutzfläche und Preis/m²

## Kostengruppen (ÖNORM B 1801-1)
- KG 0: Grund (separat)
- KG 1: Aufschließung (ca. 5%)
- KG 2: Bauwerk – Rohbau (ca. 33%)
- KG 3: Bauwerk – Technik (ca. 17%)
- KG 4: Bauwerk – Ausbau (ca. 20%)
- KG 5: Einrichtung (nach Bedarf)
- KG 6: Außenanlagen (nach Bedarf)
- KG 7: Honorare (ca. 12%)
- KG 8: Nebenkosten (ca. 5%)
- KG 9: Reserven (ca. 8%)

## Berechnungslogik
- Gebäudekosten = Nutzfläche × Preis/m²
- Kostengruppe Betrag = Gebäudekosten × Anteil
- Abbruchkosten = BRI × Preis/m³ (BRI = Grundfläche × Geschosse × Geschosshöhe)
- Gesamtkosten = Abbruchkosten + Gebäudekosten (nur nicht-optionale Phasen)

## Preisquelle Standard
"Empfehlungen für Herstellungskosten 2025 (Roland Popp), Steiermark hochwertig inkl. EFH-Aufschlag"
