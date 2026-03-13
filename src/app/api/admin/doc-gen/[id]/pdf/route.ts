import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { ensureTemplatesRegistered } from "@/lib/doc-gen/init";
import { getTemplate } from "@/lib/doc-gen/template-registry";
import { generatePDF } from "@/lib/doc-gen/pdf-generator";

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  ensureTemplatesRegistered();

  try {
    const { templateType, data } = await request.json();

    const template = getTemplate(templateType);
    if (!template) {
      return NextResponse.json(
        { error: `Unknown template: ${templateType}` },
        { status: 400 }
      );
    }

    const html = template.generateHTML(data);
    const pdfBuffer = await generatePDF(html);

    const title =
      (data as Record<string, string>)?.projectRef ?? "document";

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Kostenplanung-${title}.pdf"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("PDF generation failed:", error);
    return NextResponse.json(
      {
        error: "PDF generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
