import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireAdminAuth, isAdminUser, getAuthSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { generateMarkdownDocument } from "@/lib/doc-gen/ai-engine";
import { AI_MODELS, DEFAULT_MODEL_ID } from "@/lib/doc-gen/models";

const FREE_MODEL_ID = "openrouter/free";

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "models") {
    return NextResponse.json({ models: AI_MODELS });
  }

  try {
    const documents = await prisma.generatedDocument.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        hash: true,
        templateType: true,
        title: true,
        createdAt: true,
        driveUrl: true,
      },
    });
    return NextResponse.json({ documents });
  } catch {
    return NextResponse.json({ documents: [] });
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  const body = await request.json();
  const {
    prompt,
    modelId = DEFAULT_MODEL_ID,
    existingMarkdown,
  } = body as {
    prompt?: string;
    modelId?: string;
    existingMarkdown?: string;
  };

  // Non-free models restricted to admins
  const session = await getAuthSession();
  if (modelId !== FREE_MODEL_ID && !isAdminUser(session)) {
    return NextResponse.json(
      { error: "Dieses Modell erfordert einen Admin-Zugang" },
      { status: 403 }
    );
  }

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  try {
    const { markdown } = await generateMarkdownDocument(
      prompt,
      modelId,
      existingMarkdown
    );

    const hash = crypto.randomBytes(8).toString("hex");
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : `Dokument ${hash}`;

    let document = null;
    try {
      document = await prisma.generatedDocument.create({
        data: {
          hash,
          templateType: "markdown",
          title,
          prompt,
          inputData: { prompt, modelId },
          generatedData: { markdown },
        },
      });
    } catch (dbError) {
      console.warn("Database not available, returning without persistence:", dbError);
    }

    return NextResponse.json({
      id: document?.id ?? hash,
      hash,
      title,
      markdown,
    });
  } catch (error) {
    console.error("Document generation failed:", error);
    return NextResponse.json(
      {
        error: "Generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
