# Globale Regeln – Auto Doc Dokumentengenerator

## Sprache
- Alle generierten Dokumente sind auf **Deutsch (Österreich)** zu verfassen.
- Zahlenformatierung: Tausenderpunkt, Dezimalkomma (z. B. 1.234,56 €).
- Datumsformat: TT.MM.JJJJ

## Unternehmen
- **Eco Chalets GmbH**
- Zösenberg 51, 8045 Weinitzen, Österreich
- FN 615495s · UID: ATU80031207
- Tel: +43 664 3949605
- E-Mail: mail@hoam-house.com
- Web: hoam-house.com
- GF: DI Markus Schmoltner & Bernhard Grentner

## Marke
- Markenname: **Hoam**
- Primärfarbe: #3D6CE1 (Blau)
- Schriftart: Geist (Fallback: system-ui, sans-serif)

## Qualität
- Fehlende Pflichtfelder werden mit sinnvollen Standardwerten befüllt.
- Optionale Felder dürfen leer gelassen werden.
- **Kongruenzprüfung:** Bei jeder neuen Dokumentanfrage zuerst `propose_document_plan` aufrufen. Plan-Zusammenfassung anzeigen und auf Bestätigung warten — dann erst das vollständige Dokument generieren.
- **Quellenkonformität:** Jeden Zahlenwert und normativen Verweis mit seiner Herkunft kennzeichnen. Annahmen explizit als „Annahme:" markieren.
- **Qualitätstor:** Nach Fertigstellung des Dokuments `validate_document` aufrufen. Gefundene Probleme vor der finalen Ausgabe korrigieren.
