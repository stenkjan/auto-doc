import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import {
  extractDriveFileId,
  fetchDriveResource,
} from "@/lib/doc-gen/drive-output";
import { scrapeUrl } from "@/lib/doc-gen/web-scraper";
import mammoth from "mammoth";

export const bodyLimit = "20mb";

function isDriveUrl(url: string): boolean {
  return (
    url.includes("drive.google.com") ||
    url.includes("docs.google.com") ||
    url.includes("sheets.google.com") ||
    url.includes("slides.google.com")
  );
}


export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  const contentType = request.headers.get("content-type") ?? "";

  // ── URL (Drive or any web URL) ─────────────────────────────────────
  if (contentType.includes("application/json")) {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    try {
      // Google Drive / Docs / Sheets → use Drive API
      if (isDriveUrl(url)) {
        const fileId = extractDriveFileId(url);
        if (!fileId) {
          return NextResponse.json(
            { error: "Ungültige Google Drive URL – Datei-ID nicht gefunden" },
            { status: 400 }
          );
        }
        const resource = await fetchDriveResource(fileId);
        return NextResponse.json({ ...resource, sourceType: "drive" });
      }

      // Any other URL → use the web scraper
      const resource = await scrapeUrl(url);
      return NextResponse.json(resource);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Fehler beim Laden der URL" },
        { status: 500 }
      );
    }
  }

  // ── File upload (multipart/form-data) ─────────────────────────────
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Keine Datei empfangen" }, { status: 400 });
    }

    const name = file.name;
    const mime = file.type;
    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      let content = "";

      if (
        mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        name.endsWith(".docx")
      ) {
        const result = await mammoth.extractRawText({ buffer });
        content = result.value;
      } else if (mime === "application/pdf" || name.endsWith(".pdf")) {
        let pdfWarning: string | undefined;
        try {
          // Use the Node.js canvas-free build which doesn't require a worker
          const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs") as typeof import("pdfjs-dist");
          
          // Set workerSrc to avoid "No GlobalWorkerOptions.workerSrc specified" error
          // We use a dummy path since we're running in Node.js server-side
          pdfjs.GlobalWorkerOptions.workerSrc = "pdfjs-dist/build/pdf.worker.mjs";
          
          const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
          const doc = await pdfjs.getDocument({
            data: uint8,
            useWorkerFetch: false,
            isEvalSupported: false,
            useSystemFonts: true,
            disableAutoFetch: true,
            standardFontDataUrl: undefined,
          }).promise;

          const pageTexts: string[] = [];
          for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((item: any) => item.str ?? "")
              .join(" ");
            pageTexts.push(pageText);
          }
          content = pageTexts.join("\n").replace(/\s{3,}/g, "  ").trim();

          if (!content.trim()) {
            pdfWarning = "PDF enthält keinen extrahierbaren Text (möglicherweise gescannt oder bildbasiert).";
            console.warn(`[fetch-resource] PDF leer nach Extraktion: ${name}`);
          }
        } catch (pdfErr) {
          const errMsg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
          console.error(`[fetch-resource] PDF-Extraktion fehlgeschlagen für "${name}":`, errMsg);
          pdfWarning = `PDF-Textextraktion fehlgeschlagen: ${errMsg}`;
          content = "";
        }
        if (pdfWarning) {
          return NextResponse.json({ name, content, type: "text", warning: pdfWarning });
        }
      } else if (
        mime.startsWith("text/") ||
        name.endsWith(".txt") ||
        name.endsWith(".md") ||
        name.endsWith(".csv") ||
        name.endsWith(".json")
      ) {
        content = buffer.toString("utf-8");
      } else {
        return NextResponse.json(
          {
            error: `Dateityp "${mime || name}" wird nicht unterstützt. Erlaubt: PDF, DOCX, TXT, MD, CSV, JSON.`,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({ name, content, type: "text", sourceType: "file" });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Fehler beim Verarbeiten der Datei" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Ungültiger Content-Type" }, { status: 400 });
}
