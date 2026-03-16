import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { streamMarkdownDocument } from "@/lib/doc-gen/ai-engine";
import { DEFAULT_MODEL_ID } from "@/lib/doc-gen/models";

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  const { prompt, modelId = DEFAULT_MODEL_ID, existingMarkdown } =
    await request.json();

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
        send("status", { message: "Generiere Dokument..." });

        let fullMarkdown = "";

        const { markdown } = await streamMarkdownDocument(
          prompt,
          modelId,
          (chunk) => {
            fullMarkdown += chunk;
            send("chunk", { text: chunk });
          },
          existingMarkdown
        );

        send("complete", { markdown });
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
