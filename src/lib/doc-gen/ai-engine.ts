import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";
import path from "path";
import { getTemplate, listTemplates, getSchemaDescription } from "./template-registry";
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

async function buildSystemPrompt(templateType?: string): Promise<string> {
  const globalRules = await loadRulesFile("global-rules.md");
  const permissions = await loadRulesFile("user-permissions.md");
  const templateList = listTemplates()
    .map((t) => `- **${t.type}**: ${t.label} – ${t.description}`)
    .join("\n");
  let typeRules = "";
  if (templateType) {
    typeRules = await loadRulesFile(`document-types/${templateType}.md`);
  }
  return `Du bist ein Dokumentengenerator-Assistent für die Firma Hoam (Eco Chalets GmbH).
Deine Aufgabe ist es, aus Benutzer-Prompts strukturierte JSON-Daten zu erzeugen,
die dann in professionelle PDF-Dokumente umgewandelt werden.

${globalRules}

${permissions}

## Verfügbare Dokumentvorlagen
${templateList}

${typeRules ? `## Spezifische Regeln für "${templateType}"\n${typeRules}` : ""}

## Wichtige Anweisungen
- Antworte IMMER mit validem JSON, das exakt dem Schema der gewählten Vorlage entspricht.
- Kein Markdown, keine Erklärungen – nur das JSON-Objekt.
- Verwende sinnvolle Standardwerte für fehlende Felder.
- Alle Texte auf Deutsch (Österreich).`;
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

  // Strip "openrouter/" prefix to get the actual model path
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
/*  Public functions                                                    */
/* ------------------------------------------------------------------ */

export interface ClassificationResult {
  templateType: string;
  confidence: number;
  extractedFields: Record<string, unknown>;
  missingFields: string[];
}

export async function classifyIntent(
  prompt: string,
  modelId: string = DEFAULT_MODEL_ID
): Promise<ClassificationResult> {
  const model = getModel(modelId);
  if (!model) throw new Error(`Unknown model: ${modelId}`);

  const templates = listTemplates();
  const templateInfo = templates
    .map((t) => `${t.type}: ${t.label} – ${t.description}`)
    .join("\n");

  const system = `Du analysierst Benutzer-Prompts und klassifizierst, welcher Dokumenttyp gewünscht wird.
Verfügbare Typen:\n${templateInfo}

Antworte NUR mit einem JSON-Objekt in diesem Format:
{
  "templateType": "<typ>",
  "confidence": <0.0-1.0>,
  "extractedFields": { ... alle erkannten Datenfelder ... },
  "missingFields": ["feld1", "feld2"]
}`;

  const text = await callModel(model, system, prompt);
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Model returned no valid JSON for classification");

  return JSON.parse(jsonMatch[0]) as ClassificationResult;
}

export async function generateDocumentData(
  prompt: string,
  templateType: string,
  modelId: string = DEFAULT_MODEL_ID,
  existingData?: Record<string, unknown>
): Promise<unknown> {
  const template = getTemplate(templateType);
  if (!template) throw new Error(`Unknown template type: ${templateType}`);

  const model = getModel(modelId);
  if (!model) throw new Error(`Unknown model: ${modelId}`);

  const schemaDescription = getSchemaDescription(templateType);
  const systemPrompt = await buildSystemPrompt(templateType);

  const userMessage = existingData
    ? `Benutzer-Prompt: ${prompt}

Bereits vorhandene Daten (ergänze/überschreibe basierend auf dem Prompt):
${JSON.stringify(existingData, null, 2)}

JSON-Schema der Vorlage:
${schemaDescription}

Erzeuge das vollständige JSON-Objekt für die Dokumentvorlage "${templateType}".`
    : `Benutzer-Prompt: ${prompt}

JSON-Schema der Vorlage:
${schemaDescription}

Erzeuge das vollständige JSON-Objekt für die Dokumentvorlage "${templateType}".
Verwende die Standardwerte als Basis und passe sie gemäß dem Prompt an.`;

  const text = await callModel(model, systemPrompt, userMessage);
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Model returned no valid JSON for document generation");

  const parsed = JSON.parse(jsonMatch[0]);
  const validation = template.schema.safeParse(parsed);
  if (!validation.success) {
    console.warn("Validation failed, using raw data:", validation.error);
    return parsed;
  }
  return validation.data;
}

export async function generateDocument(
  prompt: string,
  templateType?: string,
  modelId: string = DEFAULT_MODEL_ID
) {
  if (!templateType) {
    const classification = await classifyIntent(prompt, modelId);
    templateType = classification.templateType;
  }

  const template = getTemplate(templateType);
  if (!template) throw new Error(`Unknown template type: ${templateType}`);

  const data = await generateDocumentData(prompt, templateType, modelId);
  const html = template.generateHTML(data);

  return { templateType, data, html };
}
