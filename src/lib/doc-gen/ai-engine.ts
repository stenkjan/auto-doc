import Anthropic from "@anthropic-ai/sdk";
import { getModel, DEFAULT_MODEL_ID, type AIModel } from "./models";
import { DEFAULT_CONTEXT_ID } from "./context-registry";
import { resolveContext, loadContextContent } from "./context-registry.server";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface Resource {
  name: string;
  content: string;
  type: "text";
  warning?: string;
  /** Tracks where this resource came from for UI display */
  sourceType?: "drive" | "web" | "file" | "github" | "mcp";
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface PlanResult {
  interpretation: string;
  questions: string[];
  proposal: string;
  ready: boolean;
}

export interface PlanMessage {
  role: "user" | "assistant";
  content: string;
}

interface CallResult {
  text: string;
  usage: TokenUsage;
}

/* ------------------------------------------------------------------ */
/*  System prompt builders                                              */
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
Antworte NUR mit dem reinen Markdown-Text – kein einleitender Text, keine Erklärungen. 
WICHTIG: Keine Markdown-Codeblöcke (\`\`\`markdown ... \`\`\`) um deine Antwort! Gib den Text direkt und unformatiert aus.

${globalRules}

${permissions}

${contextContent}`.trim();
}

async function buildStyledSystemPrompt(contextId?: string): Promise<string> {
  const globalRules = await loadContextContent("rules/global-rules.md");
  const context = await resolveContext(contextId ?? DEFAULT_CONTEXT_ID);
  const contextContent = context ? await loadContextContent(context.filePath) : "";

  return `Du bist ein Dokumenten-Designer und AI-Assistent für die Firma Hoam (Eco Chalets GmbH).
Deine Aufgabe: Erstelle ein vollständiges, professionell gestaltetes HTML-Dokument als Self-Contained File.

DESIGN-DIREKTIVE (WICHTIG):
- Analysiere Dokumenttyp, Zweck und Ton (abgeleitet aus Prompt, Kontext und Ressourcen).
- Nutze standardmäßig IMMER einen weißen Hintergrund (Color: #000 auf Background: #FFF) für PDF-Druck, es sei denn, der User wünscht explizit Darkmode.
- Wenn eine Design-Ressource angehängt ist, nutze DEREN Design und Farbschema als Primärquelle.
- Verwende professionelle Akzentfarben (z.B. Hoam-Blau für Finanzen, Naturtöne für Öko) für Überschriften, Banner oder Rahmen.
- Erstelle ein typografisch klares Layout mit Überschriften-Hierarchie, Tabellenformatierung, Aufzählungen.
- Füge eine gestaltete Kopfzeile (mit Firmenname/Titel) und Fußzeile (Datum, Seite) ein.
- Nutze subtile Schatten, Rahmen und Trennlinien für visuelle Gliederung.
- Alle Texte auf Deutsch (Österreich). Österreichische Zahlen- und Datumsformatierung.

TECHNISCHE ANFORDERUNGEN:
- Antworte NUR mit einem vollständigen <!DOCTYPE html>...</html> Dokument.
- Alle CSS inline oder in einem <style>-Block – keine externen Abhängigkeiten.
- Nutze Google Fonts via <link> Tag für Typographie (Inter oder Outfit).
- Druckoptimiert (A4, @media print kompatibel).
- Keine JavaScript-Tags.
- Keine Erklärungen, kein Text außerhalb des HTML.

${globalRules}

${contextContent}`.trim();
}

async function buildPlanSystemPrompt(contextId?: string): Promise<string> {
  const context = await resolveContext(contextId ?? DEFAULT_CONTEXT_ID);
  const contextContent = context ? await loadContextContent(context.filePath) : "";

  return `Du bist ein professioneller Dokumenten-Planungsassistent.
Du befindest dich im PLAN-MODUS. Deine Aufgabe ist es NICHT, ein Dokument zu erstellen, sondern den Nutzer durch die Planung zu begleiten.

FRAGE NUR DANN NACH, WENN ES FÜR DIE ERSTELLUNG ABSOLUT NOTWENDIG IST! Vermeide Endlosschleifen an Rückfragen. Triff lieber selbst gut begründete Annahmen basierend auf verfügbarem Kontext und Ressourcen, anstatt für jedes Detail nachzufragen.

Kläre folgende Punkte nur im äußersten Notfall (wenn komplett unklar):
1. INHALTSSTRUKTUR: Zusammenhängend oder in Abschnitte unterteilt?
2. TON: Formal, informell, technisch?
3. GESAMTZIEL: Was ist der Endzweck des Dokuments?

Format deiner Antwort (IMMER als reines JSON-Objekt, KEIN Markdown darum herum):
{
  "interpretation": "Kurze Zusammenfassung was du verstanden hast",
  "questions": ["Frage 1 (nur falls UNBEDINGT nötig)"],
  "proposal": "Was ich erstellen würde: ...",
  "ready": false
}

Regeln:
- "ready": true setzen, sobald du genug Kontext hast, um einen soliden ersten Entwurf zu generieren. Du brauchst nicht 100% aller Details.
- "questions": leeres Array [] wenn du dir im Kern sicher bist, um direkt loszulegen. Frage so selten wie möglich.
- Antworte immer auf Deutsch (Österreich).

${contextContent}`.trim();
}

/* ------------------------------------------------------------------ */
/*  Provider adapters                                                   */
/* ------------------------------------------------------------------ */

async function callOpenRouter(
  model: AIModel,
  system: string,
  userMessage: string
): Promise<CallResult> {
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
  return {
    text: json?.choices?.[0]?.message?.content ?? "",
    usage: {
      inputTokens: json?.usage?.prompt_tokens ?? 0,
      outputTokens: json?.usage?.completion_tokens ?? 0,
    },
  };
}

async function callOpenRouterMultiTurn(
  model: AIModel,
  system: string,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<CallResult> {
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
      max_tokens: 4096,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter API Fehler ${res.status}: ${err}`);
  }

  const json = await res.json();
  return {
    text: json?.choices?.[0]?.message?.content ?? "",
    usage: {
      inputTokens: json?.usage?.prompt_tokens ?? 0,
      outputTokens: json?.usage?.completion_tokens ?? 0,
    },
  };
}

async function callAnthropic(
  model: AIModel,
  system: string,
  userMessage: string
): Promise<CallResult> {
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
  return {
    text: block.type === "text" ? block.text : "",
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    },
  };
}

async function callAnthropicMultiTurn(
  model: AIModel,
  system: string,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<CallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY nicht konfiguriert. Bitte in .env eintragen.");

  const client = new Anthropic({ apiKey });
  const modelId = model.id.replace(/^anthropic\//, "");

  const message = await client.messages.create({
    model: modelId,
    max_tokens: 4096,
    system,
    messages,
  });

  const block = message.content[0];
  return {
    text: block.type === "text" ? block.text : "",
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    },
  };
}

async function callModel(
  model: AIModel,
  system: string,
  userMessage: string
): Promise<CallResult> {
  if (model.provider === "anthropic") return callAnthropic(model, system, userMessage);
  return callOpenRouter(model, system, userMessage);
}

async function callModelMultiTurn(
  model: AIModel,
  system: string,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<CallResult> {
  if (model.provider === "anthropic") return callAnthropicMultiTurn(model, system, messages);
  return callOpenRouterMultiTurn(model, system, messages);
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
/*  Public API                                                          */
/* ------------------------------------------------------------------ */

export async function generateMarkdownDocument(
  prompt: string,
  modelId: string = DEFAULT_MODEL_ID,
  existingMarkdown?: string,
  resources?: Resource[],
  contextId?: string
): Promise<{ markdown: string; usage: TokenUsage }> {
  const model = getModel(modelId);
  if (!model) throw new Error(`Unbekanntes Modell: ${modelId}`);

  const systemPrompt = await buildSystemPrompt(contextId);
  const userMessage = buildUserMessage(prompt, existingMarkdown, resources);
  const { text, usage } = await callModel(model, systemPrompt, userMessage);
  return { markdown: text, usage };
}

export async function generateStyledDocument(
  prompt: string,
  modelId: string = DEFAULT_MODEL_ID,
  resources?: Resource[],
  contextId?: string,
  existingMarkdown?: string
): Promise<{ html: string; usedModelId: string; usage: TokenUsage }> {
  const model = getModel(modelId);
  if (!model) throw new Error(`Unbekanntes Modell: ${modelId}`);

  const effectiveModelId = model.supportsHtmlOutput
    ? modelId
    : "openrouter/anthropic/claude-sonnet-4-5";
  const effectiveModel = getModel(effectiveModelId) ?? model;

  const systemPrompt = await buildStyledSystemPrompt(contextId);
  const userMessage = buildUserMessage(prompt, existingMarkdown, resources);
  const { text: raw, usage } = await callModel(effectiveModel, systemPrompt, userMessage);

  const html = raw
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return { html, usedModelId: effectiveModelId, usage };
}

export async function runPlanSession(
  userPrompt: string,
  modelId: string = DEFAULT_MODEL_ID,
  resources?: Resource[],
  contextId?: string,
  priorMessages?: PlanMessage[]
): Promise<PlanResult> {
  const model = getModel(modelId);
  if (!model) throw new Error(`Unbekanntes Modell: ${modelId}`);

  const systemPrompt = await buildPlanSystemPrompt(contextId);
  const resourceSummary =
    resources && resources.length > 0
      ? `\n\nVerfügbare Ressourcen: ${resources.map((r) => r.name).join(", ")}`
      : "";

  let messages: PlanMessage[];
  if (priorMessages && priorMessages.length > 0) {
    messages = [...priorMessages, { role: "user", content: userPrompt }];
  } else {
    messages = [
      { role: "user", content: buildUserMessage(userPrompt + resourceSummary, undefined, resources) },
    ];
  }

  const { text: raw } = await callModelMultiTurn(model, systemPrompt, messages);

  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as PlanResult;
    return {
      interpretation: parsed.interpretation ?? "",
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      proposal: parsed.proposal ?? "",
      ready: Boolean(parsed.ready),
    };
  } catch {
    return {
      interpretation: raw.slice(0, 800),
      questions: [],
      proposal: "Ich bin bereit das Dokument zu erstellen.",
      ready: false,
    };
  }
}

export async function streamMarkdownDocument(
  prompt: string,
  modelId: string = DEFAULT_MODEL_ID,
  onChunk: (text: string) => void,
  existingMarkdown?: string,
  resources?: Resource[],
  contextId?: string
): Promise<{ markdown: string; usage: TokenUsage }> {
  const model = getModel(modelId);
  if (!model) throw new Error(`Unbekanntes Modell: ${modelId}`);

  const systemPrompt = await buildSystemPrompt(contextId);
  const userMessage = buildUserMessage(prompt, existingMarkdown, resources);
  const { text: markdown, usage } = await callModel(model, systemPrompt, userMessage);
  onChunk(markdown);
  return { markdown, usage };
}
