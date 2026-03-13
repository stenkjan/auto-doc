"use client";

import { useState, useRef, useCallback } from "react";
import toast from "react-hot-toast";

type GenerationStatus = "idle" | "generating" | "streaming" | "done" | "error";

interface GenerationResult {
  templateType: string;
  data: unknown;
  html: string;
  title?: string;
}

export default function DocGenPage() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [useAI, setUseAI] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const loadDefaultPreview = useCallback(async () => {
    setStatus("generating");
    setStatusMessage("Lade Standardvorschau...");

    try {
      const res = await fetch(
        "/api/admin/doc-gen?action=preview-default&type=cost-plan"
      );
      const json = await res.json();

      if (!res.ok) throw new Error(json.error);

      setResult({
        templateType: "cost-plan",
        data: json.data,
        html: json.html,
        title: "Kostenplanung (Standard)",
      });
      setStatus("done");
      setStatusMessage("");
    } catch (error) {
      setStatus("error");
      setStatusMessage(
        error instanceof Error ? error.message : "Fehler beim Laden"
      );
    }
  }, []);

  const generateWithAI = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error("Bitte einen Prompt eingeben");
      return;
    }

    setStatus("streaming");
    setStatusMessage("Analysiere Prompt...");
    setResult(null);

    try {
      const res = await fetch("/api/admin/doc-gen/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error ?? "Generation failed");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response stream");

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7);
          } else if (line.startsWith("data: ") && currentEvent) {
            try {
              const eventData = JSON.parse(line.slice(6));

              if (currentEvent === "status") {
                setStatusMessage(eventData.message);
              } else if (currentEvent === "classification") {
                setStatusMessage(
                  `Erkannt: ${eventData.templateType} (${Math.round(eventData.confidence * 100)}%)`
                );
              } else if (currentEvent === "complete") {
                setResult({
                  templateType: eventData.templateType,
                  data: eventData.data,
                  html: eventData.html,
                });
                setStatus("done");
                setStatusMessage("");
                toast.success("Dokument generiert!");
              } else if (currentEvent === "error") {
                throw new Error(eventData.message);
              }
            } catch (parseError) {
              if (
                parseError instanceof Error &&
                parseError.message !== "Unexpected end of JSON input"
              ) {
                throw parseError;
              }
            }
            currentEvent = "";
          }
        }
      }
    } catch (error) {
      setStatus("error");
      const msg =
        error instanceof Error ? error.message : "Unbekannter Fehler";
      setStatusMessage(msg);
      toast.error(msg);
    }
  }, [prompt]);

  const generateDirect = useCallback(async () => {
    setStatus("generating");
    setStatusMessage("Generiere mit Standarddaten...");

    try {
      const res = await fetch("/api/admin/doc-gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt || "Kostenplanung mit Standardwerten",
          templateType: "cost-plan",
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? json.details);

      setResult({
        templateType: json.templateType,
        data: json.data,
        html: json.html,
        title: json.title,
      });
      setStatus("done");
      setStatusMessage("");
      toast.success("Dokument generiert!");
    } catch (error) {
      setStatus("error");
      const msg =
        error instanceof Error ? error.message : "Unbekannter Fehler";
      setStatusMessage(msg);
      toast.error(msg);
    }
  }, [prompt]);

  const handleGenerate = useCallback(() => {
    if (useAI) {
      generateWithAI();
    } else {
      generateDirect();
    }
  }, [useAI, generateWithAI, generateDirect]);

  const downloadPDF = useCallback(async () => {
    if (!result) return;

    setStatusMessage("Erzeuge PDF...");

    try {
      const res = await fetch("/api/admin/doc-gen/pdf/route", {
        method: "POST",
      });

      if (!res.ok) {
        const pdfRes = await fetch("/api/admin/doc-gen/0/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateType: result.templateType,
            data: result.data,
          }),
        });

        if (!pdfRes.ok) {
          throw new Error("PDF generation failed");
        }

        const blob = await pdfRes.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Kostenplanung-${Date.now()}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }

      setStatusMessage("");
      toast.success("PDF heruntergeladen!");
    } catch (error) {
      console.error("PDF download error, trying direct approach:", error);

      try {
        const res = await fetch("/api/admin/doc-gen/0/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateType: result.templateType,
            data: result.data,
          }),
        });

        if (!res.ok) throw new Error("PDF generation failed");

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Kostenplanung-${Date.now()}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("PDF heruntergeladen!");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "PDF-Erzeugung fehlgeschlagen"
        );
      }

      setStatusMessage("");
    }
  }, [result]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Dokumentengenerator
            </h1>
            <p className="text-sm text-gray-500">
              AI-gestützte Dokumentenerstellung
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {status === "idle"
                ? "Bereit"
                : status === "done"
                  ? "Fertig"
                  : status === "error"
                    ? "Fehler"
                    : "Läuft..."}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel: Prompt input */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Prompt
              </h2>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Erstelle eine Kostenplanung für Projekt Arlberg mit 2 Grundstücken und 3 Haustypen..."
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              <div className="flex items-center gap-2 mt-3 mb-3">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useAI}
                    onChange={(e) => setUseAI(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Claude AI verwenden
                </label>
                {!useAI && (
                  <span className="text-xs text-gray-400">
                    (Standarddaten)
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={
                    status === "generating" || status === "streaming"
                  }
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {status === "generating" || status === "streaming"
                    ? "Generiert..."
                    : "Generieren"}
                </button>

                <button
                  onClick={loadDefaultPreview}
                  disabled={
                    status === "generating" || status === "streaming"
                  }
                  className="bg-gray-100 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  Vorschau
                </button>
              </div>

              {statusMessage && (
                <p
                  className={`mt-3 text-xs ${status === "error" ? "text-red-600" : "text-blue-600"}`}
                >
                  {statusMessage}
                </p>
              )}
            </div>

            {/* Export panel */}
            {result !== null && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  Export
                </h2>
                <div className="space-y-2">
                  <button
                    onClick={downloadPDF}
                    className="w-full bg-gray-900 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                  >
                    PDF herunterladen
                  </button>
                  <button
                    disabled
                    className="w-full bg-gray-100 text-gray-400 py-2 px-4 rounded-lg text-sm font-medium cursor-not-allowed"
                  >
                    Excel herunterladen (Phase 5)
                  </button>
                  <button
                    disabled
                    className="w-full bg-gray-100 text-gray-400 py-2 px-4 rounded-lg text-sm font-medium cursor-not-allowed"
                  >
                    In Google Drive speichern (Phase 6)
                  </button>
                </div>

                {result.title && (
                  <p className="mt-3 text-xs text-gray-400">
                    Typ: {result.templateType} | {result.title}
                  </p>
                )}
              </div>
            )}

            {/* Data inspector */}
            {result?.data != null && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  Generierte Daten (JSON)
                </h2>
                <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 max-h-64 overflow-auto font-mono">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Right panel: Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">
                  Vorschau
                </h2>
                {result !== null && (
                  <span className="text-xs text-gray-400">
                    {result.templateType}
                  </span>
                )}
              </div>

              {result?.html ? (
                <iframe
                  ref={iframeRef}
                  srcDoc={result.html}
                  className="w-full border-0"
                  style={{ height: "calc(100vh - 200px)", minHeight: "600px" }}
                  title="Document Preview"
                />
              ) : (
                <div
                  className="flex items-center justify-center text-gray-400 text-sm"
                  style={{ height: "calc(100vh - 200px)", minHeight: "600px" }}
                >
                  <div className="text-center space-y-2">
                    <p className="text-4xl">📄</p>
                    <p>
                      Klicke &quot;Vorschau&quot; für eine Standardvorschau
                    </p>
                    <p>
                      oder gib einen Prompt ein und klicke
                      &quot;Generieren&quot;
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
