import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";
import path from "path";
import { getTemplate, listTemplates, getSchemaDescription } from "./template-registry";

const anthropic = new Anthropic();

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

export interface ClassificationResult {
  templateType: string;
  confidence: number;
  extractedFields: Record<string, unknown>;
  missingFields: string[];
}

export async function classifyIntent(
  prompt: string
): Promise<ClassificationResult> {
  const templates = listTemplates();
  const templateInfo = templates
    .map((t) => `${t.type}: ${t.label} – ${t.description}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: `Du analysierst Benutzer-Prompts und klassifizierst, welcher Dokumenttyp gewünscht wird.
Verfügbare Typen:\n${templateInfo}

Antworte NUR mit einem JSON-Objekt in diesem Format:
{
  "templateType": "<typ>",
  "confidence": <0.0-1.0>,
  "extractedFields": { ... alle erkannten Datenfelder ... },
  "missingFields": ["feld1", "feld2"]
}`,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Claude returned no valid JSON for classification");
  }

  return JSON.parse(jsonMatch[0]) as ClassificationResult;
}

export async function generateDocumentData(
  prompt: string,
  templateType: string,
  existingData?: Record<string, unknown>
): Promise<unknown> {
  const template = getTemplate(templateType);
  if (!template) throw new Error(`Unknown template type: ${templateType}`);

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

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Claude returned no valid JSON for document generation");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  const validation = template.schema.safeParse(parsed);
  if (!validation.success) {
    console.warn("Validation failed, using raw data:", validation.error);
    return parsed;
  }

  return validation.data;
}

export async function generateDocument(prompt: string, templateType?: string) {
  if (!templateType) {
    const classification = await classifyIntent(prompt);
    templateType = classification.templateType;
  }

  const template = getTemplate(templateType);
  if (!template) throw new Error(`Unknown template type: ${templateType}`);

  const data = await generateDocumentData(prompt, templateType);
  const html = template.generateHTML(data);

  return { templateType, data, html };
}
