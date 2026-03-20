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
  } = (await request.json()) as {
    messages: ModelMessage[];
    modelId?: string;
    contextId?: string;
    existingMarkdown?: string;
    resources?: Resource[];
    sessionId?: string;
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
    { role: "user" as const, content: enhancedPrompt },
  ];

  const model = getLanguageModel(modelId);
  const tools = createDocGenTools(activeSessionId);

  // Load full system prompt (global-rules + permissions + context-specific rules)
  const systemPrompt = await buildSystemPrompt(contextId);

  // Initialize the stream using the Vercel AI SDK
  const result = streamText({
    model,
    messages: enhancedMessages,
    tools,
    stopWhen: stepCountIs(5), // Allow the agent to call tools up to 5 times iteratively
    system: systemPrompt,
  });

  return result.toTextStreamResponse();
}
