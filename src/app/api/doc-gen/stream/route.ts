import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { streamMarkdownDocument, type Resource } from "@/lib/doc-gen/ai-engine";
import { DEFAULT_MODEL_ID, estimateCostEur } from "@/lib/doc-gen/models";
import { DEFAULT_CONTEXT_ID } from "@/lib/doc-gen/context-registry";

export const maxDuration = 120;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const bodyLimit = "20mb";

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  const {
    prompt,
    modelId = DEFAULT_MODEL_ID,
    contextId = DEFAULT_CONTEXT_ID,
    existingMarkdown,
    resources,
  } = await request.json() as {
    prompt?: string;
    modelId?: string;
    contextId?: string;
    existingMarkdown?: string;
    resources?: Resource[];
  };

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
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
        const resourceCount = resources?.length ?? 0;
        send("status", {
          message: resourceCount > 0
            ? `Generiere Dokument mit ${resourceCount} Referenz${resourceCount === 1 ? "" : "en"}...`
            : "Generiere Dokument...",
        });

        const { markdown, usage } = await streamMarkdownDocument(
          prompt,
          modelId,
          (chunk) => { send("chunk", { text: chunk }); },
          existingMarkdown,
          resources,
          contextId
        );

        // Calculate cost estimate if we have token usage
        let cost: { formatted: string; inputTokens: number; outputTokens: number } | null = null;
        if (usage) {
          const estimate = estimateCostEur(modelId, usage.inputTokens, usage.outputTokens);
          if (estimate) {
            cost = {
              formatted: estimate.formatted,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
            };
          }
        }

        send("complete", { markdown, cost });
      } catch (error) {
        send("error", {
          message: error instanceof Error ? error.message : "Unknown error",
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
