import { ReportDocument, ReportSection } from "./types";

/* ------------------------------------------------------------------ */
/*  Shared components                                                   */
/* ------------------------------------------------------------------ */

function pageHeader(data: ReportDocument): string {
  return `
    <div class="doc-header">
      <div class="header-logo-text">HOAM</div>
      <div class="header-meta">
        <strong>${data.meta.projectRef}</strong><br>
        Datum: ${data.meta.date}<br>
        ${data.meta.version ? `Version ${data.meta.version}` : ""}
      </div>
    </div>`;
}

function pageFooter(): string {
  return `
    <div class="doc-footer">
      <div>
        <strong>Eco Chalets GmbH</strong><br>
        Karmeliterplatz 8, 8010 Graz, Österreich<br>
        FN 615495s · UID: ATU80031207
      </div>
      <div style="text-align: center;">
        Tel: +43 (0) 664 3949605<br>
        <a href="mailto:mail@hoam-house.com">mail@hoam-house.com</a>
      </div>
      <div style="text-align: right;">
        <a href="https://hoam-house.com">hoam-house.com</a>
      </div>
    </div>`;
}

function renderSectionContent(section: ReportSection): string {
  const parts: string[] = [];

  if (section.content) {
    parts.push(`<p class="section-text">${section.content}</p>`);
  }

  if (section.items && section.items.length > 0) {
    const liItems = section.items.map((i) => `<li>${i}</li>`).join("");
    parts.push(`<ul class="content-list">${liItems}</ul>`);
  }

  if (section.table) {
    const { headers, rows, footerRow } = section.table;
    const ths = headers.map((h) => `<th>${h}</th>`).join("");
    const trs = rows
      .map(
        (r) =>
          `<tr>${r.cells
            .map((c, i) => `<td${i === 0 ? "" : ' class="text-right"'}>${c}</td>`)
            .join("")}</tr>`
      )
      .join("");
    const footerHtml = footerRow
      ? `<tr class="row-sum">${footerRow
          .map((c, i) => `<td${i === 0 ? "" : ' class="text-right"'}><strong>${c}</strong></td>`)
          .join("")}</tr>`
      : "";

    parts.push(`
      <table>
        <thead><tr>${ths}</tr></thead>
        <tbody>${trs}${footerHtml}</tbody>
      </table>`);
  }

  if (section.callout) {
    const { type, text } = section.callout;
    parts.push(`<div class="callout callout-${type}">${text}</div>`);
  }

  return parts.join("\n");
}

/* ------------------------------------------------------------------ */
/*  Page 1: Cover                                                       */
/* ------------------------------------------------------------------ */

function renderCoverPage(data: ReportDocument): string {
  return `
  <div class="page cover-page">
    <div class="cover-content">
      <div class="cover-logo-text">HOAM</div>
      <h1 class="cover-title">${data.meta.title}</h1>
      ${data.meta.subtitle ? `<p class="cover-subtitle">${data.meta.subtitle}</p>` : ""}

      <div class="cover-project-info">
        <div class="cover-info-row">
          <span class="cover-label">Referenz:</span>
          <span class="cover-value">${data.meta.projectRef}</span>
        </div>
        <div class="cover-info-row">
          <span class="cover-label">Datum:</span>
          <span class="cover-value">${data.meta.date}</span>
        </div>
        ${data.meta.author ? `
        <div class="cover-info-row">
          <span class="cover-label">Erstellt von:</span>
          <span class="cover-value">${data.meta.author}</span>
        </div>` : ""}
        ${data.meta.recipient ? `
        <div class="cover-info-row">
          <span class="cover-label">An:</span>
          <span class="cover-value">${data.meta.recipient}</span>
        </div>` : ""}
        ${data.meta.classification ? `
        <div class="cover-info-row">
          <span class="cover-label">Klassifizierung:</span>
          <span class="cover-value">${data.meta.classification}</span>
        </div>` : ""}
        ${data.meta.version ? `
        <div class="cover-info-row">
          <span class="cover-label">Version:</span>
          <span class="cover-value">${data.meta.version}</span>
        </div>` : ""}
      </div>
    </div>
    ${pageFooter()}
  </div>`;
}

/* ------------------------------------------------------------------ */
/*  Page 2: Summary + first sections                                    */
/* ------------------------------------------------------------------ */

