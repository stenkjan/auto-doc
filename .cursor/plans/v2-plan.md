---
name: AI Document Generator Platform v2 ("Agentic Prompt Machine")
overview: Migration der bestehenden starren JSON/HTML-Dokumentengenerierung zu einer agentischen, iterativen "Prompt Machine". Die Architektur nutzt das Vercel AI SDK mit `tools` und `maxSteps`, um externe Datenquellen iterativ abzufragen. Ergebnisse werden in einem Cloud-basierten "Write-Ahead"-Memory (S3/Blob/DB-basiertes MD-Storage) zwischengespeichert. Das Frontend bietet eine Split-Screen-UI. Das Layout wird global über Tailwind Typography gesteuert, der PDF-Export erfolgt clientseitig.
todos:
  - id: cleanup
    content: "Phase 0: Bereinigung der Codebase (Entfernen von Puppeteer, @sparticuz/chromium und der strikten JSON-Schema-Zwingung aus der AI-Engine)."
    status: pending
  - id: memory-system
    content: "Phase 1: Implementierung des cloud-basierten 'Write-Ahead' Memory-Systems (Speichern von abgerufenen API-Daten als strukturierte Markdown-Dateien in S3/Blob oder der Postgres-DB)."
    status: pending
  - id: agentic-engine
    content: "Phase 2: Umbau der `ai-engine.ts` zur Nutzung des Vercel AI SDKs mit `tools` (API-Anbindungen) und `maxSteps` (für den iterativen 'Cursor-Effekt')."
    status: pending
  - id: web-ui
    content: "Phase 3: Umbau der `page.tsx` zu einer Split-Screen-UI mit Chat-Verlauf und Echtzeit-Markdown-Rendering (`react-markdown` + `@tailwindcss/typography`)."
    status: pending
  - id: export-pipeline
    content: "Phase 4: Implementierung des clientseitigen PDF-Exports (z.B. via `html2pdf.js` oder nativem Druck-Dialog)."
    status: pending
  - id: sandbox-optional
    content: "Phase 5 (Optional): Integration von E2B (e2b.dev) als Tool, falls die KI echten Python/Node-Code zur Datenverarbeitung ausführen muss."
    status: pending
isProject: true
---

# AI Document Generator Platform v2

## 1. Architektur-Übersicht

```mermaid
flowchart TD
    subgraph userLayer [User Layer]
        ChatUI["Chat UI\n(Linkes Panel)"]
        PreviewUI["Live Document Preview\n(Rechtes Panel)"]
    end

    subgraph agentLayer [Agentic Engine (Vercel AI SDK)]
        Claude["Claude 3.5 Sonnet\n(maxSteps: 5)"]
        Tools["Tool-Aufrufe\n(Drive, GitHub, etc.)"]
        Sandbox["E2B Sandbox\n(Code Execution)"]
    end

    subgraph memoryLayer [Context & Memory]
        Rules["Regel-Engine\n(global-rules.md)"]
        CloudMemory["Cloud Memory\n(Vercel Blob / Postgres MD Storage)"]
    end

    subgraph renderLayer [Rendering & Export]
        MarkdownEngine["Markdown Renderer\n(react-markdown)"]
        PDFExport["Client-side PDF Export"]
    end

    ChatUI -->|"Prompt"| Claude
    Rules -->|"System Prompt"| Claude
    CloudMemory -->|"Lade existierenden Kontext"| Claude
    
    Claude <-->|"braucht Daten"| Tools
    Tools -->|"schreibe Zusammenfassung"| CloudMemory
    Claude <-->|"muss Daten berechnen"| Sandbox

    Claude -->|"Generiertes Markdown"| MarkdownEngine
    MarkdownEngine --> PreviewUI
    PreviewUI --> PDFExport
```
