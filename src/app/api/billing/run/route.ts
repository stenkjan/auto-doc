import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createDocRun, getDocRun } from "@/lib/billing/run-tracker";
import { isAdminUser } from "@/lib/admin-auth";

/**
 * POST /api/billing/run   — create a DocRun for a session
 * GET  /api/billing/run?sessionId=... — get current cost/status
 */

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isAdminUser(session)) {
    return NextResponse.json({ skipped: true, reason: "admin" });
  }

  const { sessionId, modelId, spendingLimitEur } = (await request.json()) as {
    sessionId: string;
    modelId: string;
    spendingLimitEur?: number;
  };

  if (!sessionId || !modelId) {
    return NextResponse.json({ error: "sessionId and modelId are required" }, { status: 400 });
  }

  const run = await createDocRun({
    userId: session.user.id,
    sessionId,
    modelId,
    spendingLimitEur,
  });

  return NextResponse.json({ run });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const run = await getDocRun(sessionId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json({
    sessionId: run.sessionId,
    estimatedCostEur: run.estimatedCostEur,
    spendingLimitEur: run.spendingLimitEur,
    status: run.status,
    totalInputTokens: run.totalInputTokens,
    totalOutputTokens: run.totalOutputTokens,
  });
}
