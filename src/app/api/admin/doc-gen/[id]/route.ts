import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureTemplatesRegistered } from "@/lib/doc-gen/init";
import { getTemplate } from "@/lib/doc-gen/template-registry";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  ensureTemplatesRegistered();

  const { id } = await params;

  try {
    const doc = await prisma.generatedDocument.findFirst({
      where: { OR: [{ id }, { hash: id }] },
    });

    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const template = getTemplate(doc.templateType);
    const html = template
      ? template.generateHTML(doc.generatedData)
      : "<p>Template not found</p>";

    return NextResponse.json({
      id: doc.id,
      hash: doc.hash,
      templateType: doc.templateType,
      title: doc.title,
      html,
      data: doc.generatedData,
      createdAt: doc.createdAt,
      driveUrl: doc.driveUrl,
    });
  } catch (error) {
    console.error("Failed to fetch document:", error);
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    );
  }
}
