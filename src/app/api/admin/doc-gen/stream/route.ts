import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { ensureTemplatesRegistered } from "@/lib/doc-gen/init";
import { classifyIntent, generateDocumentData } from "@/lib/doc-gen/ai-engine";
import { getTemplate, listTemplates } from "@/lib/doc-gen/template-registry";

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  ensureTemplatesRegistered();

  const { prompt, templateType, modelId } = await request.json();

  if (!prompt) {
    return NextResponse.json(
      { error: "Prompt is required" },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        send("status", { message: "Analysiere Prompt..." });

        let resolvedType = templateType;
        if (!resolvedType) {
          const classification = await classifyIntent(prompt, modelId);
          resolvedType = classification.templateType;
          send("classification", classification);
        }

        const template = getTemplate(resolvedType);
        if (!template) {
          send("error", {
            message: `Unbekannter Dokumenttyp: ${resolvedType}`,
            available: listTemplates(),
          });
          controller.close();
          return;
        }

        send("status", {
          message: `Generiere ${template.label}...`,
          templateType: resolvedType,
        });

        const data = await generateDocumentData(prompt, resolvedType, modelId);
        send("data", { templateType: resolvedType, data });

        const html = template.generateHTML(data);
        send("complete", {
          templateType: resolvedType,
          data,
          html,
        });
      } catch (error) {
        send("error", {
          message:
            error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
