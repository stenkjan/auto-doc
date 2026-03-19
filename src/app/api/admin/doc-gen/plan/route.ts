import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { runPlanSession } from "@/lib/doc-gen/ai-engine";
import type { Resource, PlanMessage } from "@/lib/doc-gen/ai-engine";

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  let body: {
    prompt: string;
    modelId?: string;
    contextId?: string;
    resources?: Resource[];
    priorMessages?: PlanMessage[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  const { prompt, modelId, contextId, resources, priorMessages } = body;

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "prompt ist erforderlich" }, { status: 400 });
  }

  try {
    const planResult = await runPlanSession(
      prompt,
      modelId,
      resources,
      contextId,
      priorMessages
    );
    return NextResponse.json({ planResult });
  } catch (err) {
    console.error("[plan] Fehler:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Plan-Modus Fehler" },
      { status: 500 }
    );
  }
}