function renderSummaryPage(data: ReportDocument): string {
  const tocRows = data.sections.map(
    (s, i) => `
      <tr>
        <td class="toc-num">${String(i + 1).padStart(2, "0")}</td>
        <td>${s.title}</td>
      </tr>`
  );

  return `
  <div class="page">
    ${pageHeader(data)}

    ${data.summary ? `
    <h2 class="section-title">Zusammenfassung</h2>
    <div class="summary-box">${data.summary}</div>
    ` : ""}

    <h2 class="section-title" style="margin-top: 20px;">Inhaltsverzeichnis</h2>
    <table class="toc-table">
      <tbody>
        ${tocRows.join("")}
        ${data.conclusion ? `<tr><td class="toc-num">–</td><td>Fazit & Schlussfolgerung</td></tr>` : ""}
        ${data.appendixNotes && data.appendixNotes.length > 0 ? `<tr><td class="toc-num">–</td><td>Anhang & Hinweise</td></tr>` : ""}
      </tbody>
    </table>

    ${pageFooter()}
  </div>`;
}

/* ------------------------------------------------------------------ */
/*  Content pages (sections batched)                                   */
/* ------------------------------------------------------------------ */

function renderContentPage(
  data: ReportDocument,
  sections: ReportSection[],
  isContinuation = false
): string {
  const title = isContinuation ? "Bericht (Forts.)" : data.meta.title;
  const subtitle = isContinuation ? "Fortsetzung" : data.meta.subtitle;

  const sectionsHtml = sections
    .map(
      (s) => `
      <div class="report-section">
        <h3 class="subsection-title">${s.title}</h3>
        ${renderSectionContent(s)}
      </div>`
    )
    .join("");

  return `
  <div class="page">
    ${pageHeader(data)}
    <h2 class="section-title">${title}</h2>
    ${subtitle ? `<p class="section-subtitle">${subtitle}</p>` : ""}

    ${sectionsHtml}

    ${pageFooter()}
  </div>`;
}

/* ------------------------------------------------------------------ */
/*  Conclusion page                                                     */
/* ------------------------------------------------------------------ */

function renderConclusionPage(data: ReportDocument): string {
  const appendixHtml =
    data.appendixNotes && data.appendixNotes.length > 0
      ? `
      <div class="notes-grid" style="margin-top: 20px;">
        <div class="note-card info note-card-full">
          <h4>Anhang & Hinweise</h4>
          <ul>
            ${data.appendixNotes.map((n) => `<li>${n}</li>`).join("")}
          </ul>
        </div>
      </div>`
      : "";

  return `
  <div class="page">
    ${pageHeader(data)}
    <h2 class="section-title">Fazit & Schlussfolgerung</h2>

    ${data.conclusion ? `
    <div class="summary-box" style="margin-top: 12px;">
      ${data.conclusion}
    </div>` : ""}

    ${appendixHtml}

    ${pageFooter()}
  </div>`;
}

/* ------------------------------------------------------------------ */
/*  Shared CSS                                                          */
/* ------------------------------------------------------------------ */

