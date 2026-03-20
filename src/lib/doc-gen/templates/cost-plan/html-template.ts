import {
  KostenplanungData,
  ComputedKostenplanung,
  ComputedHousePhase,
  computeKostenplanung,
} from "./types";
import { formatCurrency, formatNumber } from "../../formatters";

function formatPercent(ratio: number): string {
  return `ca. ${Math.round(ratio * 100)} %`;
}

function renderCoverPage(data: KostenplanungData): string {
  return `
  <div class="page cover-page">
    <div class="cover-content">
      <div class="cover-logo-text">HOAM</div>
      <h1 class="cover-title">Kostenplanung</h1>
      <p class="cover-project">${data.clientName}</p>
      <div class="cover-meta">
        <p>Referenz: ${data.projectRef}</p>
        <p>Datum: ${data.date}</p>
      </div>
      <p class="cover-subtitle">Vorentwurfsphase – Kostenschätzung gemäß ÖNORM B 1801-1</p>
    </div>
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
    </div>
  </div>`;
}

function renderTOCPage(data: KostenplanungData): string {
  const phaseEntries = data.phases.map((p, i) => {
    const phaseNum = i + 2;
    const optTag = p.optional
      ? ' <span class="toc-optional">Optional</span>'
      : "";
    return `
      <tr>
        <td class="toc-label">Projektphase ${phaseNum}${optTag}</td>
        <td class="toc-desc">Errichtung ${p.hausTyp} (${formatNumber(p.nutzflaeche)} m²)</td>
        <td class="toc-page">${i === 0 ? "3–4" : String(3 + i + 1)}</td>
      </tr>`;
  });

  return `
  <div class="page">
    ${pageHeader(data)}
    <h2 class="section-title">Inhaltsverzeichnis</h2>
    <table class="toc-table">
      <tbody>
        <tr>
          <td class="toc-label">Projektphase 1</td>
          <td class="toc-desc">Abbruch Bestandsgebäude</td>
          <td class="toc-page">3</td>
        </tr>
        ${phaseEntries.join("")}
        <tr>
          <td class="toc-label">Projektstart Hoam Partner</td>
          <td class="toc-desc">Partnerschaftsmodell &amp; Rahmenbedingungen</td>
          <td class="toc-page">7</td>
        </tr>
        <tr>
          <td class="toc-label">Terminplanung</td>
          <td class="toc-desc">Projektablauf gemäß ÖNORM B 1801-1</td>
          <td class="toc-page">8</td>
        </tr>
      </tbody>
    </table>
    ${pageFooter()}
  </div>`;
}

function renderDemolitionAndFirstPhase(
  computed: ComputedKostenplanung
): string {
  const data = computed.data;
  const firstPhase = computed.phases[0];

  const phase1Rows = computed.phase1.plots
    .map(
      (p) => `
      <tr>
        <td>${p.grundstueckNr}</td>
        <td>${formatNumber(p.laenge, 0)} × ${formatNumber(p.breite, 0)} m</td>
        <td>${formatNumber(p.grundflaeche)} m²</td>
        <td>${formatNumber(p.geschosse, 1)}</td>
        <td>${formatNumber(p.bri)} m³</td>
        <td class="text-right">${formatCurrency(p.preisProM3)}/m³</td>
        <td class="text-right font-semibold">${formatCurrency(p.kosten)}</td>
      </tr>`
    )
    .join("");

  const hinweiseItems = data.phase1.hinweise
    .map((item) => `<li>${item}</li>`)
    .join("");

  return `
  <div class="page">
    ${pageHeader(data)}
    <div class="phase">
      <div class="phase-header">
        <span class="phase-badge">Phase 1</span>
        <span class="phase-title">Abbruch Bestandsgebäude</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Grundstück</th>
            <th>Grundfläche</th>
            <th>m²</th>
            <th>Geschosse</th>
            <th>BRI</th>
            <th class="text-right">€/m³</th>
            <th class="text-right">Kosten</th>
          </tr>
        </thead>
        <tbody>
          ${phase1Rows}
          <tr class="row-sum">
            <td colspan="6">Summe Abbruchkosten (exkl. USt.)</td>
            <td class="text-right">${formatCurrency(computed.phase1.summe)}</td>
          </tr>
        </tbody>
      </table>
      <div class="note-card info" style="margin-top: 6px;">
        <h4>Hinweise Abbruchkosten</h4>
        <ul>${hinweiseItems}</ul>
      </div>
    </div>
    <div class="phase">
      <div class="phase-header">
        <span class="phase-badge">Phase 2</span>
        <span class="phase-title">Errichtung ${firstPhase.phase.hausTyp}</span>
      </div>
      ${renderHouseBasisBox(firstPhase)}
      ${renderHouseKGTable(firstPhase)}
    </div>
    ${pageFooter()}
  </div>`;
}

