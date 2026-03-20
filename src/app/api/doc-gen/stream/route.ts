import { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { streamText, type CoreMessage } from "ai";
import { getLanguageModel } from "@/lib/doc-gen/models";
import { DEFAULT_CONTEXT_ID } from "@/lib/doc-gen/context-registry";
import { createDocGenTools } from "@/lib/doc-gen/tools";
import { buildUserMessage, type Resource } from "@/lib/doc-gen/ai-engine";
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
    messages: CoreMessage[];
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
  
  // Build the enhanced prompt including existing markdown and file resources
  const enhancedPrompt = buildUserMessage(
    lastMessage.content,
    existingMarkdown,
    resources
  );

  // Replace the last message with the enhanced one
  const enhancedMessages = [...messages];
  enhancedMessages[enhancedMessages.length - 1] = {
    ...lastMessage,
    content: enhancedPrompt,
  };

  const model = getLanguageModel(modelId);
  const tools = createDocGenTools(activeSessionId);

  // Initialize the stream using the Vercel AI SDK
  const result = streamText({
    model,
    messages: enhancedMessages,
    tools,
    maxSteps: 5, // Allow the agent to call tools up to 5 times iteratively
    system: `Du bist ein hochintelligenter, agentischer Dokumenten-Assistent...
Greife auf Tools zu um Fakten zu finden!
Dein Kontext-Token: ${contextId} (wird im Backend geladen, falls nötig).
`,
  });

  return result.toDataStreamResponse();
}
