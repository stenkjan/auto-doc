import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { requireAdminAuth } from "@/lib/admin-auth";
import { BUILTIN_CONTEXTS } from "@/lib/doc-gen/context-registry";

const CUSTOM_CONTEXTS_DIR = path.join(
  process.cwd(),
  "src/lib/doc-gen/contexts/custom"
);

async function ensureDir() {
  await fs.mkdir(CUSTOM_CONTEXTS_DIR, { recursive: true });
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[äöü]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue" }[c] ?? c))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ── GET – list all custom contexts ─────────────────────────────── */
export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  await ensureDir();

  const files = await fs.readdir(CUSTOM_CONTEXTS_DIR);
  const contexts = await Promise.all(
    files
      .filter((f) => f.endsWith(".md"))
      .map(async (file) => {
        const id = file.replace(/\.md$/, "");
        const content = await fs.readFile(
          path.join(CUSTOM_CONTEXTS_DIR, file),
          "utf-8"
        );
        // Extract label from first H1 line if present
        const firstLine = content.split("\n")[0] ?? "";
        const label = firstLine.startsWith("# ")
          ? firstLine.slice(2).trim()
          : id;
        const descMatch = content.match(/\n([^\n#][^\n]{5,80})/);
        const description = descMatch ? descMatch[1].trim() : "Benutzerdefinierter Kontext";
        return { id, label, description, content, custom: true };
      })
  );

  return NextResponse.json({ contexts });
}

/* ── POST – create a new custom context ─────────────────────────── */
export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  await ensureDir();

  const { label, description, content } = await request.json() as {
    label?: string;
    description?: string;
    content?: string;
  };

  if (!label?.trim()) {
    return NextResponse.json({ error: "Label ist erforderlich" }, { status: 400 });
  }
  if (!content?.trim()) {
    return NextResponse.json({ error: "Inhalt ist erforderlich" }, { status: 400 });
  }

  const id = slugify(label);
  if (!id) {
    return NextResponse.json({ error: "Ungültiger Name" }, { status: 400 });
  }

  const filePath = path.join(CUSTOM_CONTEXTS_DIR, `${id}.md`);

  // Check for conflicts with built-in context IDs
  const BUILTIN_IDS = BUILTIN_CONTEXTS.map((c) => c.id);
  if (BUILTIN_IDS.includes(id)) {
    return NextResponse.json(
      { error: `ID "${id}" wird bereits von einem eingebauten Kontext verwendet` },
      { status: 409 }
    );
  }

  try {
    await fs.access(filePath);
    return NextResponse.json(
      { error: `Ein Kontext mit dem ID "${id}" existiert bereits` },
      { status: 409 }
    );
  } catch {
    // File does not exist – good
  }

  const fileContent = `# ${label.trim()}\n\n${description?.trim() ? `${description.trim()}\n\n` : ""}${content.trim()}\n`;
  await fs.writeFile(filePath, fileContent, "utf-8");

  return NextResponse.json({ id, label, description, content: fileContent }, { status: 201 });
}

/* ── PUT – update an existing custom context ─────────────────────── */
export async function PUT(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  const { id, label, content } = await request.json() as {
    id?: string;
    label?: string;
    content?: string;
  };

  if (!id) {
    return NextResponse.json({ error: "ID ist erforderlich" }, { status: 400 });
  }
  if (!content?.trim()) {
    return NextResponse.json({ error: "Inhalt ist erforderlich" }, { status: 400 });
  }

  const filePath = path.join(CUSTOM_CONTEXTS_DIR, `${id}.md`);

  try {
    await fs.access(filePath);
  } catch {
    return NextResponse.json({ error: `Kontext "${id}" nicht gefunden` }, { status: 404 });
  }

  const existingContent = await fs.readFile(filePath, "utf-8");
  const firstLine = existingContent.split("\n")[0] ?? "";
  const existingLabel = firstLine.startsWith("# ") ? firstLine.slice(2).trim() : id;
  const finalLabel = label?.trim() ?? existingLabel;

  const newContent = content.startsWith("# ")
    ? content
    : `# ${finalLabel}\n\n${content.trim()}\n`;

  await fs.writeFile(filePath, newContent, "utf-8");

  return NextResponse.json({ id, label: finalLabel, content: newContent });
}

/* ── DELETE – remove a custom context ───────────────────────────── */
export async function DELETE(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  const { id } = await request.json() as { id?: string };

  if (!id) {
    return NextResponse.json({ error: "ID ist erforderlich" }, { status: 400 });
  }

  const filePath = path.join(CUSTOM_CONTEXTS_DIR, `${id}.md`);

  try {
    await fs.access(filePath);
  } catch {
    return NextResponse.json({ error: `Kontext "${id}" nicht gefunden` }, { status: 404 });
  }

  await fs.unlink(filePath);

  return NextResponse.json({ success: true });
}
