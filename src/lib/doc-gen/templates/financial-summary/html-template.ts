import {
  FinancialSummaryDocument,
  ComputedFinancialSummary,
  computeFinancialSummary,
} from "./types";
import { formatCurrency } from "../../formatters";

function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals).replace(".", ",")} %`;
}

/* ------------------------------------------------------------------ */
/*  Shared components                                                   */
/* ------------------------------------------------------------------ */

function pageHeader(data: FinancialSummaryDocument): string {
  return `
    <div class="doc-header">
      <div class="header-logo-text">HOAM</div>
      <div class="header-meta">
        <strong>${data.meta.projectRef}</strong><br>
        Datum: ${data.meta.date}<br>
        Berichtszeitraum: ${data.meta.period}
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

/* ------------------------------------------------------------------ */
/*  Page 1: Cover                                                       */
/* ------------------------------------------------------------------ */

function renderCoverPage(
  data: FinancialSummaryDocument,
  computed: ComputedFinancialSummary
): string {
  const resultSign = computed.netResult >= 0 ? "+" : "";

  return `
  <div class="page cover-page">
    <div class="cover-content">
      <div class="cover-logo-text">HOAM</div>
      <h1 class="cover-title">${data.meta.title}</h1>
      ${data.meta.subtitle ? `<p class="cover-subtitle">${data.meta.subtitle}</p>` : ""}

      <div class="cover-kpi-row">
        <div class="cover-kpi">
          <span class="cover-kpi-label">Einnahmen</span>
          <span class="cover-kpi-value income">${formatCurrency(computed.totalIncome)}</span>
        </div>
        <div class="cover-kpi-divider">vs.</div>
        <div class="cover-kpi">
          <span class="cover-kpi-label">Ausgaben</span>
          <span class="cover-kpi-value expense">${formatCurrency(computed.totalExpense)}</span>
        </div>
        <div class="cover-kpi-divider">=</div>
        <div class="cover-kpi">
          <span class="cover-kpi-label">Netto-Ergebnis</span>
          <span class="cover-kpi-value ${computed.netResult >= 0 ? "net-positive" : "net-negative"}">${resultSign}${formatCurrency(computed.netResult)}</span>
        </div>
      </div>

      <div class="cover-project-info">
        <div class="cover-info-row">
          <span class="cover-label">Referenz:</span>
          <span class="cover-value">${data.meta.projectRef}</span>
        </div>
        <div class="cover-info-row">
          <span class="cover-label">Berichtszeitraum:</span>
          <span class="cover-value">${data.meta.period}</span>
        </div>
        <div class="cover-info-row">
          <span class="cover-label">Erstellt am:</span>
          <span class="cover-value">${data.meta.date}</span>
        </div>
        ${data.meta.author ? `
        <div class="cover-info-row">
          <span class="cover-label">Erstellt von:</span>
          <span class="cover-value">${data.meta.author}</span>
        </div>` : ""}
        <div class="cover-info-row">
          <span class="cover-label">EBITDA-Marge:</span>
          <span class="cover-value">${formatPercent(computed.margin)}</span>
        </div>
      </div>
    </div>
    ${pageFooter()}
  </div>`;
}

/* ------------------------------------------------------------------ */
/*  Page 2: Executive Summary + KPIs                                   */
/* ------------------------------------------------------------------ */

