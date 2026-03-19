import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { generateStyledDocument } from "@/lib/doc-gen/ai-engine";
import type { Resource } from "@/lib/doc-gen/ai-engine";

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  let body: {
    prompt: string;
    modelId?: string;
    contextId?: string;
    resources?: Resource[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  const { prompt, modelId, contextId, resources } = body;

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "prompt ist erforderlich" }, { status: 400 });
  }

  try {
    const { html, usedModelId } = await generateStyledDocument(
      prompt,
      modelId,
      resources,
      contextId
    );

    return NextResponse.json({ html, usedModelId });
  } catch (err) {
    console.error("[generate-pdf] Fehler:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PDF-Generierung fehlgeschlagen" },
      { status: 500 }
    );
  }
}
