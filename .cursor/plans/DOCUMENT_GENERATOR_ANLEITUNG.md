# Document Generator — Benutzeranleitung

**Kurzanleitung für Cursor & Antigravity · Stand März 2026**

---

## Was ist der Document Generator?

Der Document Generator ist ein Agent-Programm, das dir aus einem einfachen Text-Prompt ein professionelles, druckfertiges PDF-Dokument erstellt. Du beschreibst, was du brauchst — der Agent übernimmt Struktur, Design und Formatierung automatisch.

---

## Voraussetzungen

| Voraussetzung | Details |
|---|---|
| **Cursor** (empfohlen) oder **Antigravity** | Agent-Umgebung mit Dateizugriff |
| **Browser-MCP** aktiviert | Für die Vorschau und PDF-Ausgabe |
| **`DOCUMENT_GENERATOR.md`** im Kontext | Diese Datei dem Agent mitgeben |

> In Cursor: Öffne `DOCUMENT_GENERATOR.md` und schreibe deinen Prompt im Chat-Fenster darunter.
> In Antigravity: Lade `DOCUMENT_GENERATOR.md` als Kontext-Datei hoch, dann Prompt eingeben.

---

## Schritt-für-Schritt: Erstes Dokument erstellen

**Schritt 1 — Template ausfüllen**

Kopiere das folgende Template in das Chat-Fenster und fülle es aus:

```
## MEINE DOKUMENT-ANFORDERUNG

Prompt:
[Beschreibe hier, was das Dokument enthalten soll]

Referenzen:
[@datei.pdf, @url, oder Text direkt einfügen — optional]

Unternehmen:
[Firmenname, Adresse, Kontakt — oder: "Standard verwenden"]

Sprache: de

Dokumenttyp: [Angebot / Bericht / Rechnung / Vertrag / Freitext]

Sonderanforderungen: [optional]
```

**Schritt 2 — Kongruenzprüfung abwarten**

Der Agent zeigt dir eine Zusammenfassung, was er verstanden hat, und stellt maximal 3 Rückfragen. Beantworte diese oder bestätige mit „Sieht gut aus".

**Schritt 3 — Generierung läuft**

Der Agent extrahiert Inhalte, strukturiert das Dokument und schreibt die HTML-Datei nach `generated-docs/[dokumentname].html`.

**Schritt 4 — Vorschau prüfen**

Der Agent öffnet die Datei automatisch im Browser und macht einen Screenshot zur Verifikation.

**Schritt 5 — Als PDF speichern**

```
Ctrl+P (Windows) / Cmd+P (Mac)
→ Drucker: "Als PDF speichern"
→ Papier: A4
→ Hintergrundgrafiken: ✓ aktivieren
→ Speichern
```

---

## Beispiel-Prompt

```
## MEINE DOKUMENT-ANFORDERUNG

Prompt:
Angebot für Baukoordinationsleistungen für den Umbau eines Einfamilienhauses
in Graz. Leistungen:
- 01 Grundlagenermittlung: 8 Stunden
- 02 Terminplanung: 15 Stunden
- 03 Ausführungskoordination: Pauschale 4.500€
- 04 Örtliche Bauaufsicht: 30 Stunden à 85€/h
Stundensatz: 85€/h

Referenzen:
@ÖIBA_Leitfaden.pdf

Unternehmen: Standard verwenden

Sprache: de

Dokumenttyp: Angebot
```

---

## Nachträgliche Änderungen

Du musst das Dokument nicht neu generieren, wenn du etwas anpassen möchtest. Schreibe einfach deinen Änderungs-Prompt:

### Beispiele

```
Ändere den Projektnamen zu "Wohnhaus Müller, Linz"
```

```
Erhöhe die Stunden bei Position 04 auf 40 Stunden
```

```
Füge eine neue Position hinzu: 05 Dokumentation — Pauschale 1.200€
```

```
Entferne die Seite mit den Allgemeinen Geschäftsbedingungen
```

```
Ändere die primäre Farbe zu Blau (#3D6CE1)
```

### Was passiert bei einer Änderung?

1. Der Agent liest das bestehende Dokument vollständig ein
2. Er versteht den Kontext aus dem eingebetteten Datenmodell
3. Er bearbeitet **nur die betroffene Stelle** — kein Neu-Generieren
4. Bei Preisänderungen werden alle Totals automatisch neu berechnet
5. Ein internes Änderungsprotokoll wird im Dokument mitgeführt
6. Der Browser zeigt die aktualisierte Version zur Kontrolle

> **Tipp:** Bei strukturellen Änderungen (neue Seite, kompletter Abschnitt) fragt der Agent kurz nach, ob er das richtig verstanden hat, bevor er schreibt.

---

## Tipps & Häufige Fehler

**Font wird nicht geladen**
→ Stelle sicher, dass du eine aktive Internetverbindung hast (Geist-Font kommt von Google Fonts). Im PDF-Export sind die Schriften immer eingebettet.

**Zahlen falsch formatiert**
→ Sage dem Agent: *„Formatiere alle Zahlen im deutschen Format (Tausenderpunkt, Komma-Dezimal)"*

**Dokument passt nicht auf A4**
→ Sage dem Agent: *„Überprüfe Seitenumbrüche und passe Layout für A4-Druck an"*

**PDF zu viele/wenige Seiten**
→ Sage dem Agent: *„Fasse Seiten X und Y zusammen"* oder *„Trenne Abschnitt Z auf eine neue Seite"*

**Ich möchte das Firmenlogo ändern**
→ Der Standardpfad ist `/0-homebutton-nest-haus.svg`. Sage dem Agent: *„Ändere das Logo auf [Pfad oder URL]"*

**Das ganze Dokument neu generieren**
→ Sage dem Agent: *„Generiere das Dokument komplett neu"* — dann läuft der volle Prozess nochmal von Phase 1.

---

## Ausgabedatei

Generierte Dokumente liegen immer unter:

```
[Projektordner]/generated-docs/[dokumentname].html
```

Diese HTML-Datei ist vollständig selbst-enthaltend (alle Styles inline) und kann:
- Direkt im Browser geöffnet werden
- Als PDF gespeichert werden (Ctrl+P)
- Per E-Mail als Dateianhang verschickt werden
- Im Projektordner versioniert (Git) werden

---

*Basiert auf der Document Generator Architecture v1.0 · Hoam / Eco Chalets GmbH*
