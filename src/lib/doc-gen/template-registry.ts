import { z } from "zod/v4";

export interface DocumentTemplate<T = unknown> {
  type: string;
  label: string;
  description: string;
  schema: z.ZodType<T>;
  defaultData: T;
  generateHTML: (data: T) => string;
  generateExcel?: (data: T) => Promise<Buffer>;
}

const registry = new Map<string, DocumentTemplate>();

export function registerTemplate<T>(template: DocumentTemplate<T>) {
  registry.set(template.type, template as DocumentTemplate);
}

export function getTemplate(type: string): DocumentTemplate | undefined {
  return registry.get(type);
}

export function listTemplates(): Array<{
  type: string;
  label: string;
  description: string;
}> {
  return Array.from(registry.values()).map((t) => ({
    type: t.type,
    label: t.label,
    description: t.description,
  }));
}

export function validateData(
  type: string,
  data: unknown
): { success: true; data: unknown } | { success: false; error: string } {
  const template = registry.get(type);
  if (!template) return { success: false, error: `Unknown template: ${type}` };

  const result = template.schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };

  return {
    success: false,
    error: z.prettifyError(result.error),
  };
}

export function getSchemaDescription(type: string): string | undefined {
  const template = registry.get(type);
  if (!template) return undefined;

  return JSON.stringify(
    z.toJSONSchema(template.schema, { target: "draft-2020-12" }),
    null,
    2
  );
}
