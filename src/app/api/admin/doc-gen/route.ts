import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureTemplatesRegistered } from "@/lib/doc-gen/init";
import { generateDocument } from "@/lib/doc-gen/ai-engine";
import { getTemplate, listTemplates } from "@/lib/doc-gen/template-registry";
import { AI_MODELS } from "@/lib/doc-gen/models";

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  ensureTemplatesRegistered();

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "templates") {
    return NextResponse.json({ templates: listTemplates(), models: AI_MODELS });
  }

  if (action === "preview-default") {
    const type = searchParams.get("type") ?? "cost-plan";
    const template = getTemplate(type);
    if (!template) {
      return NextResponse.json({ error: "Unknown template" }, { status: 404 });
    }
    const html = template.generateHTML(template.defaultData);
    return NextResponse.json({ html, data: template.defaultData });
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

  ensureTemplatesRegistered();

  const body = await request.json();
  const { prompt, templateType, modelId, data: directData } = body;

  if (!prompt && !directData) {
    return NextResponse.json(
      { error: "Either prompt or data is required" },
      { status: 400 }
    );
  }

  try {
    let html: string;
    let generatedData: unknown;
    let resolvedType: string;

    if (directData && templateType) {
      const template = getTemplate(templateType);
      if (!template) {
        return NextResponse.json(
          { error: `Unknown template: ${templateType}` },
          { status: 400 }
        );
      }
      html = template.generateHTML(directData);
      generatedData = directData;
      resolvedType = templateType;
    } else {
      const result = await generateDocument(prompt, templateType, modelId);
      html = result.html;
      generatedData = result.data;
      resolvedType = result.templateType;
    }

    const hash = crypto.randomBytes(8).toString("hex");
    const title =
      (generatedData as Record<string, string>)?.clientName ??
      (generatedData as Record<string, string>)?.projectRef ??
      `Document ${hash}`;

    let document = null;
    try {
      document = await prisma.generatedDocument.create({
        data: {
          hash,
          templateType: resolvedType,
          title,
          prompt: prompt ?? "Direct data input",
          inputData: body,
          generatedData: generatedData as object,
        },
      });
    } catch (dbError) {
      console.warn("Database not available, returning without persistence:", dbError);
    }

    return NextResponse.json({
      id: document?.id ?? hash,
      hash,
      templateType: resolvedType,
      title,
      html,
      data: generatedData,
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