function renderSummaryPage(
  data: FinancialSummaryDocument,
  computed: ComputedFinancialSummary
): string {
  const kpiHtml =
    data.kpis && data.kpis.length > 0
      ? data.kpis
          .map((k) => {
            const trendIcon =
              k.trend === "up" ? "↑" : k.trend === "down" ? "↓" : "→";
            const trendClass =
              k.trend === "up"
                ? "trend-up"
                : k.trend === "down"
                ? "trend-down"
                : "trend-neutral";
            return `
              <div class="kpi-card">
                <p class="kpi-label">${k.label}</p>
                <p class="kpi-value">${k.value} <span class="${trendClass}">${trendIcon}</span></p>
                ${k.note ? `<p class="kpi-note">${k.note}</p>` : ""}
              </div>`;
          })
          .join("")
      : "";

  return `
  <div class="page">
    ${pageHeader(data)}
    <h2 class="section-title">Finanzkennzahlen & Überblick</h2>
    <p class="section-subtitle">Berichtszeitraum: ${data.meta.period}</p>

    ${data.executive ? `<div class="summary-box">${data.executive}</div>` : ""}

    ${kpiHtml ? `
    <h3 class="subsection-title">KPI-Dashboard</h3>
    <div class="kpi-grid">${kpiHtml}</div>
    ` : ""}

    <h3 class="subsection-title" style="margin-top: 18px;">Ergebnis-Übersicht</h3>
    <table>
      <thead>
        <tr>
          <th>Position</th>
          <th class="text-right">Betrag</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Gesamteinnahmen</td>
          <td class="text-right income-text">${formatCurrency(computed.totalIncome)}</td>
        </tr>
        <tr>
          <td>Gesamtausgaben</td>
          <td class="text-right expense-text">– ${formatCurrency(computed.totalExpense)}</td>
        </tr>
        <tr class="row-sum">
          <td><strong>Netto-Ergebnis</strong></td>
          <td class="text-right ${computed.netResult >= 0 ? "income-text" : "expense-text"}">
            <strong>${formatCurrency(computed.netResult)}</strong>
          </td>
        </tr>
        <tr>
          <td>Marge</td>
          <td class="text-right">${formatPercent(computed.margin)}</td>
        </tr>
      </tbody>
    </table>

    ${pageFooter()}
  </div>`;
}

/* ------------------------------------------------------------------ */
/*  Page 3: Line Items Detail                                           */
/* ------------------------------------------------------------------ */

function renderLineItemsPage(
  data: FinancialSummaryDocument,
  computed: ComputedFinancialSummary
): string {
  const incomeRows = computed.incomeItems.map(
    (i) => `
      <tr>
        <td class="cat-pill income-cat">${i.category}</td>
        <td>${i.description}${i.note ? ` <span class="row-note">(${i.note})</span>` : ""}</td>
        <td class="text-right income-text">${formatCurrency(i.amount)}</td>
      </tr>`
  );

  const expenseRows = computed.expenseItems.map(
    (i) => `
      <tr>
        <td class="cat-pill expense-cat">${i.category}</td>
        <td>${i.description}${i.note ? ` <span class="row-note">(${i.note})</span>` : ""}</td>
        <td class="text-right expense-text">– ${formatCurrency(i.amount)}</td>
      </tr>`
  );

  return `
  <div class="page">
    ${pageHeader(data)}
    <h2 class="section-title">Detaillierte Kostenaufstellung</h2>
    <p class="section-subtitle">Alle Einnahmen- und Ausgabenpositionen im Berichtszeitraum</p>

    <h3 class="subsection-title">Einnahmen</h3>
    <table>
      <thead>
        <tr>
          <th style="width: 120px;">Kategorie</th>
          <th>Beschreibung</th>
          <th style="width: 110px;" class="text-right">Betrag</th>
        </tr>
      </thead>
      <tbody>
        ${incomeRows.join("")}
        <tr class="row-sum">
          <td colspan="2" class="text-right"><strong>Summe Einnahmen</strong></td>
          <td class="text-right income-text"><strong>${formatCurrency(computed.totalIncome)}</strong></td>
        </tr>
      </tbody>
    </table>

    <h3 class="subsection-title" style="margin-top: 14px;">Ausgaben</h3>
    <table>
      <thead>
        <tr>
          <th style="width: 120px;">Kategorie</th>
          <th>Beschreibung</th>
          <th style="width: 110px;" class="text-right">Betrag</th>
        </tr>
      </thead>
      <tbody>
        ${expenseRows.join("")}
        <tr class="row-sum">
          <td colspan="2" class="text-right"><strong>Summe Ausgaben</strong></td>
          <td class="text-right expense-text"><strong>– ${formatCurrency(computed.totalExpense)}</strong></td>
        </tr>
      </tbody>
    </table>

    <div class="total-bar">
      <span class="label">Netto-Ergebnis (Einnahmen – Ausgaben)</span>
      <span class="amount">${formatCurrency(computed.netResult)}</span>
    </div>

    ${pageFooter()}
  </div>`;
}

/* ------------------------------------------------------------------ */
/*  Page 4: Quarterly Trend + Notes                                    */
/* ------------------------------------------------------------------ */

