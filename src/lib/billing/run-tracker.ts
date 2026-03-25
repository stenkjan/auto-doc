import { prisma } from "@/lib/prisma";
import { estimateCostEur } from "@/lib/doc-gen/models";

export interface TokenUsage {
  promptTokens: number;   // maps to inputTokens in Vercel AI SDK v6
  completionTokens: number; // maps to outputTokens in Vercel AI SDK v6
}


/**
 * Create a new DocRun for a billing session. Idempotent — returns existing if already created.
 */
export async function createDocRun({
  userId,
  sessionId,
  modelId,
  spendingLimitEur,
}: {
  userId: string;
  sessionId: string;
  modelId: string;
  spendingLimitEur?: number;
}) {
  return prisma.docRun.upsert({
    where: { sessionId },
    update: {},
    create: {
      userId,
      sessionId,
      modelId,
      spendingLimitEur: spendingLimitEur ?? null,
    },
  });
}

/**
 * Append token usage from a single stream step to the DocRun.
 * Recalculates estimatedCostEur. Returns updated run.
 */
export async function updateDocRunUsage(
  sessionId: string,
  usage: TokenUsage
): Promise<{ estimatedCostEur: number; spendingLimitEur: number | null; limitReached: boolean }> {
  const run = await prisma.docRun.findUnique({ where: { sessionId } });
  if (!run) {
    return { estimatedCostEur: 0, spendingLimitEur: null, limitReached: false };
  }

  const newInput = run.totalInputTokens + usage.promptTokens;
  const newOutput = run.totalOutputTokens + usage.completionTokens;
  const cost = estimateCostEur(run.modelId, newInput, newOutput);
  const newCostEur = cost?.eur ?? 0;

  await prisma.docRun.update({
    where: { sessionId },
    data: {
      totalInputTokens: newInput,
      totalOutputTokens: newOutput,
      estimatedCostEur: newCostEur,
    },
  });

  const limitReached =
    run.spendingLimitEur != null && newCostEur >= run.spendingLimitEur;

  return {
    estimatedCostEur: newCostEur,
    spendingLimitEur: run.spendingLimitEur,
    limitReached,
  };
}

/**
 * Get current state of a DocRun by sessionId.
 */
export async function getDocRun(sessionId: string) {
  return prisma.docRun.findUnique({ where: { sessionId } });
}

/**
 * Mark a DocRun as checked_out / paid.
 */
export async function updateDocRunStatus(
  sessionId: string,
  status: "checked_out" | "paid" | "abandoned",
  stripePaymentIntentId?: string
) {
  return prisma.docRun.update({
    where: { sessionId },
    data: {
      status,
      ...(stripePaymentIntentId ? { stripePaymentIntentId } : {}),
    },
  });
}
