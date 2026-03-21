# Amendment Feature — auto-doc Web-App

**Planungsdokument für nachträgliche Dokument-Änderungen per Prompt**

**Version:** 1.0.0 · **Status:** Bereit zur Implementierung · **Stand:** März 2026

---

## Übersicht

Dieses Dokument beschreibt die Erweiterung der auto-doc Web-App um ein **Amendment-Feature**: Nutzer können nach der Dokument-Generierung gezielt Änderungen per natürlichsprachlichem Prompt vornehmen, ohne das Dokument neu zu generieren.

```
Bestehende Funktionalität:     POST /api/doc-gen/[id]  → Dokument erstellen
Neue Funktionalität:           PATCH /api/doc-gen/[id] → Dokument gezielt ändern
```

---

## Architekturübersicht

```
Nutzer-Prompt (Änderung)
        │
        ▼
  UI Chat-Eingabe
  (unter Dokument-Vorschau)
        │
        ▼
  PATCH /api/doc-gen/[id]
  { hash, amendmentPrompt }
        │
        ▼
  processAmendmentRequest()
  ├── bestehende Daten laden (by hash)
  ├── Datenmodell rekonstruieren
  ├── Claude API → strukturiertes Diff
  ├── Zod-Schema-Validierung
  └── Datenmodell updaten
        │
        ▼
  generateHTML() mit neuem Modell
        │
        ▼
  Neue Version speichern
  (neuer Hash + Versions-Link zu vorherigem)
        │
        ▼
  Response: { html, newHash, changelog }
        │
        ▼
  UI: Diff-Anzeige + Vorschau aktualisieren
```

---

## 1. API-Ebene

### Datei: `src/app/api/doc-gen/[id]/route.ts`

Erweiterung um `PATCH`-Handler neben den bestehenden `GET` und `POST`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import "@/lib/doc-gen/init";
import { getTemplate } from "@/lib/doc-gen/template-registry";
import { processAmendmentRequest } from "@/lib/doc-gen/ai-processor";
import { getDocumentByHash, storeDocument } from "@/lib/doc-gen/storage";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const template = getTemplate(params.id);
  if (!template) {
    return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { hash, amendmentPrompt } = body;

    if (!hash || !amendmentPrompt) {
      return NextResponse.json(
        { error: "hash and amendmentPrompt are required" },
        { status: 400 }
      );
    }

    // 1. Bestehendes Dokument laden
    const existing = await getDocumentByHash(hash);
    if (!existing) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // 2. Änderung verarbeiten
    const { updatedData, changelog } = await processAmendmentRequest({
      currentData: existing.data,
      amendmentPrompt,
      schema: template.schema,
      templateId: params.id,
    });

    // 3. Neues HTML generieren
    const newHtml = template.generateHTML(updatedData);

    // 4. Neue Version speichern (mit Rückverweis auf vorherige Version)
    const newHash = await storeDocument(newHtml, updatedData, {
      previousHash: hash,
      templateId: params.id,
      changelog,
    });

    return NextResponse.json({
      html: newHtml,
      newHash,
      previousHash: hash,
      changelog,
    });

  } catch (error) {
    console.error("Amendment failed:", error);
    return NextResponse.json({ error: "Amendment failed" }, { status: 500 });
  }
}
```

---

## 2. AI-Verarbeitungsschicht

### Datei: `src/lib/doc-gen/ai-processor.ts`

Neue Funktion `processAmendmentRequest()` — ergänzt die bestehende `processAIDocumentRequest()`:

```typescript
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import type { ZodSchema } from "zod";

export interface AmendmentRequest<T = unknown> {
  currentData: T;
  amendmentPrompt: string;
  schema: ZodSchema<T>;
  templateId: string;
}

export interface AmendmentResult<T = unknown> {
  updatedData: T;
  changelog: ChangelogEntry[];
}

export interface ChangelogEntry {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  description: string;
  timestamp: string;
}