function renderFirstPhaseContinuation(
  computed: ComputedKostenplanung
): string {
  const data = computed.data;
  const firstPhase = computed.phases[0];

  return `
  <div class="page">
    ${pageHeader(data)}
    <div class="phase">
      <div class="phase-header">
        <span class="phase-badge">Phase 2</span>
        <span class="phase-title">Errichtung ${firstPhase.phase.hausTyp} – Detailangaben</span>
      </div>
      ${renderNotesGrid(firstPhase)}
    </div>
    <div class="total-bar">
      <span class="label">Geschätzte Gesamtkosten (Phase 1 + Phase 2)</span>
      <span class="amount">${formatCurrency(computed.gesamtkosten)}</span>
    </div>
    <p class="disclaimer">
      Dieses Dokument dient als Kostenschätzung in der Vorentwurfsphase und stellt kein verbindliches Angebot dar.
      Alle Angaben basieren auf Erfahrungswerten und können je nach Projektspezifika abweichen.
      Kostenschätzung gemäß ÖNORM B 1801-1, Aufgliederung Kostenbereiche 0–9.
    </p>
    ${pageFooter()}
  </div>`;
}

function renderOptionalHousePage(
  phaseIndex: number,
  cp: ComputedHousePhase,
  data: KostenplanungData
): string {
  const phaseNum = phaseIndex + 2;

  return `
  <div class="page">
    ${pageHeader(data)}
    <div class="phase">
      <div class="phase-header">
        <span class="phase-badge">Phase ${phaseNum}</span>
        <span class="phase-badge optional-badge">Optional</span>
        <span class="phase-title">Errichtung ${cp.phase.hausTyp}</span>
      </div>
      ${renderHouseBasisBox(cp)}
      ${renderHouseKGTable(cp)}
      ${renderNotesGrid(cp)}
      <div class="total-bar">
        <span class="label">Geschätzte Kosten Phase ${phaseNum}</span>
        <span class="amount">${formatCurrency(cp.gebaeudekosten)}</span>
      </div>
    </div>
    ${pageFooter()}
  </div>`;
}

function renderPartnerPage(data: KostenplanungData): string {
  const p = data.partner;
  const aufteilungItems = p.kostenaufteilung
    .map((item) => `<li>${item}</li>`)
    .join("");

  return `
  <div class="page">
    ${pageHeader(data)}
    <h2 class="section-title">Projektstart Hoam Partner</h2>
    <p class="section-subtitle">Partnerschaftsmodell & Rahmenbedingungen</p>
    <div class="partner-grid">
      <div class="note-card info partner-card">
        <h4>Kostenaufteilung</h4>
        <ul>${aufteilungItems}</ul>
      </div>
      <div class="note-card info partner-card">
        <h4>Touristische Nutzung</h4>
        <p>${p.touristischeNutzung}</p>
      </div>
      <div class="note-card info partner-card">
        <h4>Vertragsdauer</h4>
        <p>${p.vertragsdauer}</p>
      </div>
      <div class="note-card info partner-card">
        <h4>Nach Vertragsablauf</h4>
        <p>${p.nachVertragsablauf}</p>
      </div>
    </div>
    ${pageFooter()}
  </div>`;
}

