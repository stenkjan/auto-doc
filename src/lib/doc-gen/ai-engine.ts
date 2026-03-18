import Anthropic from "@anthropic-ai/sdk";
import { getModel, DEFAULT_MODEL_ID, type AIModel } from "./models";
import { DEFAULT_CONTEXT_ID } from "./context-registry";
import { resolveContext, loadContextContent } from "./context-registry.server";

/* ------------------------------------------------------------------ */
/*  Rules & context loading                                             */
/* ------------------------------------------------------------------ */

async function buildSystemPrompt(contextId?: string): Promise<string> {
  const globalRules = await loadContextContent("rules/global-rules.md");
  const permissions = await loadContextContent("rules/user-permissions.md");

  const context = await resolveContext(contextId ?? DEFAULT_CONTEXT_ID);
  const contextContent = context ? await loadContextContent(context.filePath) : "";

  return `Du bist ein Dokumenten-Assistent für die Firma Hoam (Eco Chalets GmbH).
Erstelle das gewünschte Dokument als professionell formatiertes Markdown.
Nutze Überschriften (##, ###), Tabellen, Listen und Fettdruck um das Dokument klar zu strukturieren.
Alle Texte auf Deutsch (Österreich). Verwende österreichische Zahlen- und Datumsformatierung.
Antworte NUR mit dem Markdown-Dokument – kein einleitendes Text, keine Erklärungen davor oder danach.

${globalRules}

${permissions}

${contextContent}`.trim();
}

/* ------------------------------------------------------------------ */
/*  Provider adapters                                                   */
/* ------------------------------------------------------------------ */

async function callOpenRouter(
  model: AIModel,
  system: string,
  userMessage: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY nicht konfiguriert");

  const OPENROUTER_ALIASES = ["openrouter/free", "openrouter/auto"];
  const actualModel = OPENROUTER_ALIASES.includes(model.id)
    ? model.id
    : model.id.replace(/^openrouter\//, "");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://hoam-house.com",
      "X-Title": "Auto Doc Generator",
    },
    body: JSON.stringify({
      model: actualModel,
      max_tokens: 8192,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter API Fehler ${res.status}: ${err}`);
  }

  const json = await res.json();
  return json?.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(
  model: AIModel,
  system: string,
  userMessage: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY nicht konfiguriert. Bitte in .env eintragen.");

  const client = new Anthropic({ apiKey });
  const modelId = model.id.replace(/^anthropic\//, "");

  const message = await client.messages.create({
    model: modelId,
    max_tokens: 8192,
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = message.content[0];
  if (block.type !== "text") return "";
  return block.text;
}

async function callModel(
  model: AIModel,
  system: string,
  userMessage: string
): Promise<string> {
  if (model.provider === "anthropic") {
    return callAnthropic(model, system, userMessage);
  }
  return callOpenRouter(model, system, userMessage);
}

/* ------------------------------------------------------------------ */
/*  Public types                                                        */
/* ------------------------------------------------------------------ */

export interface Resource {
  name: string;
  content: string;
  type: "text";
  warning?: string;
}

/* ------------------------------------------------------------------ */
/*  Resource injection helper                                           */
/* ------------------------------------------------------------------ */

function buildUserMessage(
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

/* ------------------------------------------------------------------ */
/*  Public functions                                                    */
/* ------------------------------------------------------------------ */

/**
 * Generate a Markdown document from a user prompt.
 * Optionally pass existingMarkdown to have the model refine/edit it.
 * Optionally pass resources[] to inject reference documents into context.
 * Optionally pass contextId to load a specific system-prompt context.
 */
export async function generateMarkdownDocument(
  prompt: string,
  modelId: string = DEFAULT_MODEL_ID,
  existingMarkdown?: string,
  resources?: Resource[],
  contextId?: string
): Promise<{ markdown: string }> {
  const model = getModel(modelId);
  if (!model) throw new Error(`Unbekanntes Modell: ${modelId}`);

  const systemPrompt = await buildSystemPrompt(contextId);
  const userMessage = buildUserMessage(prompt, existingMarkdown, resources);

  const markdown = await callModel(model, systemPrompt, userMessage);
  return { markdown };
}

/**
 * Stream a Markdown document from a user prompt.
 * onChunk is called once with the full response (no native streaming yet).
 */
export async function streamMarkdownDocument(
  prompt: string,
  modelId: string = DEFAULT_MODEL_ID,
  onChunk: (text: string) => void,
  existingMarkdown?: string,
  resources?: Resource[],
  contextId?: string
): Promise<{ markdown: string }> {
  const model = getModel(modelId);
  if (!model) throw new Error(`Unbekanntes Modell: ${modelId}`);

  const systemPrompt = await buildSystemPrompt(contextId);
  const userMessage = buildUserMessage(prompt, existingMarkdown, resources);

  const markdown = await callModel(model, systemPrompt, userMessage);
  onChunk(markdown);
  return { markdown };
}
