import { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { marked } from "marked";

export const dynamic = "force-dynamic";

/** Full template-quality CSS mirroring the doc-gen design system */
function documentStyles(): string {
  return `
    @page { size: A4; margin: 18mm 16mm 20mm 16mm; }

    /* ── CSS variables — overridable via <style> blocks in markdown ── */
    :root {
      --color-primary: #2F4538;
      --color-dark: #1a1a1a;
      --color-bg-subtle: #fafafa;
      --color-border: #e0e0e0;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px;
      line-height: 1.6;
      color: #1a1a1a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Typography ──────────────────────────────────────────────── */
    h1 {
      font-size: 28px;
      font-weight: 700;
      color: #1a1a1a;
      letter-spacing: -0.03em;
      margin-top: 32px;
      margin-bottom: 8px;
      line-height: 1.2;
    }
    h2 {
      font-size: 18px;
      font-weight: 700;
      color: #1a1a1a;
      letter-spacing: -0.02em;
      margin-top: 28px;
      margin-bottom: 4px;
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 6px;
      break-after: avoid;
    }
    h3 {
      font-size: 13px;
      font-weight: 700;
      color: #1a1a1a;
      margin-top: 20px;
      margin-bottom: 6px;
      break-after: avoid;
    }
    h4 {
      font-size: 11px;
      font-weight: 600;
      color: #333;
      margin-top: 14px;
      margin-bottom: 4px;
      break-after: avoid;
    }
    p {
      margin-bottom: 10px;
    }
    strong { font-weight: 600; }
    em { font-style: italic; color: #444; }

    /* ── Links ───────────────────────────────────────────────────── */
    a { color: #2F4538; text-decoration: underline; }
    @media print { a { color: inherit; text-decoration: none; } }

    /* ── Tables ──────────────────────────────────────────────────── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 10.5px;
      break-inside: avoid;
    }
    thead th {
      background: #F4F4F4;
      font-weight: 600;
      text-align: left;
      padding: 6px 8px;
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #444;
      border-bottom: 1px solid #ddd;
    }
    tbody td {
      padding: 5px 8px;
      border-bottom: 1px solid #f0f0f0;
      vertical-align: top;
    }
    tbody tr:last-child td { border-bottom: none; }
    .text-right, td:last-child { text-align: right; }

    /* ── Lists ───────────────────────────────────────────────────── */
    ul, ol {
      padding-left: 20px;
      margin-bottom: 10px;
    }
    li {
      margin-bottom: 3px;
      line-height: 1.6;
    }
    ul li::marker { color: #2F4538; }

    /* ── Code & Pre ──────────────────────────────────────────────── */
    code {
      font-family: 'Geist Mono', 'Courier New', monospace;
      font-size: 10px;
      background: #F4F4F4;
      padding: 1px 4px;
      border-radius: 3px;
    }
    pre {
      background: #F4F4F4;
      border-radius: 6px;
      padding: 12px 14px;
      overflow-x: auto;
      margin-bottom: 14px;
      font-size: 10px;
    }
    pre code { background: none; padding: 0; }

    /* ── Blockquote ──────────────────────────────────────────────── */
    blockquote {
      border-left: 3px solid #2F4538;
      padding: 8px 12px;
      margin: 12px 0;
      background: #FAFAFA;
      border-radius: 0 6px 6px 0;
      color: #555;
    }

    /* ── Horizontal rule ─────────────────────────────────────────── */
    hr {
      border: none;
      border-top: 1px solid #e0e0e0;
      margin: 20px 0;
    }

    /* ── Page layout (screen) ────────────────────────────────────── */
    @media screen {
      body {
        background: #e5e5e5;
        padding: 24px 0 40px;
      }
      .page-wrapper {
        max-width: 210mm;
        margin: 0 auto;
        background: #fff;
        padding: 24px 32px 32px;
        box-shadow: 0 2px 20px rgba(0,0,0,0.12);
        border-radius: 4px;
        min-height: 297mm;
      }
    }

    /* ── Page layout (print) ─────────────────────────────────────── */
    @media print {
      body { background: white; padding: 0; }
      .page-wrapper { padding: 0; box-shadow: none; border-radius: 0; }
    }

    /* ── Document header ─────────────────────────────────────────── */
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #2F4538;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .doc-header .logo-img { height: 32px; width: auto; }
    .doc-header .header-meta { text-align: right; font-size: 10px; color: #666; }

    /* ── Document footer ─────────────────────────────────────────── */
    .doc-footer {
      border-top: 1px solid #e0e0e0;
      padding-top: 12px;
      margin-top: 40px;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #999;
    }

    /* ── Total bar ───────────────────────────────────────────────── */
    .total-bar {
      background: #1a1a1a;
      color: #fff;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 16px;
      margin-bottom: 18px;
    }
    .total-bar .label  { font-size: 12px; font-weight: 500; }
    .total-bar .amount { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }

    /* ── Info section ────────────────────────────────────────────── */
    .info-section {
      background: #FAFAFA;
      border: 1px solid #eee;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 16px;
    }
  `;
}

/**
 * POST /api/doc-gen/render
 * Body: { markdown: string }
 * Returns: styled A4 HTML using the template design system
 */
export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  let markdown = "";
  try {
    const body = await request.json();
    markdown = (body.markdown as string) ?? "";
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  if (!markdown.trim()) {
    return new Response("No markdown provided", { status: 400 });
  }

  // Convert markdown to HTML (marked is synchronous by default)
  const bodyHtml = await marked.parse(markdown, { gfm: true, breaks: false });

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dokument</title>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>${documentStyles()}</style>
</head>
<body>
  <div class="page-wrapper">
    <div class="doc-header">
      <a href="https://hoam-house.com" title="Hoam">
        <img src="/0-homebutton-nest-haus.svg" alt="Hoam" class="logo-img">
      </a>
      <div class="header-meta">
        <strong>Hoam – Eco Chalets GmbH</strong><br>
        Zösenberg 51, 8045 Weinitzen
      </div>
    </div>

    ${bodyHtml}

    <div class="doc-footer">
      <div><strong>Eco Chalets GmbH</strong><br>Zösenberg 51, 8045 Weinitzen<br>FN 615495s · UID: ATU80031207</div>
      <div style="text-align:center;">Tel: +43 (0) 664 3949605<br>mail@hoam-house.com</div>
      <div style="text-align:right;">hoam-house.com</div>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
