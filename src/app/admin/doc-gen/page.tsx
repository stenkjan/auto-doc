"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import remarkGfm from "remark-gfm";
import toast from "react-hot-toast";
import { AI_MODELS, DEFAULT_MODEL_ID } from "@/lib/doc-gen/models";
import type { Resource } from "@/lib/doc-gen/ai-engine";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

type GenerationStatus = "idle" | "generating" | "streaming" | "done" | "error";

interface GenerationResult {
  markdown: string;
  title?: string;
}

const FREE_BADGE = "bg-green-100 text-green-700";

export default function DocGenPage() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [streamingMarkdown, setStreamingMarkdown] = useState("");
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Resources state
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceUrl, setResourceUrl] = useState("");
  const [loadingResource, setLoadingResource] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const modelPickerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const selectedModel =
    AI_MODELS.find((m) => m.id === selectedModelId) ?? AI_MODELS[0];

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

  /* ── Resource loading ─────────────────────────────────────────── */

  const loadDriveResource = useCallback(async () => {
    if (!driveUrl.trim()) return;
    setLoadingResource(true);
    try {
      const res = await fetch("/api/admin/doc-gen/fetch-resource", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driveUrl: driveUrl.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler beim Laden");
      setResources((prev) => [...prev, json as Resource]);
      setDriveUrl("");
      toast.success(`"${(json as Resource).name}" geladen`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Laden");
    } finally {
      setLoadingResource(false);
    }
  }, [driveUrl]);

  const uploadFile = useCallback(async (file: File) => {
    setLoadingResource(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/doc-gen/fetch-resource", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler beim Hochladen");
      setResources((prev) => [...prev, json as Resource]);
      toast.success(`"${(json as Resource).name}" geladen`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Hochladen");
    } finally {
      setLoadingResource(false);
    }
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      files.forEach(uploadFile);
      e.target.value = "";
    },
    [uploadFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      files.forEach(uploadFile);
    },
    [uploadFile]
  );

  const removeResource = useCallback((index: number) => {
    setResources((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /* ── Generation ───────────────────────────────────────────────── */

  const generate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error("Bitte einen Prompt eingeben");
      return;
    }

    setStatus("streaming");
    setStatusMessage("Generiere Dokument...");
    setStreamingMarkdown("");
    if (!isEditMode) setResult(null);

    const existingMarkdown = isEditMode ? result?.markdown : undefined;

    try {
      const res = await fetch("/api/admin/doc-gen/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          modelId: selectedModelId,
          existingMarkdown,
          resources: resources.length > 0 ? resources : undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error ?? "Generation failed");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response stream");

      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ") && currentEvent) {
            try {
              const eventData = JSON.parse(line.slice(6));
              if (currentEvent === "status") {
                setStatusMessage(eventData.message);
              } else if (currentEvent === "chunk") {
                accumulated += eventData.text;
                setStreamingMarkdown(accumulated);
              } else if (currentEvent === "complete") {
                setResult({ markdown: eventData.markdown });
                setStreamingMarkdown("");
                setStatus("done");
                setStatusMessage("");
                setPrompt("");
                setIsEditMode(false);
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
      setStreamingMarkdown("");
    }
  }, [prompt, selectedModelId, isEditMode, result, resources]);

  const downloadPDF = useCallback(async () => {
    if (!previewRef.current) return;
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const filename = result?.title
        ? `${result.title.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, "").trim()}.pdf`
        : `Dokument-${Date.now()}.pdf`;
      html2pdf()
        .set({
          margin: [15, 15, 15, 15],
          filename,
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(previewRef.current)
        .save();
      toast.success("PDF wird heruntergeladen...");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "PDF-Erzeugung fehlgeschlagen"
      );
    }
  }, [result]);

  const isRunning = status === "generating" || status === "streaming";
  const displayMarkdown = isRunning ? streamingMarkdown : result?.markdown ?? "";

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

            {/* Prompt card */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">
                {isEditMode ? "Dokument bearbeiten" : "Neues Dokument"}
              </h2>

              {isEditMode && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-xs text-amber-700 font-medium">
                    Bearbeitungsmodus aktiv
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditMode(false)}
                    className="ml-auto text-xs text-amber-600 hover:text-amber-800 underline"
                  >
                    Abbrechen
                  </button>
                </div>
              )}

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                    generate();
                }}
                placeholder={
                  isEditMode
                    ? "Was soll geändert werden?"
                    : "Erstelle eine Kostenplanung für Projekt Arlberg mit 2 Grundstücken und 3 Haustypen..."
                }
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              {/* Model picker */}
              <div className="relative" ref={modelPickerRef}>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Modell</p>
                <button
                  type="button"
                  onClick={() => setShowModelPicker((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 border border-gray-300 rounded-lg px-3 py-2.5 text-left hover:border-gray-400 transition-colors bg-white"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${FREE_BADGE}`}>
                        Kostenlos
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
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showModelPicker && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-80 overflow-y-auto">
                    {AI_MODELS.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => { setSelectedModelId(model.id); setShowModelPicker(false); }}
                        className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${selectedModelId === model.id ? "bg-blue-50" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-gray-900">{model.label}</span>
                          <span className="text-xs text-gray-400 shrink-0">{model.contextWindow} ctx</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{model.description}</p>
                        {selectedModelId === model.id && (
                          <span className="text-xs text-blue-600 font-medium">Ausgewählt</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Generate button */}
              <button
                onClick={generate}
                disabled={isRunning}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isRunning ? "Generiert..." : isEditMode ? "Anpassen" : "Generieren"}
              </button>

              {statusMessage && (
                <p className={`text-xs ${status === "error" ? "text-red-600" : "text-blue-600"}`}>
                  {statusMessage}
                </p>
              )}
              <p className="text-xs text-gray-400">Tipp: Ctrl+Enter zum Generieren</p>
            </div>

            {/* Resources card */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Referenzen</h2>
                {resources.length > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                    {resources.length}
                  </span>
                )}
              </div>

              {/* Drive link input */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Google Drive Link</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={driveUrl}
                    onChange={(e) => setDriveUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") loadDriveResource(); }}
                    placeholder="https://drive.google.com/..."
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={loadDriveResource}
                    disabled={!driveUrl.trim() || loadingResource}
                    className="shrink-0 bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loadingResource ? "..." : "Laden"}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Google Docs, Sheets, DOCX, PDF — SA muss Zugriff haben
                </p>
              </div>

              {/* File drop zone */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Datei hochladen</p>
                <div
                  ref={dropZoneRef}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg px-4 py-5 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {loadingResource ? (
                    <p className="text-xs text-blue-600">Wird verarbeitet...</p>
                  ) : (
                    <>
                      <p className="text-xs font-medium text-gray-600">
                        Datei hierher ziehen
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        oder klicken zum Auswählen
                      </p>
                      <p className="text-xs text-gray-300 mt-1">
                        PDF, DOCX, TXT, MD, CSV, JSON
                      </p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt,.md,.csv,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Loaded resources list */}
              {resources.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-500">Geladen</p>
                  {resources.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg"
                    >
                      <span className="text-green-600 text-xs shrink-0">✓</span>
                      <span className="text-xs text-green-800 font-medium truncate flex-1">
                        {r.name}
                      </span>
                      <span className="text-xs text-green-500 shrink-0">
                        {Math.round(r.content.length / 1000)}k
                      </span>
                      <button
                        type="button"
                        onClick={() => removeResource(i)}
                        className="text-green-400 hover:text-red-500 transition-colors text-xs shrink-0 ml-1"
                        title="Entfernen"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setResources([])}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Alle entfernen
                  </button>
                </div>
              )}
            </div>

            {/* Export + Edit panel */}
            {result !== null && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-2">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Aktionen</h2>
                <button
                  onClick={downloadPDF}
                  disabled={isRunning}
                  className="w-full bg-gray-900 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  PDF herunterladen
                </button>
                <button
                  onClick={() => { setIsEditMode(true); setPrompt(""); }}
                  disabled={isRunning}
                  className="w-full bg-blue-50 text-blue-700 border border-blue-200 py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Dokument bearbeiten
                </button>
                <button
                  disabled
                  className="w-full bg-gray-100 text-gray-400 py-2 px-4 rounded-lg text-sm font-medium cursor-not-allowed"
                >
                  In Google Drive speichern (Phase 5)
                </button>
                {result.title && (
                  <p className="pt-1 text-xs text-gray-400">{result.title}</p>
                )}
              </div>
            )}
          </div>

          {/* Right panel: Markdown Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Vorschau</h2>
                {isRunning && (
                  <span className="flex items-center gap-1.5 text-xs text-blue-600">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                    Generiert live...
                  </span>
                )}
                {result !== null && !isRunning && (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${FREE_BADGE}`}>
                    {selectedModel.label}
                  </span>
                )}
              </div>

              {displayMarkdown ? (
                <div
                  ref={previewRef}
                  id="markdown-preview"
                  className="prose prose-blue max-w-none p-8 overflow-auto"
                  style={{ height: "calc(100vh - 200px)", minHeight: "600px" }}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {displayMarkdown}
                  </ReactMarkdown>
                </div>
              ) : (
                <div
                  className="flex items-center justify-center text-gray-400 text-sm"
                  style={{ height: "calc(100vh - 200px)", minHeight: "600px" }}
                >
                  <div className="text-center space-y-2">
                    <p className="text-4xl">📄</p>
                    <p>Gib einen Prompt ein und klicke &quot;Generieren&quot;</p>
                    <p className="text-xs text-gray-300">
                      Das Dokument erscheint hier während der Generierung
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