function renderTimelinePage(data: KostenplanungData): string {
  const rows = data.timeline
    .map(
      (entry) => `
      <tr>
        <td class="font-semibold">${entry.phase}</td>
        <td>${entry.beschreibung}</td>
        <td>${entry.start}</td>
        <td>${entry.dauer}</td>
        <td>${entry.ende}</td>
      </tr>`
    )
    .join("");

  const monthLabels = [
    "Mär 26", "Jun 26", "Sep 26", "Dez 26",
    "Mär 27", "Jun 27", "Sep 27", "Dez 27",
    "Mär 28", "Jun 28",
  ];

  const bars = data.timeline.map((entry) => {
    const { left, width } = timelineBarPosition(entry.start, entry.ende);
    return `
      <div class="gantt-row">
        <div class="gantt-label">${entry.phase}</div>
        <div class="gantt-track">
          <div class="gantt-bar" style="left: ${left}%; width: ${width}%;"></div>
        </div>
      </div>`;
  });

  const gridLines = monthLabels.map((_, i) => {
    const pct = (i / (monthLabels.length - 1)) * 100;
    return `<div class="gantt-gridline" style="left: ${pct}%"></div>`;
  });

  const gridLabels = monthLabels.map((label, i) => {
    const pct = (i / (monthLabels.length - 1)) * 100;
    return `<div class="gantt-month-label" style="left: ${pct}%">${label}</div>`;
  });

  return `
  <div class="page">
    ${pageHeader(data)}
    <h2 class="section-title">Terminplanung</h2>
    <p class="section-subtitle">Projektablauf gemäß ÖNORM B 1801-1</p>
    <table class="timeline-table">
      <thead>
        <tr>
          <th>Phase</th>
          <th>Beschreibung</th>
          <th>Start</th>
          <th>Dauer</th>
          <th>Ende</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="gantt-chart">
      <div class="gantt-header">
        ${gridLabels.join("")}
      </div>
      <div class="gantt-body">
        ${gridLines.join("")}
        ${bars.join("")}
      </div>
    </div>
    ${pageFooter()}
  </div>`;
}

/* ---- Shared helpers ---- */