function renderTrendPage(data: FinancialSummaryDocument): string {
  const periods = data.periods ?? [];

  const periodRows = periods.map((p) => {
    const net = p.income - p.expense;
    const margin = p.income > 0 ? (net / p.income) * 100 : 0;
    return `
      <tr>
        <td>${p.label}</td>
        <td class="text-right income-text">${formatCurrency(p.income)}</td>
        <td class="text-right expense-text">– ${formatCurrency(p.expense)}</td>
        <td class="text-right ${net >= 0 ? "income-text" : "expense-text"}">${formatCurrency(net)}</td>
        <td class="text-right">${formatPercent(margin)}</td>
      </tr>`;
  });

  const maxIncome = Math.max(...periods.map((p) => p.income), 1);
  const chartRows = periods.map((p) => {
    const incomeW = Math.round((p.income / maxIncome) * 80);
    const expenseW = Math.round((p.expense / maxIncome) * 80);
    return `
      <div class="chart-row">
        <span class="chart-label">${p.label}</span>
        <div class="chart-bars">
          <div class="chart-bar income-bar" style="width: ${incomeW}%;" title="${formatCurrency(p.income)}"></div>
          <div class="chart-bar expense-bar" style="width: ${expenseW}%;" title="${formatCurrency(p.expense)}"></div>
        </div>
      </div>`;
  });

  const notesHtml =
    data.notes && data.notes.length > 0
      ? `
      <div class="notes-grid" style="margin-top: 16px;">
        <div class="note-card info note-card-full">
          <h4>Hinweise & Anmerkungen</h4>
          <ul>${data.notes.map((n) => `<li>${n}</li>`).join("")}</ul>
        </div>
      </div>`
      : "";

  return `
  <div class="page">
    ${pageHeader(data)}
    <h2 class="section-title">Periodenvergleich & Trendanalyse</h2>

    ${periods.length > 0 ? `
    <h3 class="subsection-title">Quartalsentwicklung</h3>
    <table>
      <thead>
        <tr>
          <th>Periode</th>
          <th class="text-right">Einnahmen</th>
          <th class="text-right">Ausgaben</th>
          <th class="text-right">Netto</th>
          <th class="text-right">Marge</th>
        </tr>
      </thead>
      <tbody>${periodRows.join("")}</tbody>
    </table>

    <h3 class="subsection-title" style="margin-top: 16px;">Verlaufsdiagramm</h3>
    <div class="chart-container">
      <div class="chart-legend">
        <span class="legend-item income-legend">Einnahmen</span>
        <span class="legend-item expense-legend">Ausgaben</span>
      </div>
      ${chartRows.join("")}
    </div>
    ` : ""}

    ${notesHtml}

    ${pageFooter()}
  </div>`;
}

/* ------------------------------------------------------------------ */
/*  Shared CSS                                                          */
/* ------------------------------------------------------------------ */

