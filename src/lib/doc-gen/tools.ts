/**
 * Tool definitions for the Agentic Document Generator.
 * Uses Vercel AI SDK v6: `inputSchema` (not `parameters`) for tool definitions.
 */

import { tool } from "ai";
import { z } from "zod/v4";
import { scrapeUrl } from "./web-scraper";
import { fetchDriveResource, extractDriveFileId } from "./drive-output";
import { fetchGithubSource, type GithubSourceConfig } from "./sources/github-source";
import { saveMemory, loadMemory, type MemoryEntry } from "./memory";

/**
 * Create the tool set, bound to a specific session ID for memory operations.
 */
export function createDocGenTools(sessionId: string) {
  return {
    fetchWebPage: tool({
      description:
        "Ruft den Textinhalt einer öffentlichen Webseite ab. Nutze dieses Tool wenn du Informationen von einer URL brauchst — z.B. Artikel, Dokumentationen, oder öffentliche Webseiten.",
      inputSchema: z.object({
        url: z
          .string()
          .url()
          .describe("Die vollständige URL der abzurufenden Webseite"),
      }),
      execute: async ({ url }: { url: string }) => {
        try {
          const resource = await scrapeUrl(url);
          await saveMemory(sessionId, `web_${Date.now()}`, `# ${resource.name}\n\n${resource.content.slice(0, 20000)}`);
          return {
            success: true,
            name: resource.name,
            content: resource.content.slice(0, 30000),
            characterCount: resource.content.length,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Fehler beim Abrufen der Webseite",
          };
        }
      },
    }),

    fetchDriveFile: tool({
      description:
        "Ruft den Textinhalt einer Google Drive Datei ab (Google Docs, Sheets, PDF, DOCX, TXT). Nutze dieses Tool wenn der Nutzer eine Google Drive URL teilt oder auf ein Drive-Dokument verweist.",
      inputSchema: z.object({
        fileUrl: z
          .string()
          .describe("Google Drive URL oder Datei-ID"),
      }),
      execute: async ({ fileUrl }: { fileUrl: string }) => {
        try {
          const fileId = extractDriveFileId(fileUrl);
          if (!fileId) {
            return { success: false, error: "Ungültige Google Drive URL oder Datei-ID" };
          }
          const resource = await fetchDriveResource(fileId);
          await saveMemory(sessionId, `drive_${Date.now()}`, `# ${resource.name}\n\n${resource.content.slice(0, 20000)}`);
          return {
            success: true,
            name: resource.name,
            content: resource.content.slice(0, 30000),
            characterCount: resource.content.length,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Fehler beim Abrufen der Drive-Datei",
          };
        }
      },
    }),

    fetchGithubRepo: tool({
      description:
        "Ruft die Dateistruktur und Inhalte eines GitHub-Repositories ab. Nutze dieses Tool wenn der Nutzer auf ein GitHub Repo verweist oder Codedokumentation benötigt.",
      inputSchema: z.object({
        repoUrl: z
          .string()
          .describe("GitHub Repository URL, z.B. https://github.com/owner/repo"),
        branch: z
          .string()
          .optional()
          .describe("Branch-Name (Standard: main)"),
        path: z
          .string()
          .optional()
          .describe("Optionaler Unterpfad-Filter, z.B. src/lib"),
      }),
      execute: async ({ repoUrl, branch, path }: { repoUrl: string; branch?: string; path?: string }) => {
        try {
          const config: GithubSourceConfig = {
            repoUrl,
            branch,
            path,
            maxFiles: 15,
          };
          const resources = await fetchGithubSource(config);
          const summary = resources.map((r) => `## ${r.name}\n${r.content.slice(0, 5000)}`).join("\n\n---\n\n");
          await saveMemory(sessionId, `github_${Date.now()}`, summary.slice(0, 50000));
          return {
            success: true,
            fileCount: resources.length,
            files: resources.map((r) => ({
              name: r.name,
              contentPreview: r.content.slice(0, 2000),
              totalLength: r.content.length,
            })),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Fehler beim Abrufen des GitHub Repos",
          };
        }
      },
    }),

    saveToMemory: tool({
      description:
        "Speichert Daten im Cloud-Memory für späteren Zugriff. Nutze dieses Tool um Zwischenergebnisse, Zusammenfassungen oder gesammelte Daten zu speichern, die du später im Dokument verwenden willst.",
      inputSchema: z.object({
        key: z
          .string()
          .describe("Eindeutiger Schlüssel unter dem die Daten gespeichert werden, z.B. 'finanzdaten', 'recherche'"),
        content: z
          .string()
          .describe("Der zu speichernde Inhalt als Text/Markdown"),
      }),
      execute: async ({ key, content }: { key: string; content: string }) => {
        try {
          const entry = await saveMemory(sessionId, key, content);
          return {
            success: true,
            key: entry.key,
            characterCount: content.length,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Fehler beim Speichern",
          };
        }
      },
    }),

    loadFromMemory: tool({
      description:
        "Lädt zuvor gespeicherte Daten aus dem Cloud-Memory. Nutze dieses Tool um auf vorher gesammelte oder gespeicherte Informationen zuzugreifen.",
      inputSchema: z.object({
        key: z
          .string()
          .optional()
          .describe("Optionaler Schlüssel — wenn leer, werden alle gespeicherten Einträge zurückgegeben"),
      }),
      execute: async ({ key }: { key?: string }) => {
        try {
          const entries = await loadMemory(sessionId);
          if (key) {
            const entry = entries.find((e) => e.key === key);
            if (!entry) {
              return { success: false, error: `Kein Eintrag mit Schlüssel '${key}' gefunden` };
            }
            return { success: true, entries: [entry] };
          }
          return {
            success: true,
            entries: entries.map((e: MemoryEntry) => ({
              key: e.key,
              contentPreview: e.content.slice(0, 500),
              totalLength: e.content.length,
            })),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Fehler beim Laden",
          };
        }
      },
    }),

    propose_document_plan: tool({
      description:
        "Erstellt einen strukturierten Plan-Entwurf für das angeforderte Dokument BEVOR es generiert wird. Zeigt dem Nutzer Dokumenttyp, geschätzte Seitenstruktur, erkannte Inhalte und offene Fragen. Warte auf Bestätigung des Nutzers bevor du das Dokument schreibst. Rufe dieses Tool bei JEDER neuen Dokumentanfrage zuerst auf.",
      inputSchema: z.object({
        documentType: z
          .string()
          .describe("Erkannter Dokumenttyp, z.B. 'Angebot', 'Kostenplanung', 'Bericht'"),
        title: z
          .string()
          .describe("Vorgeschlagener Dokumenttitel"),
        language: z
          .string()
          .describe("Dokumentsprache, z.B. 'de' oder 'en'"),
        estimatedPages: z
          .number()
          .describe("Geschätzte Seitenanzahl"),
        sections: z
          .array(z.string())
          .describe("Liste der geplanten Abschnitte/Seiten"),
        hasPricing: z
          .boolean()
          .describe("Enthält das Dokument Preise oder Kostenpositionen?"),
        detectedSources: z
          .array(z.string())
          .describe("Liste der erkannten Quellen/Referenzdokumente"),
        ambiguities: z
          .array(z.string())
          .describe("Unklarheiten die vor der Generierung geklärt werden sollten"),
        questions: z
          .array(z.string())
          .max(3)
          .describe("Maximal 3 gezielte Rückfragen an den Nutzer"),
      }),
      execute: async ({
        documentType,
        title,
        language,
        estimatedPages,
        sections,
        hasPricing,
        detectedSources,
        ambiguities,
        questions,
      }: {
        documentType: string;
        title: string;
        language: string;
        estimatedPages: number;
        sections: string[];
        hasPricing: boolean;
        detectedSources: string[];
        ambiguities: string[];
        questions: string[];
      }) => {
        return {
          planReady: true,
          summary: {
            documentType,
            title,
            language,
            estimatedPages,
            sections,
            hasPricing,
            detectedSources,
            ambiguities,
            questions,
          },
          instruction:
            "Zeige diese Zusammenfassung dem Nutzer im Format:\n" +
            "\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n" +
            "\u2551  DOKUMENT-PLAN \u2014 Bitte best\u00e4tigen               \u2551\n" +
            "\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563\n" +
            `\u2551  Typ:       ${documentType}\n` +
            `\u2551  Titel:     ${title}\n` +
            `\u2551  Sprache:   ${language}\n` +
            `\u2551  Seiten:    ~${estimatedPages}\n` +
            `\u2551  Abschnitte: ${sections.join(" \u00b7 ")}\n` +
            `\u2551  Preise:    ${hasPricing ? "Ja" : "Nein"}\n` +
            (detectedSources.length > 0 ? `\u2551  Quellen:   ${detectedSources.join(", ")}\n` : "") +
            "\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d\n" +
            (ambiguities.length > 0
              ? "\n\u26a0\ufe0f Unklarheiten:\n" + ambiguities.map((a) => "- " + a).join("\n") + "\n"
              : "") +
            (questions.length > 0
              ? "\nR\u00fcckfragen:\n" + questions.map((q, i) => (i + 1) + ". " + q).join("\n") + "\n\nBest\u00e4tige mit \u201eJa\u201c oder beantworte die Fragen."
              : "\nBest\u00e4tige mit \u201eJa\u201c um zu starten."),
        };
      },
    }),

    validate_document: tool({
      description:
        "Prüft ein fertig generiertes HTML-Dokument auf: Quellenkonformität (sind Annahmen markiert?), Zahlen-Konsistenz (stimmen Summen?), Terminologie-Einheitlichkeit und Rechtschreibfehler. Rufe dieses Tool NACH der Dokument-Generierung auf bevor du die finale Antwort gibst.",
      inputSchema: z.object({
        htmlText: z
          .string()
          .describe("Das fertig generierte HTML-Dokument"),
        language: z
          .enum(["de", "en"])
          .describe("Dokumentsprache für Rechtschreibprüfung"),
        hasPricing: z
          .boolean()
          .describe("Enthält das Dokument Preisangaben die kreuzgeprüft werden sollen?"),
      }),
      execute: async ({
        htmlText,
        language,
        hasPricing,
      }: {
        htmlText: string;
        language: "de" | "en";
        hasPricing: boolean;
      }) => {
        // Basic programmatic checks — AI performs the deeper semantic validation
        const issues: string[] = [];

        // Check for unfilled placeholders
        const placeholders = htmlText.match(/\[[A-ZÄÖÜ][^\]]{2,50}\]/g) ?? [];
        if (placeholders.length > 0) {
          issues.push(`${placeholders.length} ungefüllte Platzhalter gefunden: ${placeholders.slice(0, 5).join(", ")}`);
        }

        // German spelling quick checks
        if (language === "de") {
          if (/\bdaß\b/i.test(htmlText)) issues.push("Veraltete Schreibweise 'daß' → 'dass'");
          if (/\bmuß\b/i.test(htmlText)) issues.push("Veraltete Schreibweise 'muß' → 'muss'");
          if (/\bMwst\b/i.test(htmlText)) issues.push("Schreibweise 'MwSt.' oder 'USt.' verwenden, nicht 'Mwst'");
          if (/GmbH\./.test(htmlText)) issues.push("'GmbH.' — kein Punkt nach GmbH");
        }

        // Check assumptions are labelled
        const assumptionRequired = /\b(ca\.|ungefähr|etwa|schätzungsweise|angenommend|assume|approximately)\b/i.test(htmlText);
        const assumptionLabelled = /\bAnnahme:\b/i.test(htmlText);
        if (assumptionRequired && !assumptionLabelled) {
          issues.push("Schätzwerte/Annahmen vorhanden aber nicht als 'Annahme:' gekennzeichnet");
        }

        return {
          passed: issues.length === 0,
          issueCount: issues.length,
          issues,
          hasPricing,
          instruction: issues.length > 0
            ? `Korrigiere diese ${issues.length} Problem(e) im Dokument via edit_document_html bevor du die Antwort abschließt:\n${issues.map((i) => `- ${i}`).join("\n")}`
            : "Keine Probleme gefunden. Dokument kann geliefert werden.",
          qaReport:
            "-----------------------------------------\n" +
            "QA-BERICHT\n" +
            "-----------------------------------------\n" +
            `Platzhalter:  ${placeholders.length === 0 ? "✅ Keine" : "⚠️ " + placeholders.length + " gefunden"}\n` +
            `Rechtschreibung: ${language === "de" && issues.some((i) => i.includes("Schreibweise")) ? "⚠️ Korrekturen nötig" : "✅ OK"}\n` +
            `Annahmen:     ${assumptionRequired && !assumptionLabelled ? "⚠️ Nicht gekennzeichnet" : "✅ OK"}\n` +
            `Gesamtergebnis: ${issues.length === 0 ? "✅ Bestanden" : "❌ " + issues.length + " Problem(e)"}\n` +
            "-----------------------------------------",
        };
      },
    }),

    edit_document_html: tool({
      description:
        "Verwende dieses Tool im Amendment-Modus (Phase 6), um einen String im HTML-Dokument präzise durch einen neuen zu ersetzen. Dies ist VIEL schneller als das HTML neu zu generieren. Gib den exakten Suchstring (inkl. umgebendem HTML-Code) und den neuen String an. Führe dies auch für das versteckte JSON DOC_DATA_MODEL aus, falls sich Werte ändern.",
      inputSchema: z.object({
        searchString: z.string().describe("Der exakte String der im HTML gesucht werden soll (1-2 Zeilen Kontext mitnehmen zur Eindeutigkeit)"),
        replacementString: z.string().describe("Der neue String der den alten ersetzen soll"),
        reason: z.string().describe("Kurze Begründung für die Änderung (z.B. 'Preis von X auf Y erhöht')"),
      }),
      execute: async ({ searchString, replacementString, reason }) => {
        // Log the amendment request (typically the UI would apply the diff automatically over the existing HTML token stream)
        await saveMemory(sessionId, `amendment_${Date.now()}`, `Ersetze:\n${searchString}\nDurch:\n${replacementString}\nGrund:\n${reason}`);
        return {
          success: true,
          instruction: `Änderung erfolgreich registriert: "${reason}". Teile dem Nutzer mit, dass das Dokument aktualisiert wurde.`,
        };
      },
    }),
  };
}