function pageHeader(data: KostenplanungData): string {
  return `
    <div class="doc-header">
      <div class="logo-text">HOAM</div>
      <div class="header-meta">
        <strong>${data.projectRef}</strong><br>
        Datum: ${data.date}<br>
        Kunde: ${data.clientName}
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

function renderHouseBasisBox(cp: ComputedHousePhase): string {
  return `
    <div class="basis-box">
      <span class="basis-label">Gebäudekosten:</span>
      <strong>${formatNumber(cp.phase.nutzflaeche)} m² Nutzfläche × ${formatCurrency(cp.phase.preisProM2)}/m² = ${formatCurrency(cp.gebaeudekosten)}</strong>
      <span class="basis-label">(inkl. USt.)</span><br>
      <span class="basis-label">Preisannahme: ${cp.phase.preisquelle}</span>
    </div>`;
}

function renderHouseKGTable(cp: ComputedHousePhase): string {
  const rows = cp.kostengruppen
    .map(
      (kg) => `
      <tr class="${kg.anteil === null ? "row-muted" : ""}">
        <td class="kg-num">${kg.kg}</td>
        <td>${kg.bezeichnung}</td>
        <td class="text-right">${kg.anteil !== null ? formatPercent(kg.anteil) : ""}</td>
        <td class="text-right font-semibold">${kg.betrag !== null ? formatCurrency(kg.betrag) : (kg.hinweis ?? "—")}</td>
      </tr>`
    )
    .join("");

  return `
    <table>
      <thead>
        <tr>
          <th style="width:40px">KG</th>
          <th>Bezeichnung</th>
          <th class="text-right" style="width:80px">Anteil</th>
          <th class="text-right" style="width:110px">Betrag</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="row-sum">
          <td></td>
          <td>Gebäudekosten gesamt (inkl. USt.)</td>
          <td class="text-right">100 %</td>
          <td class="text-right">${formatCurrency(cp.gebaeudekosten)}</td>
        </tr>
      </tbody>
    </table>`;
}

function renderNotesGrid(cp: ComputedHousePhase): string {
  const enthaltItems = cp.phase.enthalten
    .map((item) => `<li>${item}</li>`)
    .join("");
  const nichtEnthaltItems = cp.phase.nichtEnthalten
    .map((item) => `<li>${item}</li>`)
    .join("");
  const ergaenzendItems = cp.phase.ergaenzend
    .map((item) => `<li>${item}</li>`)
    .join("");

  return `
    <div class="notes-section">
      <div class="notes-grid">
        <div class="note-card included">
          <h4>In den Herstellungskosten enthalten</h4>
          <ul>${enthaltItems}</ul>
        </div>
        <div class="note-card excluded">
          <h4>Nicht enthalten</h4>
          <ul>${nichtEnthaltItems}</ul>
        </div>
        <div class="note-card info note-card-full">
          <h4>Ergänzende Angaben</h4>
          <ul>${ergaenzendItems}</ul>
        </div>
      </div>
    </div>`;
}

function monthToOffset(monthStr: string): number {
  const map: Record<string, number> = {
    "März 2026": 0, "Mär 2026": 0,
    "Apr 2026": 1, "Mai 2026": 2, "Jun 2026": 3,
    "Jul 2026": 4, "Aug 2026": 5, "Sep 2026": 6,
    "Okt 2026": 7, "Nov 2026": 8, "Dez 2026": 9,
    "Jan 2027": 10, "Feb 2027": 11, "März 2027": 12, "Mär 2027": 12,
    "Apr 2027": 13, "Mai 2027": 14, "Jun 2027": 15,
    "Juli 2027": 16, "Jul 2027": 16, "Aug 2027": 17, "Sep 2027": 18,
    "Okt 2027": 19, "Nov 2027": 20, "Dez 2027": 21,
    "Jan 2028": 22, "Feb 2028": 23, "März 2028": 24, "Mär 2028": 24,
    "Apr 2028": 25, "Mai 2028": 26, "Jun 2028": 27,
  };
  return map[monthStr] ?? 0;
}

function timelineBarPosition(
  start: string,
  ende: string
): { left: number; width: number } {
  const totalMonths = 27;
  const startOffset = monthToOffset(start);
  const endOffset = monthToOffset(ende);
  const duration = Math.max(endOffset - startOffset, 1);
  return {
    left: (startOffset / totalMonths) * 100,
    width: (duration / totalMonths) * 100,
  };
}

/* ---- CSS ---- */

function sharedStyles(): string {
  return `
    @page {
      size: A4;
      margin: 18mm 16mm 20mm 16mm;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #1a1a1a;
      background: #ffffff;
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
      padding-bottom: 16px;
      border-bottom: 2px solid #3D6CE1;
      margin-bottom: 20px;
    }
    .logo-text {
      font-size: 24px;
      font-weight: 700;
      color: #3D6CE1;
      letter-spacing: 2px;
    }
    .header-meta {
      text-align: right;
      font-size: 10px;
      color: #666;
      line-height: 1.6;
    }
    .header-meta strong { color: #1a1a1a; }
    .section-title {
      font-size: 20px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 4px;
      letter-spacing: -0.02em;
    }
    .section-subtitle {
      font-size: 12px;
      color: #666;
      margin-bottom: 20px;
    }
    .cover-page {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
    }
    .cover-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }
    .cover-logo-text {
      font-size: 48px;
      font-weight: 700;
      color: #3D6CE1;
      letter-spacing: 4px;
      margin-bottom: 40px;
    }
    .cover-title {
      font-size: 36px;
      font-weight: 700;
      color: #1a1a1a;
      letter-spacing: -0.03em;
      margin-bottom: 12px;
    }
    .cover-project {
      font-size: 18px;
      font-weight: 500;
      color: #3D6CE1;
      margin-bottom: 24px;
    }
    .cover-meta {
      font-size: 12px;
      color: #666;
      line-height: 1.8;
      margin-bottom: 32px;
    }
    .cover-subtitle {
      font-size: 13px;
      color: #999;
      font-style: italic;
      max-width: 400px;
    }
    .toc-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .toc-table td { padding: 10px 8px; border-bottom: 1px solid #f0f0f0; font-size: 12px; }
    .toc-label { font-weight: 600; color: #1a1a1a; width: 240px; }
    .toc-desc { color: #666; }
    .toc-page { text-align: right; font-weight: 600; color: #3D6CE1; width: 60px; }
    .toc-optional {
      display: inline-block;
      background: #f0f4ff;
      color: #3D6CE1;
      font-size: 9px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 10px;
      margin-left: 6px;
      vertical-align: middle;
    }
    .phase { margin-bottom: 18px; }
    .phase-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .phase-badge {
      background: #3D6CE1;
      color: #fff;
      font-size: 10px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 20px;
      letter-spacing: 0.3px;
      white-space: nowrap;
    }
    .optional-badge { background: #f0f4ff; color: #3D6CE1; }
    .phase-title { font-size: 15px; font-weight: 600; color: #1a1a1a; }
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
    .row-sum td { border-top: 2px solid #1a1a1a; font-weight: 700; padding-top: 8px; font-size: 11px; }
    .row-muted td { color: #999; font-style: italic; }
    .basis-box {
      background: #F4F4F4;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 10px;
      font-size: 10.5px;
    }
    .basis-box strong { color: #1a1a1a; }
    .basis-label { color: #666; }
    .notes-section { margin-top: 8px; }
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
    .note-card.info h4 { color: #3D6CE1; }
    .note-card p { color: #555; font-size: 10px; line-height: 1.6; }
    .note-card ul { list-style: none; padding: 0; }
    .note-card li { padding-left: 12px; position: relative; margin-bottom: 2px; color: #555; }
    .note-card li::before { content: "–"; position: absolute; left: 0; color: #999; }
    .partner-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 8px; }
    .partner-card { padding: 16px 18px; }
    .partner-card h4 { font-size: 11px; margin-bottom: 8px; }
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
    .doc-footer {
      border-top: 1px solid #e0e0e0;
      padding-top: 12px;
      margin-top: auto;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 9px;
      color: #999;
      line-height: 1.6;
    }
    .doc-footer strong { color: #666; }
    .doc-footer a { color: #3D6CE1; text-decoration: none; }
    .disclaimer {
      font-size: 8.5px;
      color: #aaa;
      text-align: center;
      margin-top: 12px;
      line-height: 1.5;
      font-style: italic;
    }
    .timeline-table { margin-bottom: 20px; }
    .timeline-table thead th { font-size: 9px; }
    .timeline-table tbody td { font-size: 10px; padding: 6px 8px; }
    .gantt-chart {
      margin-top: 8px;
      border: 1px solid #eee;
      border-radius: 8px;
      padding: 12px 16px;
      background: #FAFAFA;
    }
    .gantt-header {
      position: relative;
      height: 20px;
      margin-bottom: 4px;
      border-bottom: 1px solid #e0e0e0;
    }
    .gantt-month-label {
      position: absolute;
      transform: translateX(-50%);
      font-size: 8px;
      color: #999;
      white-space: nowrap;
      top: 0;
    }
    .gantt-body { position: relative; padding-top: 4px; }
    .gantt-gridline { position: absolute; top: 0; bottom: 0; width: 1px; background: #f0f0f0; }
    .gantt-row { display: flex; align-items: center; margin-bottom: 4px; position: relative; z-index: 1; }
    .gantt-label {
      width: 180px;
      flex-shrink: 0;
      font-size: 8.5px;
      color: #555;
      padding-right: 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .gantt-track { flex: 1; height: 14px; position: relative; background: #f4f4f4; border-radius: 3px; }
    .gantt-bar {
      position: absolute;
      top: 1px;
      bottom: 1px;
      background: #3D6CE1;
      border-radius: 3px;
      min-width: 4px;
    }
    @media print {
      body { padding: 0; }
      .page { padding: 0; max-width: none; min-height: auto; }
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
  `;
}

/* ---- Main export ---- */

export function generateKostenplanungHTML(data: KostenplanungData): string {
  const computed = computeKostenplanung(data);

  const pages: string[] = [
    renderCoverPage(data),
    renderTOCPage(data),
    renderDemolitionAndFirstPhase(computed),
    renderFirstPhaseContinuation(computed),
  ];

  for (let i = 1; i < computed.phases.length; i++) {
    if (computed.phases[i].phase.optional) {
      pages.push(renderOptionalHousePage(i, computed.phases[i], data));
    }
  }

  pages.push(renderPartnerPage(data));
  pages.push(renderTimelinePage(data));

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kostenplanung – ${data.projectRef}</title>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>${sharedStyles()}</style>
</head>
<body>
${pages.join("\n")}
</body>
</html>`;
}
