import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, isAdminUser, getAuthSession } from "@/lib/admin-auth";
import { streamText, stepCountIs } from "ai";
import type { ModelMessage } from "ai";
import { getLanguageModel } from "@/lib/doc-gen/models";
import { DEFAULT_CONTEXT_ID } from "@/lib/doc-gen/context-registry";
import { createDocGenTools } from "@/lib/doc-gen/tools";
import { buildUserMessage, buildSystemPrompt, type Resource } from "@/lib/doc-gen/ai-engine";
import { createDocRun, updateDocRunUsage } from "@/lib/billing/run-tracker";
import crypto from "crypto";

export const maxDuration = 300;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const bodyLimit = "20mb";

const FREE_MODEL_ID = "openrouter/free";

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  const {
    messages,
    modelId = FREE_MODEL_ID,
    contextId = DEFAULT_CONTEXT_ID,
    existingMarkdown,
    resources,
    sessionId,
    designStandard,
    customDesignPrompt,
    spendingLimitEur,
  } = (await request.json()) as {
    messages: ModelMessage[];
    modelId?: string;
    contextId?: string;
    existingMarkdown?: string;
    resources?: Resource[];
    sessionId?: string;
    designStandard?: string;
    customDesignPrompt?: string;
    spendingLimitEur?: number;
  };

  if (!messages || messages.length === 0) {
    return new Response("Messages are required", { status: 400 });
  }

  const session = await getAuthSession();

  // Non-free models are restricted to admins
  if (modelId !== FREE_MODEL_ID && !isAdminUser(session)) {
    return NextResponse.json(
      { error: "Dieses Modell erfordert einen Admin-Zugang" },
      { status: 403 }
    );
  }

  const activeSessionId = sessionId || crypto.randomBytes(8).toString("hex");
  const userId = session?.user?.id;
  const isAdmin = isAdminUser(session);

  // For non-admin users, ensure a DocRun exists to track costs
  if (!isAdmin && userId) {
    await createDocRun({ userId, sessionId: activeSessionId, modelId, spendingLimitEur });

    // Check if the run has already hit its spending limit
    const { limitReached, estimatedCostEur, spendingLimitEur: limit } =
      await (async () => {
        const { getDocRun } = await import("@/lib/billing/run-tracker");
        const run = await getDocRun(activeSessionId);
        if (!run || run.spendingLimitEur == null) return { limitReached: false, estimatedCostEur: 0, spendingLimitEur: null };
        return {
          limitReached: run.estimatedCostEur >= run.spendingLimitEur,
          estimatedCostEur: run.estimatedCostEur,
          spendingLimitEur: run.spendingLimitEur,
        };
      })();

    if (limitReached) {
      return NextResponse.json(
        {
          error: "Ausgabelimit erreicht",
          limitReached: true,
          estimatedCostEur,
          spendingLimitEur: limit,
        },
        { status: 402 }
      );
    }
  }

  const lastMessage = messages[messages.length - 1];
  const lastContent =
    typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

  const enhancedPrompt = buildUserMessage(lastContent, existingMarkdown, resources);
  const enhancedMessages: ModelMessage[] = [
    ...messages.slice(0, -1),
    { role: "user" as const, content: enhancedPrompt as any },
  ];

  const model = getLanguageModel(modelId);
  const tools = createDocGenTools(activeSessionId);
  const systemPrompt = await buildSystemPrompt(contextId, designStandard, customDesignPrompt);

  const result = streamText({
    model,
    messages: enhancedMessages,
    tools,
    stopWhen: stepCountIs(7),
    system: systemPrompt as any,
    onFinish: async ({ usage }) => {
      if (!isAdmin && userId && usage) {
        await updateDocRunUsage(activeSessionId, {
          promptTokens: usage.inputTokens ?? 0,
          completionTokens: usage.outputTokens ?? 0,
        });
      }
    },
  });

  return result.toTextStreamResponse();
}