function sharedStyles(): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap');
    @page { size: A4; margin: 18mm 16mm 20mm 16mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #1a1a1a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      max-width: 210mm;
      margin: 0 auto;
      padding: 24px 32px;
      break-after: page;
      position: relative;
      min-height: 297mm;
      display: flex;
      flex-direction: column;
    }
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #2F4538;
      padding-bottom: 14px;
      margin-bottom: 20px;
    }
    .header-logo-text { font-size: 20px; font-weight: 700; color: #2F4538; letter-spacing: 0.08em; }
    .header-meta { text-align: right; font-size: 9.5px; color: #666; line-height: 1.6; }

    .cover-page { background: #fff; }
    .cover-content { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding: 40px 0 20px; }
    .cover-logo-text { font-size: 36px; font-weight: 700; color: #2F4538; letter-spacing: 0.1em; margin-bottom: 32px; }
    .cover-title { font-size: 34px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.03em; line-height: 1.15; margin-bottom: 10px; }
    .cover-subtitle { font-size: 13px; color: #666; margin-bottom: 36px; max-width: 420px; line-height: 1.5; }
    .cover-project-info { background: #F8F8F8; border: 1px solid #eee; border-radius: 10px; padding: 16px 20px; margin-bottom: 28px; width: 100%; max-width: 520px; }
    .cover-info-row { display: flex; gap: 12px; padding: 4px 0; border-bottom: 1px solid #f0f0f0; }
    .cover-info-row:last-child { border-bottom: none; }
    .cover-label { color: #999; font-size: 10px; width: 110px; flex-shrink: 0; }
    .cover-value { font-size: 10.5px; font-weight: 500; color: #1a1a1a; }

    .section-title { font-size: 20px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; margin-top: 8px; }
    .section-subtitle { font-size: 11px; color: #666; margin-bottom: 18px; }
    .subsection-title { font-size: 13px; font-weight: 700; margin-top: 16px; margin-bottom: 8px; color: #1a1a1a; }

    .summary-box {
      background: #F8F8F8;
      border-left: 3px solid #2F4538;
      border-radius: 0 6px 6px 0;
      padding: 12px 14px;
      margin-bottom: 16px;
      font-size: 11px;
      color: #333;
      line-height: 1.6;
    }

    .report-section { margin-bottom: 16px; }
    .section-text { font-size: 11px; color: #333; line-height: 1.6; margin-bottom: 8px; }
    .content-list { list-style: none; padding: 0; margin: 6px 0; }
    .content-list li { padding-left: 14px; position: relative; margin-bottom: 3px; color: #333; font-size: 10.5px; }
    .content-list li::before { content: "–"; position: absolute; left: 0; color: #999; }

    .callout {
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 10px;
      margin-top: 8px;
      line-height: 1.5;
    }
    .callout-info { background: #EFF6FF; border-left: 3px solid #3B82F6; color: #1D4ED8; }
    .callout-warning { background: #FFFBEB; border-left: 3px solid #F59E0B; color: #92400E; }
    .callout-success { background: #F0FDF4; border-left: 3px solid #16A34A; color: #15803D; }

    .toc-num { color: #999; width: 40px; font-size: 10px; }
    .toc-table { margin-bottom: 16px; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 10.5px; }
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
    tbody td { padding: 5px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    tbody tr:last-child td { border-bottom: none; }
    .text-right { text-align: right; }
    .row-sum td { border-top: 2px solid #1a1a1a; font-weight: 700; padding-top: 8px; font-size: 11px; }

    .notes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .note-card { background: #FAFAFA; border: 1px solid #eee; border-radius: 8px; padding: 10px 12px; font-size: 9.5px; line-height: 1.55; }
    .note-card-full { grid-column: 1 / -1; }
    .note-card h4 { font-size: 10px; font-weight: 600; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.3px; }
    .note-card.info h4 { color: #2F4538; }
    .note-card ul { list-style: none; padding: 0; margin-top: 4px; }
    .note-card li { padding-left: 12px; position: relative; margin-bottom: 2px; color: #555; }
    .note-card li::before { content: "–"; position: absolute; left: 0; color: #999; }

    .doc-footer {
      border-top: 1px solid #e0e0e0;
      padding-top: 12px;
      margin-top: auto;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #999;
      line-height: 1.6;
    }
    .doc-footer strong { color: #666; }
    .doc-footer a { color: #2F4538; text-decoration: none; }

    @media screen {
      body { background: #e5e5e5; padding: 20px 0; }
      .page { background: #fff; box-shadow: 0 2px 20px rgba(0,0,0,0.1); border-radius: 4px; padding: 28px 36px; margin-bottom: 20px; }
    }
    @media print {
      body { padding: 0; background: white; }
      .page { padding: 0; max-width: none; min-height: auto; box-shadow: none; }
    }
  `;
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function generateReportHTML(data: ReportDocument): string {
  const SECTIONS_PER_PAGE = 3;
  const pages: string[] = [renderCoverPage(data), renderSummaryPage(data)];

  for (let i = 0; i < data.sections.length; i += SECTIONS_PER_PAGE) {
    const chunk = data.sections.slice(i, i + SECTIONS_PER_PAGE);
    pages.push(renderContentPage(data, chunk, i > 0));
  }

  if (data.conclusion || (data.appendixNotes && data.appendixNotes.length > 0)) {
    pages.push(renderConclusionPage(data));
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>${data.meta.title} – ${data.meta.projectRef}</title>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>${sharedStyles()}</style>
</head>
<body>
${pages.join("\n")}
</body>
</html>`;
}
