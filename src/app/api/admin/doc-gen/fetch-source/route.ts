import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { fetchGithubSource } from "@/lib/doc-gen/sources/github-source";
import { fetchMcpSource } from "@/lib/doc-gen/sources/mcp-source";
import { fetchDriveSource } from "@/lib/doc-gen/sources/drive-source";

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  let body: { sourceId: string; query?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  const { sourceId, query } = body;
  if (!sourceId) {
    return NextResponse.json({ error: "sourceId ist erforderlich" }, { status: 400 });
  }

  // Load source config from DB
  let source: { id: string; type: string; label: string; config: unknown } | null = null;
  try {
    source = await prisma.source.findUnique({ where: { id: sourceId } });
  } catch (err) {
    console.error("[fetch-source] DB Fehler:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }

  if (!source) {
    return NextResponse.json({ error: "Quelle nicht gefunden" }, { status: 404 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = source.config as any;

    let resources;
    switch (source.type) {
      case "github":
        resources = await fetchGithubSource({
          repoUrl: config.repoUrl,
          branch: config.branch,
          path: config.path,
          token: config.token,
          maxFiles: config.maxFiles,
        });
        break;
      case "mcp":
        resources = await fetchMcpSource(
          { serverUrl: config.serverUrl, apiKey: config.apiKey },
          query
        );
        break;
      case "drive":
        resources = await fetchDriveSource({
          folderUrl: config.folderUrl,
          maxFiles: config.maxFiles,
        });
        break;
      default:
        return NextResponse.json(
          { error: `Unbekannter Quelltyp: ${source.type}` },
          { status: 400 }
        );
    }

    return NextResponse.json({ resources });
  } catch (err) {
    console.error(`[fetch-source] Fehler für ${source.type}:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fehler beim Laden der Quelle" },
      { status: 500 }
    );
  }
}
