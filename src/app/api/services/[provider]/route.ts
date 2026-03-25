import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET  /api/services/[provider] — get connection status
 * DELETE /api/services/[provider] — disconnect (remove tokens)
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { provider } = await params;
  const providerKey = provider.replace("-", "_"); // "google-drive" → "google_drive"

  const service = await prisma.connectedService.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: providerKey } },
    select: { id: true, provider: true, expiresAt: true, metadata: true, createdAt: true },
  });

  return NextResponse.json({
    connected: !!service,
    provider,
    expiresAt: service?.expiresAt ?? null,
    metadata: service?.metadata ?? null,
    connectedAt: service?.createdAt ?? null,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { provider } = await params;
  const providerKey = provider.replace("-", "_");

  await prisma.connectedService.deleteMany({
    where: { userId: session.user.id, provider: providerKey },
  });

  return NextResponse.json({ success: true, disconnected: provider });
}