function sharedStyles(): string {
  return `
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
    .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2F4538; padding-bottom: 14px; margin-bottom: 20px; }
    .header-logo-text { font-size: 20px; font-weight: 700; color: #2F4538; letter-spacing: 0.08em; }
    .header-meta { text-align: right; font-size: 9.5px; color: #666; line-height: 1.6; }

    .cover-page { background: #fff; }
    .cover-content { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding: 40px 0 20px; }
    .cover-logo-text { font-size: 36px; font-weight: 700; color: #2F4538; letter-spacing: 0.1em; margin-bottom: 32px; }
    .cover-title { font-size: 34px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.03em; line-height: 1.15; margin-bottom: 10px; }
    .cover-subtitle { font-size: 13px; color: #666; margin-bottom: 28px; max-width: 420px; line-height: 1.5; }
    .cover-kpi-row { display: flex; align-items: center; gap: 16px; margin-bottom: 28px; background: #F8F8F8; border: 1px solid #eee; border-radius: 10px; padding: 16px 20px; width: 100%; max-width: 580px; }
    .cover-kpi { display: flex; flex-direction: column; gap: 4px; }
    .cover-kpi-label { font-size: 9.5px; color: #999; text-transform: uppercase; letter-spacing: 0.3px; }
    .cover-kpi-value { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
    .cover-kpi-divider { font-size: 16px; color: #ccc; font-weight: 300; }
    .cover-project-info { background: #F8F8F8; border: 1px solid #eee; border-radius: 10px; padding: 14px 18px; width: 100%; max-width: 520px; }
    .cover-info-row { display: flex; gap: 12px; padding: 4px 0; border-bottom: 1px solid #f0f0f0; }
    .cover-info-row:last-child { border-bottom: none; }
    .cover-label { color: #999; font-size: 10px; width: 130px; flex-shrink: 0; }
    .cover-value { font-size: 10.5px; font-weight: 500; color: #1a1a1a; }

    .income { color: #15803D; }
    .expense { color: #DC2626; }
    .net-positive { color: #15803D; }
    .net-negative { color: #DC2626; }
    .income-text { color: #15803D; }
    .expense-text { color: #DC2626; }

    .section-title { font-size: 20px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; margin-top: 8px; }
    .section-subtitle { font-size: 11px; color: #666; margin-bottom: 18px; }
    .subsection-title { font-size: 13px; font-weight: 700; margin-top: 16px; margin-bottom: 8px; }

    .summary-box { background: #F8F8F8; border-left: 3px solid #2F4538; border-radius: 0 6px 6px 0; padding: 12px 14px; margin-bottom: 16px; font-size: 11px; color: #333; line-height: 1.6; }

    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 8px; }
    .kpi-card { background: #FAFAFA; border: 1px solid #eee; border-radius: 8px; padding: 10px 12px; }
    .kpi-label { font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 4px; }
    .kpi-value { font-size: 15px; font-weight: 700; color: #1a1a1a; }
    .kpi-note { font-size: 9px; color: #999; margin-top: 3px; }
    .trend-up { color: #15803D; }
    .trend-down { color: #DC2626; }
    .trend-neutral { color: #999; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 10.5px; }
    thead th { background: #F4F4F4; font-weight: 600; text-align: left; padding: 6px 8px; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; color: #444; border-bottom: 1px solid #ddd; }
    tbody td { padding: 5px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    tbody tr:last-child td { border-bottom: none; }
    .text-right { text-align: right; }
    .row-sum td { border-top: 2px solid #1a1a1a; font-weight: 700; padding-top: 8px; font-size: 11px; }

    .cat-pill { font-size: 9px; }
    .income-cat { color: #15803D; }
    .expense-cat { color: #DC2626; }
    .row-note { font-size: 9px; color: #aaa; }

    .total-bar { background: #1a1a1a; color: #fff; border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; margin-top: 16px; margin-bottom: 18px; }
    .total-bar .label { font-size: 12px; font-weight: 500; }
    .total-bar .amount { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }

    /* Chart */
    .chart-container { background: #FAFAFA; border: 1px solid #eee; border-radius: 8px; padding: 12px 16px; }
    .chart-legend { display: flex; gap: 16px; margin-bottom: 10px; font-size: 9px; }
    .legend-item { display: flex; align-items: center; gap: 5px; }
    .income-legend::before { content: ""; display: inline-block; width: 12px; height: 8px; background: #16a34a; border-radius: 2px; }
    .expense-legend::before { content: ""; display: inline-block; width: 12px; height: 8px; background: #dc2626; border-radius: 2px; }
    .chart-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .chart-label { font-size: 9.5px; color: #666; width: 60px; flex-shrink: 0; }
    .chart-bars { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .chart-bar { height: 10px; border-radius: 3px; min-width: 4px; }
    .income-bar { background: #16a34a; }
    .expense-bar { background: #dc2626; opacity: 0.7; }

    /* Note cards */
    .notes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .note-card { background: #FAFAFA; border: 1px solid #eee; border-radius: 8px; padding: 10px 12px; font-size: 9.5px; line-height: 1.55; }
    .note-card-full { grid-column: 1 / -1; }
    .note-card h4 { font-size: 10px; font-weight: 600; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.3px; }
    .note-card.info h4 { color: #2F4538; }
    .note-card ul { list-style: none; padding: 0; margin-top: 4px; }
    .note-card li { padding-left: 12px; position: relative; margin-bottom: 2px; color: #555; }
    .note-card li::before { content: "–"; position: absolute; left: 0; color: #999; }

    .doc-footer { border-top: 1px solid #e0e0e0; padding-top: 12px; margin-top: auto; display: flex; justify-content: space-between; font-size: 9px; color: #999; line-height: 1.6; }
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

export function generateFinancialSummaryHTML(
  data: FinancialSummaryDocument
): string {
  const computed = computeFinancialSummary(data);

  const pages = [
    renderCoverPage(data, computed),
    renderSummaryPage(data, computed),
    renderLineItemsPage(data, computed),
    renderTrendPage(data),
  ];

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
