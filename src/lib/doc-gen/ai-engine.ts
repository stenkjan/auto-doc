import Anthropic from "@anthropic-ai/sdk";
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
/*  Provider adapters                                                   */
/* ------------------------------------------------------------------ */

/** Unified call: returns plain text response */
async function callModel(
  model: AIModel,
  system: string,
  userMessage: string
): Promise<string> {
  switch (model.provider) {
    case "anthropic":
      return callAnthropic(model.id, system, userMessage);
    case "gemini":
      return callGemini(model.id, system, userMessage);
    case "openrouter":
      return callOpenRouter(model.id, system, userMessage);
  }
}

async function callAnthropic(
  modelId: string,
  system: string,
  userMessage: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: modelId,
    max_tokens: 8192,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

async function callGemini(
  modelId: string,
  system: string,
  userMessage: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    generationConfig: { maxOutputTokens: 8192, temperature: 0.2 },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const json = await res.json();
  return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callOpenRouter(
  modelId: string,
  system: string,
  userMessage: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const actualModel = modelId.replace(/^openrouter\//, "");

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
/*  Anthropic streaming helper (Anthropic provider only)              */
/* ------------------------------------------------------------------ */

export async function streamAnthropicMarkdown(
  modelId: string,
  system: string,
  userMessage: string,
  onChunk: (text: string) => void
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const client = new Anthropic({ apiKey });
  let full = "";

  const stream = client.messages.stream({
    model: modelId,
    max_tokens: 8192,
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      const chunk = event.delta.text;
      full += chunk;
      onChunk(chunk);
    }
  }

  return full;
}

/* ------------------------------------------------------------------ */
/*  Public functions                                                    */
/* ------------------------------------------------------------------ */

/**
 * Generate a Markdown document from a user prompt.
 * Optionally pass existingMarkdown to have Claude refine/edit it.
 */
export async function generateMarkdownDocument(
  prompt: string,
  modelId: string = DEFAULT_MODEL_ID,
  existingMarkdown?: string
): Promise<{ markdown: string }> {
  const model = getModel(modelId);
  if (!model) throw new Error(`Unknown model: ${modelId}`);

  const systemPrompt = await buildSystemPrompt();

  const userMessage = existingMarkdown
    ? `Aktuelles Dokument (bitte entsprechend dem neuen Prompt anpassen):

\`\`\`markdown
${existingMarkdown}
\`\`\`

Neuer Prompt: ${prompt}`
    : prompt;

  const markdown = await callModel(model, systemPrompt, userMessage);
  return { markdown };
}

/**
 * Stream a Markdown document from a user prompt (Anthropic only; falls back to non-streaming for other providers).
 * onChunk is called with each text delta as it arrives.
 * Returns the full markdown string when done.
 */
export async function streamMarkdownDocument(
  prompt: string,
  modelId: string = DEFAULT_MODEL_ID,
  onChunk: (text: string) => void,
  existingMarkdown?: string
): Promise<{ markdown: string }> {
  const model = getModel(modelId);
  if (!model) throw new Error(`Unknown model: ${modelId}`);

  const systemPrompt = await buildSystemPrompt();

  const userMessage = existingMarkdown
    ? `Aktuelles Dokument (bitte entsprechend dem neuen Prompt anpassen):

\`\`\`markdown
${existingMarkdown}
\`\`\`

Neuer Prompt: ${prompt}`
    : prompt;

  if (model.provider === "anthropic") {
    const markdown = await streamAnthropicMarkdown(
      model.id,
      systemPrompt,
      userMessage,
      onChunk
    );
    return { markdown };
  }

  // Non-Anthropic providers: call synchronously and emit as one chunk
  const markdown = await callModel(model, systemPrompt, userMessage);
  onChunk(markdown);
  return { markdown };
}