export async function processAmendmentRequest<T>(
  request: AmendmentRequest<T>
): Promise<AmendmentResult<T>> {
  const { currentData, amendmentPrompt, schema } = request;

  // Strukturierten Diff von Claude erzeugen lassen
  const { object: diff } = await generateObject({
    model: anthropic("claude-sonnet-4-5", {
      cacheControl: true,
    }),
    schema: z.object({
      changes: z.array(
        z.object({
          field: z.string().describe("Dot-notation path, z.B. 'project.name' oder 'sections.0.items.2.pricing.hours'"),
          oldValue: z.unknown(),
          newValue: z.unknown(),
          description: z.string().describe("Menschenlesbare Beschreibung der Änderung"),
        })
      ),
      summary: z.string().describe("Kurze Zusammenfassung aller Änderungen"),
    }),
    system: `Du bist ein Dokumenten-Änderungs-Assistent. Du erhältst ein bestehendes Dokument-Datenmodell und einen Änderungs-Prompt.
Analysiere präzise, welche Felder geändert werden müssen. Verändere NUR was explizit angefragt wurde.
Wenn Preise geändert werden, berechne immer net, vat (20%) und gross neu.`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Bestehendes Datenmodell:\n\`\`\`json\n${JSON.stringify(currentData, null, 2)}\n\`\`\`\n\nGewünschte Änderung: "${amendmentPrompt}"`,
          },
        ],
      },
    ],
  });

  // Änderungen auf das Datenmodell anwenden
  const updatedData = applyChanges(currentData as Record<string, unknown>, diff.changes) as T;

  // Gegen Schema validieren
  const validated = schema.parse(updatedData);

  // Changelog aufbauen
  const changelog: ChangelogEntry[] = diff.changes.map((change) => ({
    ...change,
    timestamp: new Date().toISOString(),
  }));

  return { updatedData: validated, changelog };
}

// Hilfsfunktion: Dot-Notation Pfad setzen
function applyChanges(
  data: Record<string, unknown>,
  changes: Array<{ field: string; newValue: unknown }>
): Record<string, unknown> {
  const result = structuredClone(data);
  for (const change of changes) {
    setNestedValue(result, change.field, change.newValue);
  }
  return result;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}
```

---

## 3. Storage-Erweiterung

### Datei: `src/lib/doc-gen/storage.ts` (neu oder Erweiterung bestehend)

```typescript
export interface StoredDocument {
  hash: string;
  templateId: string;
  html: string;
  data: unknown;
  createdAt: Date;
  previousHash?: string;      // Versionskette
  changelog?: ChangelogEntry[];
}

export async function storeDocument(
  html: string,
  data: unknown,
  meta: {
    previousHash?: string;
    templateId: string;
    changelog?: ChangelogEntry[];
  }
): Promise<string> {
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex")
    .substring(0, 16);

  // In Datenbank speichern (NeonDB / bestehende Infrastruktur)
  await db.insert(documents).values({
    hash,
    templateId: meta.templateId,
    html,
    data: JSON.stringify(data),
    previousHash: meta.previousHash ?? null,
    changelog: JSON.stringify(meta.changelog ?? []),
    createdAt: new Date(),
  });

  return hash;
}

export async function getDocumentByHash(hash: string): Promise<StoredDocument | null> {
  const result = await db.query.documents.findFirst({
    where: eq(documents.hash, hash),
  });
  if (!result) return null;
  return {
    ...result,
    data: JSON.parse(result.data),
    changelog: JSON.parse(result.changelog ?? "[]"),
  };
}

// Versionshistorie eines Dokuments abrufen (rückwärts durch die Kette)
export async function getDocumentHistory(hash: string): Promise<StoredDocument[]> {
  const history: StoredDocument[] = [];
  let current = await getDocumentByHash(hash);
  while (current) {
    history.push(current);
    if (!current.previousHash) break;
    current = await getDocumentByHash(current.previousHash);
  }
  return history; // Neueste zuerst
}
```

---

## 4. UI-Ebene

### Komponente: `src/components/doc-gen/DocumentAmendmentChat.tsx`

Eingabefeld unter der Dokument-Vorschau:

```typescript
"use client";

import { useState } from "react";

interface Props {
  templateId: string;
  currentHash: string;
  onAmended: (newHash: string, html: string) => void;
}

