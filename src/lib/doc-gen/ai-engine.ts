import fs from "fs/promises";
import path from "path";
import { getModel, DEFAULT_MODEL_ID, type AIModel } from "./models";

/* ------------------------------------------------------------------ */
/*  Rules loading                                                       */
/* ------------------------------------------------------------------ */

async function loadRulesFile(relativePath: string): Promise<string> {
  const fullPath = path.join(
    process.cwd(),
    "src/lib/doc-gen/rules",
    relativePath
  );
  try {
    return await fs.readFile(fullPath, "utf-8");
  } catch {
    return "";
  }
}

async function buildSystemPrompt(): Promise<string> {
  const globalRules = await loadRulesFile("global-rules.md");
  const permissions = await loadRulesFile("user-permissions.md");

  return `Du bist ein Dokumentengenerator-Assistent für die Firma Hoam (Eco Chalets GmbH).
Erstelle das gewünschte Dokument als professionell formatiertes Markdown.
Nutze Überschriften (##, ###), Tabellen, Listen und Fettdruck um das Dokument klar zu strukturieren.
Alle Texte auf Deutsch (Österreich). Verwende österreichische Zahlen- und Datumsformatierung.
Antworte NUR mit dem Markdown-Dokument – kein einleitendes Text, keine Erklärungen davor oder danach.

${globalRules}

${permissions}`;
}

/* ------------------------------------------------------------------ */
/*  Provider adapter (OpenRouter only)                                 */
/* ------------------------------------------------------------------ */

async function callModel(
  model: AIModel,
  system: string,
  userMessage: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  // Special OpenRouter routing aliases stay as-is (e.g. "openrouter/free", "openrouter/auto")
  // Regular models strip only the "openrouter/" vendor prefix (e.g. "openrouter/meta-llama/llama-4-scout" → "meta-llama/llama-4-scout")
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
    throw new Error(`OpenRouter API error ${res.status}: ${err}`);
  }

  const json = await res.json();
  return json?.choices?.[0]?.message?.content ?? "";
}

/* ------------------------------------------------------------------ */
/*  Public types                                                        */
/* ------------------------------------------------------------------ */

export interface Resource {
  name: string;
  content: string;
  type: "text";
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
      parts.push(`### ${r.name}\n\`\`\`\n${r.content.slice(0, 40000)}\n\`\`\``);
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
 * Optionally pass existingMarkdown to have Claude refine/edit it.
 * Optionally pass resources[] to inject reference documents into context.
 */
export async function generateMarkdownDocument(
  prompt: string,
  modelId: string = DEFAULT_MODEL_ID,
  existingMarkdown?: string,
  resources?: Resource[]
): Promise<{ markdown: string }> {
  const model = getModel(modelId);
  if (!model) throw new Error(`Unknown model: ${modelId}`);

  const systemPrompt = await buildSystemPrompt();
  const userMessage = buildUserMessage(prompt, existingMarkdown, resources);

  const markdown = await callModel(model, systemPrompt, userMessage);
  return { markdown };
}

/**
 * Stream a Markdown document from a user prompt.
 * All models route through OpenRouter (no native streaming).
 * onChunk is called once with the full response.
 */
export async function streamMarkdownDocument(
  prompt: string,
  modelId: string = DEFAULT_MODEL_ID,
  onChunk: (text: string) => void,
  existingMarkdown?: string,
  resources?: Resource[]
): Promise<{ markdown: string }> {
  const model = getModel(modelId);
  if (!model) throw new Error(`Unknown model: ${modelId}`);

  const systemPrompt = await buildSystemPrompt();
  const userMessage = buildUserMessage(prompt, existingMarkdown, resources);

  const markdown = await callModel(model, systemPrompt, userMessage);
  onChunk(markdown);
  return { markdown };
}
