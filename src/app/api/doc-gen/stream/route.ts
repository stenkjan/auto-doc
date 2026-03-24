import { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { streamText, stepCountIs } from "ai";
import type { ModelMessage } from "ai";
import { getLanguageModel } from "@/lib/doc-gen/models";
import { DEFAULT_CONTEXT_ID } from "@/lib/doc-gen/context-registry";
import { createDocGenTools } from "@/lib/doc-gen/tools";
import { buildUserMessage, buildSystemPrompt, type Resource } from "@/lib/doc-gen/ai-engine";
import crypto from "crypto";

export const maxDuration = 300; // Allow 5 minutes for agentic iterative steps
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const bodyLimit = "20mb";

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  const {
    messages,
    modelId = "openrouter/free",
    contextId = DEFAULT_CONTEXT_ID,
    existingMarkdown,
    resources,
    sessionId,
    designStandard,
    customDesignPrompt,
  } = (await request.json()) as {
    messages: ModelMessage[];
    modelId?: string;
    contextId?: string;
    existingMarkdown?: string;
    resources?: Resource[];
    sessionId?: string;
    designStandard?: string;
    customDesignPrompt?: string;
  };

  if (!messages || messages.length === 0) {
    return new Response("Messages are required", { status: 400 });
  }

  // Generate a stateless session ID if none provided
  const activeSessionId = sessionId || crypto.randomBytes(8).toString("hex");

  // Get the latest user message
  const lastMessage = messages[messages.length - 1];
  const lastContent = typeof lastMessage.content === "string"
    ? lastMessage.content
    : JSON.stringify(lastMessage.content);

  // Build the enhanced prompt including existing markdown and file resources
  const enhancedPrompt = buildUserMessage(
    lastContent,
    existingMarkdown,
    resources
  );

  // Replace the last message with the enhanced one
  const enhancedMessages: ModelMessage[] = [
    ...messages.slice(0, -1),
    { role: "user" as const, content: enhancedPrompt as any },
  ];

  const model = getLanguageModel(modelId);
  const tools = createDocGenTools(activeSessionId);

  // Load full system prompt (global-rules + permissions + context-specific rules + design standard)
  const systemPrompt = await buildSystemPrompt(contextId, designStandard, customDesignPrompt);

  // Initialize the stream using the Vercel AI SDK
  const result = streamText({
    model,
    messages: enhancedMessages,
    tools,
    stopWhen: stepCountIs(7), // propose_plan (1) + tool calls (up to 4) + validate (1) + final write (1)
    system: systemPrompt as any,
  });

  return result.toTextStreamResponse();
}
