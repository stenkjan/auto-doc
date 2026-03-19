import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const sources = await prisma.source.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ sources });
  } catch (err) {
    console.error("[sources] GET Fehler:", err);
    return NextResponse.json({ error: "Fehler beim Laden der Quellen" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  let body: { type: string; label: string; config: Record<string, unknown>; enabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  const { type, label, config, enabled = true } = body;

  if (!type || !label || !config) {
    return NextResponse.json({ error: "type, label und config sind erforderlich" }, { status: 400 });
  }

  const validTypes = ["github", "mcp", "drive"];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: `Ungültiger Typ. Erlaubt: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const source = await prisma.source.create({
      data: { type, label, config, enabled },
    });
    return NextResponse.json({ source }, { status: 201 });
  } catch (err) {
    console.error("[sources] POST Fehler:", err);
    return NextResponse.json({ error: "Fehler beim Erstellen der Quelle" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  let body: { id: string; label?: string; config?: Record<string, unknown>; enabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id ist erforderlich" }, { status: 400 });

  try {
    const source = await prisma.source.update({
      where: { id },
      data: updates,
    });
    return NextResponse.json({ source });
  } catch (err) {
    console.error("[sources] PATCH Fehler:", err);
    return NextResponse.json({ error: "Fehler beim Aktualisieren der Quelle" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  let body: { id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  if (!body.id) return NextResponse.json({ error: "id ist erforderlich" }, { status: 400 });

  try {
    await prisma.source.delete({ where: { id: body.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[sources] DELETE Fehler:", err);
    return NextResponse.json({ error: "Fehler beim Löschen der Quelle" }, { status: 500 });
  }
}
