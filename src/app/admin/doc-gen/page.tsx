"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import toast from "react-hot-toast";
import type { AIModel } from "@/lib/doc-gen/models";
import { AI_MODELS, DEFAULT_MODEL_ID } from "@/lib/doc-gen/models";

type GenerationStatus = "idle" | "generating" | "streaming" | "done" | "error";

interface GenerationResult {
  templateType: string;
  data: unknown;
  html: string;
  title?: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  openrouter: "OpenRouter",
};

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "bg-orange-100 text-orange-700",
  gemini: "bg-blue-100 text-blue-700",
  openrouter: "bg-purple-100 text-purple-700",
};

export default function DocGenPage() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [useAI, setUseAI] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);

  const selectedModel: AIModel =
    AI_MODELS.find((m) => m.id === selectedModelId) ?? AI_MODELS[0];

  // Close model picker when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        modelPickerRef.current &&
        !modelPickerRef.current.contains(e.target as Node)
      ) {
        setShowModelPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        body: JSON.stringify({ prompt, modelId: selectedModelId }),
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
      const msg = error instanceof Error ? error.message : "Unbekannter Fehler";
      setStatusMessage(msg);
      toast.error(msg);
    }
  }, [prompt, selectedModelId]);

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
      const msg = error instanceof Error ? error.message : "Unbekannter Fehler";
      setStatusMessage(msg);
      toast.error(msg);
    }
  }, [prompt]);

  const handleGenerate = useCallback(() => {
    if (useAI) generateWithAI();
    else generateDirect();
  }, [useAI, generateWithAI, generateDirect]);

  const downloadPDF = useCallback(async () => {
    if (!result) return;
    setStatusMessage("Erzeuge PDF...");
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
  }, [result]);

  const isRunning = status === "generating" || status === "streaming";

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
          <span
            className={`text-xs px-2 py-1 rounded-full font-medium ${
              status === "done"
                ? "bg-green-100 text-green-700"
                : status === "error"
                  ? "bg-red-100 text-red-700"
                  : isRunning
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-500"
            }`}
          >
            {status === "idle"
              ? "Bereit"
              : status === "done"
                ? "Fertig"
                : status === "error"
                  ? "Fehler"
                  : "Läuft..."}
          </span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">Prompt</h2>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                    handleGenerate();
                }}
                placeholder="Erstelle eine Kostenplanung für Projekt Arlberg mit 2 Grundstücken und 3 Haustypen..."
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              {/* AI toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setUseAI((v) => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    useAI ? "bg-blue-600" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      useAI ? "translate-x-4.5" : "translate-x-0.5"
                    }`}
                  />
                </div>
                <span className="text-sm text-gray-700">AI verwenden</span>
              </label>

              {/* Model picker – only shown when AI is on */}
              {useAI && (
                <div className="relative" ref={modelPickerRef}>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">
                    Modell
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowModelPicker((v) => !v)}
                    className="w-full flex items-center justify-between gap-2 border border-gray-300 rounded-lg px-3 py-2.5 text-left hover:border-gray-400 transition-colors bg-white"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
                            PROVIDER_COLORS[selectedModel.provider] ??
                            "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {PROVIDER_LABELS[selectedModel.provider]}
                        </span>
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {selectedModel.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {selectedModel.description}
                      </p>
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${showModelPicker ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {showModelPicker && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-80 overflow-y-auto">
                      {(
                        ["anthropic", "gemini", "openrouter"] as const
                      ).map((provider) => {
                        const models = AI_MODELS.filter(
                          (m) => m.provider === provider
                        );
                        if (!models.length) return null;
                        return (
                          <div key={provider}>
                            <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                              <span
                                className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                                  PROVIDER_COLORS[provider]
                                }`}
                              >
                                {PROVIDER_LABELS[provider]}
                              </span>
                            </div>
                            {models.map((model) => (
                              <button
                                key={model.id}
                                type="button"
                                onClick={() => {
                                  setSelectedModelId(model.id);
                                  setShowModelPicker(false);
                                }}
                                className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${
                                  selectedModelId === model.id
                                    ? "bg-blue-50"
                                    : ""
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium text-gray-900">
                                    {model.label}
                                  </span>
                                  <span className="text-xs text-gray-400 shrink-0">
                                    {model.contextWindow} ctx
                                  </span>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {model.description}
                                </p>
                                {selectedModelId === model.id && (
                                  <span className="text-xs text-blue-600 font-medium">
                                    ✓ Ausgewählt
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={isRunning}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isRunning ? "Generiert..." : "Generieren"}
                </button>
                <button
                  onClick={loadDefaultPreview}
                  disabled={isRunning}
                  className="bg-gray-100 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  Vorschau
                </button>
              </div>

              {statusMessage && (
                <p
                  className={`text-xs ${
                    status === "error" ? "text-red-600" : "text-blue-600"
                  }`}
                >
                  {statusMessage}
                </p>
              )}

              {useAI && (
                <p className="text-xs text-gray-400">
                  Tipp: Ctrl+Enter zum Generieren
                </p>
              )}
            </div>

            {/* Export panel */}
            {result !== null && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-2">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  Export
                </h2>
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
                {result.title && (
                  <p className="pt-1 text-xs text-gray-400">
                    {result.templateType} | {result.title}
                  </p>
                )}
              </div>
            )}

            {/* JSON inspector */}
            {result?.data != null && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  Generierte Daten
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
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {result.templateType}
                    </span>
                    {useAI && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          PROVIDER_COLORS[selectedModel.provider] ??
                          "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {selectedModel.label}
                      </span>
                    )}
                  </div>
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
                    <p>Klicke &quot;Vorschau&quot; für eine Standardvorschau</p>
                    <p>
                      oder gib einen Prompt ein und klicke &quot;Generieren&quot;
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
