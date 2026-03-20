/**
 * Core AI Engine using Vercel AI SDK.
 * Powers the "Prompt Machine" architecture.
 */
import { generateText, streamText, type Message } from "ai";
import { getLanguageModel } from "./models";
import { DEFAULT_CONTEXT_ID, BUILTIN_CONTEXTS } from "./context-registry";
import { resolveContext, loadContextContent } from "./context-registry.server";
import { createDocGenTools } from "./tools";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface Resource {
  name: string;
  content: string;
  type: "text";
  warning?: string;
  sourceType?: "drive" | "web" | "file" | "github" | "mcp";
}

/* ------------------------------------------------------------------ */
/*  System prompt builders                                              */
/* ------------------------------------------------------------------ */

async function buildSystemPrompt(contextId?: string): Promise<string> {
  const globalRules = await loadContextContent("rules/global-rules.md");
  const permissions = await loadContextContent("rules/user-permissions.md");
  const context = await resolveContext(contextId ?? DEFAULT_CONTEXT_ID);
  const contextContent = context ? await loadContextContent(context.filePath) : "";

  return `Du bist ein hochintelligenter, agentischer Dokumenten-Assistent für die Firma Hoam (Eco Chalets GmbH).
Erstelle das gewünschte Dokument als professionell formatiertes Markdown.

## WICHTIGE REGELN FÜR DICH ALS AGENT:
1. Du hast Zugriff auf Tools (fetchWebPage, fetchDriveFile, etc.). Nutze diese **PROAKTIV**, wenn der Nutzer URLs einfügt oder nach externem Wissen fragt!
2. Wenn du ein Tool nutzt, erkläre nicht, dass du es benutzt. Das System zeigt das automatisch an.
3. Wenn du fertig mit dem Sammeln von Informationen bist, schreibe das finale Dokument.
4. Nutze Überschriften (##, ###), Tabellen, Listen und Fettdruck um das Dokument klar zu strukturieren.
5. Alle Texte auf Deutsch (Österreich). Verwende österreichische Zahlen- und Datumsformatierung.
6. Antworte NUR mit dem reinen Markdown-Text – kein einleitender Text wie "Hier ist das Dokument".
7. WICHTIG: Keine Markdown-Codeblöcke (\`\`\`markdown ... \`\`\`) um das finale Dokument! Gib den Text direkt und unformatiert aus.

${globalRules}

${permissions}

${contextContent}`.trim();
}

/* ------------------------------------------------------------------ */
/*  Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Build the initial user message wrapper that includes uploaded resources
 * and any existing markdown being edited.
 */
export function buildUserMessage(
  prompt: string,
  existingMarkdown?: string,
  resources?: Resource[]
): string {
  const parts: string[] = [];

  if (resources && resources.length > 0) {
    parts.push("## Referenzdokumente\n");
    for (const r of resources) {
      if (r.warning) {
        parts.push(`### ${r.name}\n_Hinweis: ${r.warning}_`);
      } else {
        parts.push(`### ${r.name}\n\`\`\`\n${r.content.slice(0, 40000)}\n\`\`\``);
      }
    }
    parts.push("");
  }

  if (existingMarkdown) {
    parts.push(
      `## Aktuelles Dokument (bitte entsprechend dem neuen Prompt anpassen)\n\`\`\`markdown\n${existingMarkdown}\n\`\`\``
    );
    parts.push("");
  }

  parts.push(`## Aufgabe\n${prompt}`);
  return parts.join("\n");
}

/**
 * Basic non-streaming generation using Vercel AI SDK.
 * Used by the background persistence/database route.
 */
export async function generateMarkdownDocument(
  prompt: string,
  modelId: string,
  existingMarkdown?: string,
  resources?: Resource[],
  contextId?: string
): Promise<{ markdown: string }> {
  const model = getLanguageModel(modelId);
  const systemPrompt = await buildSystemPrompt(contextId);
  const userMessage = buildUserMessage(prompt, existingMarkdown, resources);
  
  // NOTE: tools are not provided here, as this is the raw unstructured endpoint.
  // The agentic features are tied to the /stream endpoint.
  const { text } = await generateText({
    model,
    system: systemPrompt,
    prompt: userMessage,
    maxTokens: 8192,
  });

  return { markdown: text };
}
