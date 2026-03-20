import {
  BaukoordinationAngebot,
  ComputedBaukoordination,
  computeBaukoordination,
  ServicePosition,
} from "./types";

/* ------------------------------------------------------------------ */
/*  Formatters                                                          */
/* ------------------------------------------------------------------ */

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(n: number, decimals = 0): string {
  return new Intl.NumberFormat("de-AT", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

/* ------------------------------------------------------------------ */
/*  Shared components                                                   */
/* ------------------------------------------------------------------ */

function pageHeader(data: BaukoordinationAngebot): string {
  return `
    <div class="doc-header">
      <div class="header-logo-text">HOAM</div>
      <div class="header-meta">
        <strong>${data.meta.projectRef}</strong><br>
        Datum: ${data.meta.date}<br>
        Projekt: ${data.project.name}
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

function renderCoverPage(data: BaukoordinationAngebot): string {
  return `
  <div class="page cover-page">
    <div class="cover-content">
      <div class="cover-logo-text">HOAM</div>
      <h1 class="cover-title">${data.meta.title}</h1>
      <p class="cover-subtitle">${data.meta.subtitle}</p>

      <div class="cover-project-info">
        <div class="cover-info-row">
          <span class="cover-label">Projekt:</span>
          <span class="cover-value">${data.project.name}</span>
        </div>
        <div class="cover-info-row">
          <span class="cover-label">Adresse:</span>
          <span class="cover-value">${data.project.address}</span>
        </div>
        <div class="cover-info-row">
          <span class="cover-label">Typ:</span>
          <span class="cover-value">${data.project.type}</span>
        </div>
        ${data.project.planningBasis ? `
        <div class="cover-info-row">
          <span class="cover-label">Planungsstand:</span>
          <span class="cover-value">${data.project.planningBasis}</span>
        </div>` : ""}
        <div class="cover-info-row">
          <span class="cover-label">Referenz:</span>
          <span class="cover-value">${data.meta.projectRef}</span>
        </div>
        <div class="cover-info-row">
          <span class="cover-label">Datum:</span>
          <span class="cover-value">${data.meta.date}</span>
        </div>
        ${data.meta.validUntil ? `
        <div class="cover-info-row">
          <span class="cover-label">Gültig bis:</span>
          <span class="cover-value">${data.meta.validUntil}</span>
        </div>` : ""}
      </div>

      <p class="cover-legal">Gemäß ${data.legal.primaryStandard}</p>
    </div>
    ${pageFooter()}
  </div>`;
}

/* ------------------------------------------------------------------ */
/*  Page 2: Table of Contents + Project Overview                       */
/* ------------------------------------------------------------------ */

function renderOverviewPage(data: BaukoordinationAngebot): string {
  const tocRows = data.services.map(
    (s) => `
      <tr>
        <td class="toc-num">${s.number}</td>
        <td>${s.title}</td>
        <td class="toc-phase">${s.oeibPhase}</td>
        <td class="toc-ref">${s.oeibReference}</td>
      </tr>`
  );

  const standardsList = data.legal.additionalStandards
    .map((s) => `<li>${s}</li>`)
    .join("");

  return `
  <div class="page">
    ${pageHeader(data)}
    <h2 class="section-title">Inhaltsübersicht & Projektinformation</h2>
    <p class="section-subtitle">Leistungsphasen gemäß ÖIBA Leitfäden</p>

    <div class="info-section">
      <div class="info-grid">
        <div>
          <p class="info-label">Projekt</p>
          <p class="info-value">${data.project.name}</p>
        </div>
        <div>
          <p class="info-label">Adresse</p>
          <p class="info-value">${data.project.address}</p>
        </div>
        <div>
          <p class="info-label">Objekttyp</p>
          <p class="info-value">${data.project.type}</p>
        </div>
        <div>
          <p class="info-label">Angebotsdatum</p>
          <p class="info-value">${data.meta.date}</p>
        </div>
      </div>
    </div>

    <h3 class="subsection-title" style="margin-top: 20px;">Leistungsübersicht</h3>
    <table>
      <thead>
        <tr>
          <th style="width: 40px;">Nr.</th>
          <th>Leistung</th>
          <th style="width: 80px;">ÖIBA Phase</th>
          <th style="width: 70px;">Referenz</th>
        </tr>
      </thead>
      <tbody>
        ${tocRows.join("")}
      </tbody>
    </table>

    <h3 class="subsection-title" style="margin-top: 18px;">Anwendbare Normen & Rechtsgrundlagen</h3>
    <div class="notes-grid">
      <div class="note-card info note-card-full">
        <h4>Normgrundlagen</h4>
        <ul>
          <li><strong>${data.legal.primaryStandard}</strong></li>
          ${standardsList}
        </ul>
      </div>
    </div>

    ${pageFooter()}
  </div>`;
}

/* ------------------------------------------------------------------ */
/*  Page 3–4: Service Details                                           */
/* ------------------------------------------------------------------ */

function renderServiceDetail(s: ServicePosition): string {
  const bullets = s.description.map((d) => `<li>${d}</li>`).join("");

  let pricingHtml = "";
  if (s.pricingType === "hourly") {
    pricingHtml = `<span class="pricing-pill">${formatNumber(s.hours ?? 0)} h × ${formatCurrency(s.rate ?? 0)}/h</span>`;
  } else if (s.pricingType === "lumpsum") {
    pricingHtml = `<span class="pricing-pill">Pauschal</span>`;
  } else if (s.pricingType === "perUnit") {
    pricingHtml = `<span class="pricing-pill">${formatNumber(s.units ?? 0)} Einh. × ${formatCurrency(s.unitPrice ?? 0)}/Einh.</span>`;
  }

  return `
    <div class="service-block">
      <div class="service-header">
        <span class="service-num">${s.number}</span>
        <span class="service-title">${s.title}</span>
        <span class="service-phase">${s.oeibPhase} – ${s.oeibReference}</span>
        <span class="service-amount">${formatCurrency(s.netAmount)}</span>
      </div>
      <div class="service-body">
        <ul class="service-description">${bullets}</ul>
        <div class="service-pricing-row">
          ${pricingHtml}
          <span class="service-net-label">netto: <strong>${formatCurrency(s.netAmount)}</strong></span>
        </div>
      </div>
    </div>`;
}

function renderServiceDetailsPage1(
  data: BaukoordinationAngebot,
  services: ServicePosition[]
): string {
  const half = Math.ceil(services.length / 2);
  const firstHalf = services.slice(0, half);

  return `
  <div class="page">
    ${pageHeader(data)}
    <h2 class="section-title">Leistungsumfang – Detailbeschreibung</h2>
    <p class="section-subtitle">Leistungsverzeichnis gemäß ${data.legal.primaryStandard}</p>
    ${firstHalf.map(renderServiceDetail).join("")}
    ${pageFooter()}
  </div>`;
}

function renderServiceDetailsPage2(
  data: BaukoordinationAngebot,
  services: ServicePosition[]
): string {
  const half = Math.ceil(services.length / 2);
  const secondHalf = services.slice(half);

  return `
  <div class="page">
    ${pageHeader(data)}
    <h2 class="section-title">Leistungsumfang – Detailbeschreibung (Forts.)</h2>
    <p class="section-subtitle">Fortsetzung Leistungsverzeichnis</p>
    ${secondHalf.map(renderServiceDetail).join("")}
    ${pageFooter()}
  </div>`;
}

/* ------------------------------------------------------------------ */
/*  Page 5: Pricing Summary                                             */
/* ------------------------------------------------------------------ */

function renderPricingPage(
  data: BaukoordinationAngebot,
  computed: ComputedBaukoordination
): string {
  const serviceRows = data.services.map((s) => {
    let basis = "";
    if (s.pricingType === "hourly") {
      basis = `${formatNumber(s.hours ?? 0)} h × ${formatCurrency(s.rate ?? 0)}/h`;
    } else if (s.pricingType === "lumpsum") {
      basis = "Pauschal";
    } else if (s.pricingType === "perUnit") {
      basis = `${formatNumber(s.units ?? 0)} Einh. × ${formatCurrency(s.unitPrice ?? 0)}/Einh.`;
    }

    return `
      <tr>
        <td class="toc-num">${s.number}</td>
        <td>${s.title} <span style="color:#999; font-size: 9px;">(${s.oeibPhase})</span></td>
        <td style="color: #666;">${basis}</td>
        <td class="text-right">${formatCurrency(s.netAmount)}</td>
      </tr>`;
  });

  return `
  <div class="page">
    ${pageHeader(data)}
    <h2 class="section-title">Honorarzusammenstellung</h2>
    <p class="section-subtitle">Gesamtübersicht Nettohonorare</p>

    <table>
      <thead>
        <tr>
          <th style="width: 40px;">Nr.</th>
          <th>Leistung</th>
          <th style="width: 180px;">Berechnungsbasis</th>
          <th style="width: 100px;" class="text-right">Netto</th>
        </tr>
      </thead>
      <tbody>
        ${serviceRows.join("")}
        <tr class="row-subtotal">
          <td colspan="3" class="text-right"><strong>Summe netto</strong></td>
          <td class="text-right"><strong>${formatCurrency(computed.subtotalNet)}</strong></td>
        </tr>
        <tr>
          <td colspan="3" class="text-right">+ 20% USt.</td>
          <td class="text-right">${formatCurrency(computed.vat)}</td>
        </tr>
      </tbody>
    </table>

    <div class="total-bar">
      <span class="label">Gesamthonorar brutto (inkl. 20% USt.)</span>
      <span class="amount">${formatCurrency(computed.totalGross)}</span>
    </div>

    <div class="notes-grid" style="margin-top: 16px;">
      <div class="note-card included">
        <h4>Im Leistungsumfang enthalten</h4>
        <ul>
          <li>Koordination aller aufgeführten Leistungsphasen (LPH 1–9)</li>
          <li>Abstimmung mit Behörden, Fachplanern und ausführenden Unternehmen</li>
          <li>Schriftliche Protokollierung von Besprechungen</li>
          <li>Kostenkontrolle und Berichterstattung</li>
        </ul>
      </div>
      <div class="note-card excluded">
        <h4>Nicht enthalten</h4>
        <ul>
          <li>Leistungen der Fachplaner (Statik, HLS, Elektro etc.)</li>
          <li>Behördengebühren, Abgaben und externe Gutachten</li>
          <li>Mehrstunden durch Auftraggeber-bedingte Änderungen</li>
          <li>Sachverständigenleistungen und Prüfingenieure</li>
        </ul>
      </div>
    </div>

    ${pageFooter()}
  </div>`;
}

/* ------------------------------------------------------------------ */
/*  Page 6: Legal & AGB                                                 */
/* ------------------------------------------------------------------ */

function renderLegalPage(data: BaukoordinationAngebot): string {
  const paymentTermsList = data.legal.paymentTerms
    .map((t) => `<li>${t}</li>`)
    .join("");

  return `
  <div class="page">
    ${pageHeader(data)}
    <h2 class="section-title">Rechtliche Grundlagen & Zahlungsbedingungen</h2>
    <p class="section-subtitle">Vertragsbestandteile und allgemeine Bedingungen</p>

    <div class="notes-grid">
      <div class="note-card info note-card-full">
        <h4>Vertragsgrundlage</h4>
        <p>${data.legal.disclaimer}</p>
      </div>

      <div class="note-card info">
        <h4>AGB Referenz</h4>
        <ul>
          <li>${data.legal.agbReference}</li>
          <li>Gerichtsstand: Graz (Österreich)</li>
          <li>Anwendbares Recht: Österreichisches Recht (ABGB)</li>
        </ul>
      </div>

      <div class="note-card info">
        <h4>Zahlungsbedingungen</h4>
        <ul>${paymentTermsList}</ul>
      </div>

      <div class="note-card info note-card-full">
        <h4>Normgrundlagen</h4>
        <ul>
          <li>${data.legal.primaryStandard}</li>
          ${data.legal.additionalStandards.map((s) => `<li>${s}</li>`).join("")}
        </ul>
      </div>
    </div>

    <div class="disclaimer">
      Dieses Angebot ist unverbindlich und dient zur Orientierung. Eine rechtliche Verbindlichkeit entsteht erst mit schriftlicher Auftragsbestätigung durch beide Vertragsparteien.
      Preise exkl. USt., sofern nicht anders ausgewiesen. Alle Angaben ohne Gewähr. Stand: ${data.meta.date}.
      ${data.meta.validUntil ? `Angebot gültig bis: ${data.meta.validUntil}.` : ""}
    </div>

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

    /* Header */
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #2F4538;
      padding-bottom: 14px;
      margin-bottom: 20px;
    }
    .header-logo-text {
      font-size: 20px;
      font-weight: 700;
      color: #2F4538;
      letter-spacing: 0.08em;
    }
    .header-meta {
      text-align: right;
      font-size: 9.5px;
      color: #666;
      line-height: 1.6;
    }

    /* Cover page */
    .cover-page { background: #fff; }
    .cover-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      padding: 40px 0 20px;
    }
    .cover-logo-text {
      font-size: 36px;
      font-weight: 700;
      color: #2F4538;
      letter-spacing: 0.1em;
      margin-bottom: 32px;
    }
    .cover-title {
      font-size: 34px;
      font-weight: 700;
      color: #1a1a1a;
      letter-spacing: -0.03em;
      line-height: 1.15;
      margin-bottom: 10px;
    }
    .cover-subtitle {
      font-size: 13px;
      color: #666;
      margin-bottom: 36px;
      max-width: 420px;
      line-height: 1.5;
    }
    .cover-project-info {
      background: #F8F8F8;
      border: 1px solid #eee;
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 28px;
      width: 100%;
      max-width: 520px;
    }
    .cover-info-row {
      display: flex;
      gap: 12px;
      padding: 4px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .cover-info-row:last-child { border-bottom: none; }
    .cover-label { color: #999; font-size: 10px; width: 110px; flex-shrink: 0; }
    .cover-value { font-size: 10.5px; font-weight: 500; color: #1a1a1a; }
    .cover-legal { font-size: 10px; color: #aaa; margin-top: auto; }

    /* Section titles */
    .section-title { font-size: 20px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; margin-top: 8px; }
    .section-subtitle { font-size: 11px; color: #666; margin-bottom: 18px; }
    .subsection-title { font-size: 13px; font-weight: 700; margin-top: 16px; margin-bottom: 8px; }

    /* Info section */
    .info-section {
      background: #FAFAFA;
      border: 1px solid #eee;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 16px;
    }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .info-label { font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px; }
    .info-value { font-size: 11px; font-weight: 500; color: #1a1a1a; }

    /* TOC */
    .toc-num { color: #999; width: 40px; font-size: 10px; }
    .toc-phase { font-size: 9.5px; color: #666; }
    .toc-ref { font-size: 9.5px; color: #999; }

    /* Services */
    .service-block {
      border: 1px solid #eee;
      border-radius: 8px;
      margin-bottom: 8px;
      overflow: hidden;
    }
    .service-header {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #F8F8F8;
      padding: 7px 10px;
      border-bottom: 1px solid #eee;
    }
    .service-num {
      font-size: 9px;
      font-weight: 700;
      color: #fff;
      background: #2F4538;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      letter-spacing: 0;
    }
    .service-title { font-size: 11.5px; font-weight: 600; color: #1a1a1a; flex: 1; }
    .service-phase { font-size: 9px; color: #2F4538; font-weight: 600; background: #E8F0EB; padding: 2px 6px; border-radius: 10px; white-space: nowrap; }
    .service-amount { font-size: 11px; font-weight: 700; color: #1a1a1a; white-space: nowrap; }
    .service-body { padding: 8px 10px; }
    .service-description { list-style: none; padding: 0; margin-bottom: 6px; }
    .service-description li {
      padding-left: 12px;
      position: relative;
      margin-bottom: 2px;
      color: #444;
      font-size: 9.5px;
      line-height: 1.5;
    }
    .service-description li::before { content: "–"; position: absolute; left: 0; color: #999; }
    .service-pricing-row { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
    .pricing-pill { font-size: 9px; background: #f0f0f0; color: #666; padding: 2px 8px; border-radius: 10px; }
    .service-net-label { font-size: 9.5px; color: #666; margin-left: auto; }

    /* Tables */
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
    .font-semibold { font-weight: 600; }
    .row-subtotal td {
      border-top: 2px solid #1a1a1a;
      padding-top: 8px;
      font-size: 11px;
    }

    /* Total bar */
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
    .total-bar .label { font-size: 12px; font-weight: 500; }
    .total-bar .amount { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }

    /* Note cards */
    .notes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .note-card {
      background: #FAFAFA;
      border: 1px solid #eee;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 9.5px;
      line-height: 1.55;
    }
    .note-card-full { grid-column: 1 / -1; }
    .note-card h4 {
      font-size: 10px;
      font-weight: 600;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .note-card.included h4 { color: #16a34a; }
    .note-card.excluded h4 { color: #dc2626; }
    .note-card.info h4 { color: #2F4538; }
    .note-card p { color: #555; font-size: 10px; line-height: 1.6; margin-top: 4px; }
    .note-card ul { list-style: none; padding: 0; margin-top: 4px; }
    .note-card li { padding-left: 12px; position: relative; margin-bottom: 2px; color: #555; }
    .note-card li::before { content: "–"; position: absolute; left: 0; color: #999; }

    /* Footer */
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

    .disclaimer {
      font-size: 8.5px;
      color: #aaa;
      text-align: center;
      margin-top: 12px;
      line-height: 1.5;
      font-style: italic;
    }

    @media screen {
      body { background: #e5e5e5; padding: 20px 0; }
      .page {
        background: #fff;
        box-shadow: 0 2px 20px rgba(0,0,0,0.1);
        border-radius: 4px;
        padding: 28px 36px;
        margin-bottom: 20px;
      }
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

export function generateBaukoordinationHTML(
  data: BaukoordinationAngebot
): string {
  const computed = computeBaukoordination(data);

  const pages = [
    renderCoverPage(data),
    renderOverviewPage(data),
    renderServiceDetailsPage1(data, data.services),
    renderServiceDetailsPage2(data, data.services),
    renderPricingPage(data, computed),
    renderLegalPage(data),
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
