import fs from "fs/promises";
import path from "path";
import { BUILTIN_CONTEXTS, DEFAULT_CONTEXT_ID, type AIContext } from "./context-registry";

const CUSTOM_DIR = path.join(
  process.cwd(),
  "src/lib/doc-gen/contexts/custom"
);

async function loadCustomContexts(): Promise<AIContext[]> {
  try {
    await fs.mkdir(CUSTOM_DIR, { recursive: true });
    const files = await fs.readdir(CUSTOM_DIR);
    return await Promise.all(
      files
        .filter((f) => f.endsWith(".md"))
        .map(async (file) => {
          const id = file.replace(/\.md$/, "");
          const content = await fs.readFile(
            path.join(CUSTOM_DIR, file),
            "utf-8"
          );
          const firstLine = content.split("\n")[0] ?? "";
          const label = firstLine.startsWith("# ")
            ? firstLine.slice(2).trim()
            : id;
          const descMatch = content.match(/\n([^\n#][^\n]{5,80})/);
          const description = descMatch
            ? descMatch[1].trim()
            : "Benutzerdefinierter Kontext";
          return {
            id,
            label,
            description,
            filePath: `contexts/custom/${file}`,
            custom: true,
          };
        })
    );
  } catch {
    return [];
  }
}

/**
 * Server-side: returns built-in contexts merged with any custom .md files
 * found in contexts/custom/. Results are NOT cached (always fresh).
 */
export async function loadAllContexts(): Promise<AIContext[]> {
  const custom = await loadCustomContexts();
  return [...BUILTIN_CONTEXTS, ...custom];
}

/**
 * Server-side: resolves a context by ID, including custom contexts.
 */
export async function resolveContext(
  id: string = DEFAULT_CONTEXT_ID
): Promise<AIContext | undefined> {
  const all = await loadAllContexts();
  return all.find((c) => c.id === id);
}

/**
 * Server-side: load the markdown content for a given context file path.
 */
export async function loadContextContent(filePath: string): Promise<string> {
  const fullPath = path.join(process.cwd(), "src/lib/doc-gen", filePath);
  try {
    return await fs.readFile(fullPath, "utf-8");
  } catch {
    return "";
  }
}
