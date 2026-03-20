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
  };
}