export function DocumentAmendmentChat({ templateId, currentHash, onAmended }: Props) {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastChangelog, setLastChangelog] = useState<ChangelogEntry[]>([]);

  async function handleAmend() {
    if (!prompt.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/doc-gen/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash: currentHash, amendmentPrompt: prompt }),
      });
      const data = await res.json();
      if (res.ok) {
        setLastChangelog(data.changelog);
        onAmended(data.newHash, data.html);
        setPrompt("");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="amendment-chat">
      {/* Letztes Changelog anzeigen */}
      {lastChangelog.length > 0 && (
        <div className="changelog-preview">
          <h4>Letzte Änderungen:</h4>
          {lastChangelog.map((entry, i) => (
            <div key={i} className="changelog-entry">
              <span className="field">{entry.field}</span>
              <span className="old">→ {String(entry.oldValue)}</span>
              <span className="new">→ {String(entry.newValue)}</span>
              <span className="desc">{entry.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Eingabebereich */}
      <div className="input-row">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAmend()}
          placeholder="Änderung beschreiben, z.B. 'Projektnamen zu Musterhaus GmbH ändern'..."
          disabled={isLoading}
        />
        <button onClick={handleAmend} disabled={isLoading || !prompt.trim()}>
          {isLoading ? "Wird geändert..." : "Ändern"}
        </button>
      </div>
    </div>
  );
}
```

### UI-Integration: Dokument-Vorschau-Seite

```typescript
// src/app/doc-gen/[id]/[hash]/page.tsx

import { DocumentAmendmentChat } from "@/components/doc-gen/DocumentAmendmentChat";
import { getDocumentByHash, getDocumentHistory } from "@/lib/doc-gen/storage";

export default async function DocumentPage({
  params,
}: {
  params: { id: string; hash: string };
}) {
  const doc = await getDocumentByHash(params.hash);
  const history = await getDocumentHistory(params.hash);

  return (
    <div>
      {/* Versionshistorie */}
      {history.length > 1 && (
        <div className="version-history">
          <span>Version {history.length} von {history.length}</span>
          {history.map((v, i) => (
            <a key={v.hash} href={`/doc-gen/${params.id}/${v.hash}`}>
              v{history.length - i}
            </a>
          ))}
        </div>
      )}

      {/* Dokument-Vorschau (iframe) */}
      <iframe
        srcDoc={doc?.html}
        className="document-preview"
        title="Dokument Vorschau"
      />

      {/* Amendment Chat */}
      <DocumentAmendmentChat
        templateId={params.id}
        currentHash={params.hash}
        onAmended={(newHash) => {
          // Navigation zur neuen Version
          window.location.href = `/doc-gen/${params.id}/${newHash}`;
        }}
      />
    </div>
  );
}
```

---

## 5. Datenbank-Schema

Erweiterung der bestehenden `documents`-Tabelle (Drizzle ORM):

```typescript
// src/lib/db/schema.ts (Ergänzung)

export const documents = pgTable("documents", {
  hash:         varchar("hash", { length: 16 }).primaryKey(),
  templateId:   varchar("template_id", { length: 50 }).notNull(),
  html:         text("html").notNull(),
  data:         text("data").notNull(),            // JSON stringified
  previousHash: varchar("previous_hash", { length: 16 }),  // Versions-Kette
  changelog:    text("changelog"),                 // JSON stringified ChangelogEntry[]
  createdAt:    timestamp("created_at").defaultNow(),
});
```

---

## 6. Implementierungsreihenfolge

```
Phase 1 (Backend):
  ├── storage.ts erweitern (getDocumentByHash, storeDocument mit previousHash)
  ├── ai-processor.ts: processAmendmentRequest() hinzufügen
  └── route.ts: PATCH-Handler ergänzen

Phase 2 (Frontend):
  ├── DocumentAmendmentChat-Komponente erstellen
  ├── Dokument-Vorschau-Seite um Chat-Bereich erweitern
  └── Versionshistorie-Navigation implementieren

Phase 3 (Datenbank):
  └── Migration: previousHash + changelog Felder zur documents-Tabelle
```

**Zeitschätzung:** 6–10 Stunden für vollständige Implementierung

---

## 7. Prompt Caching (Optimierung)

Da Amendment-Anfragen teuer sein können (großes Datenmodell im Kontext), Anthropic Prompt Caching nutzen:

```typescript
// In processAmendmentRequest():
messages: [
  {
    role: "user",
    content: [
      {
        type: "text",
        text: `Datenmodell:\n${JSON.stringify(currentData, null, 2)}`,
        // Datenmodell wird gecached — spart Token bei mehreren Änderungen
        experimental_providerMetadata: {
          anthropic: { cacheControl: { type: "ephemeral" } },
        },
      },
      {
        type: "text",
        text: `Gewünschte Änderung: "${amendmentPrompt}"`,
        // Dynamischer Teil — nicht gecached
      },
    ],
  },
],
```

---

*Amendment Feature Plan v1.0 · auto-doc Plattform · Hoam / Eco Chalets GmbH*
