"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import remarkGfm from "remark-gfm";
import toast from "react-hot-toast";
import { AI_MODELS, DEFAULT_MODEL_ID } from "@/lib/doc-gen/models";
import { BUILTIN_CONTEXTS, DEFAULT_CONTEXT_ID } from "@/lib/doc-gen/context-registry";
import type { Resource, PlanMessage, PlanResult } from "@/lib/doc-gen/ai-engine";
import { SourcesPanel } from "./_components/SourcesPanel";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

type GenerationStatus = "idle" | "generating" | "streaming" | "done" | "error";

interface GenerationResult {
  markdown: string;
  title?: string;
}

interface ContextEntry {
  id: string;
  label: string;
  description: string;
  content?: string;
  custom?: boolean;
}

const FREE_BADGE = "bg-green-100 text-green-700";
const PAID_BADGE = "bg-amber-100 text-amber-700";

/* ------------------------------------------------------------------ */
/*  Context Manager Modal                                               */
/* ------------------------------------------------------------------ */

function ContextManagerModal({
  onClose,
  onContextsChanged,
}: {
  onClose: () => void;
  onContextsChanged: () => void;
}) {
  const [customContexts, setCustomContexts] = useState<ContextEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editContent, setEditContent] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchCustomContexts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/doc-gen/contexts");
      const json = await res.json();
      setCustomContexts(json.contexts ?? []);
    } catch {
      toast.error("Fehler beim Laden der Kontexte");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomContexts();
  }, [fetchCustomContexts]);

  const startEdit = useCallback((ctx: ContextEntry) => {
    setEditingId(ctx.id);
    setEditLabel(ctx.label);
    setEditContent(ctx.content ?? "");
    setIsCreating(false);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditLabel("");
    setEditContent("");
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId || !editContent.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/doc-gen/contexts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, label: editLabel, content: editContent }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? "Fehler beim Speichern");
      }
      toast.success("Kontext gespeichert");
      cancelEdit();
      await fetchCustomContexts();
      onContextsChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setSaving(false);
    }
  }, [editingId, editLabel, editContent, cancelEdit, fetchCustomContexts, onContextsChanged]);

  const deleteContext = useCallback(async (id: string, label: string) => {
    if (!confirm(`Kontext "${label}" wirklich löschen?`)) return;
    try {
      const res = await fetch("/api/doc-gen/contexts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? "Fehler beim Löschen");
      }
      toast.success(`"${label}" gelöscht`);
      await fetchCustomContexts();
      onContextsChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    }
  }, [fetchCustomContexts, onContextsChanged]);

  const createContext = useCallback(async () => {
    if (!newLabel.trim() || !newContent.trim()) {
      toast.error("Name und Inhalt sind erforderlich");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/doc-gen/contexts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel, description: newDescription, content: newContent }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? "Fehler beim Erstellen");
      }
      toast.success(`"${newLabel}" erstellt`);
      setIsCreating(false);
      setNewLabel("");
      setNewDescription("");
      setNewContent("");
      await fetchCustomContexts();
      onContextsChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setSaving(false);
    }
  }, [newLabel, newDescription, newContent, fetchCustomContexts, onContextsChanged]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Kontexte verwalten</h2>
            <p className="text-xs text-gray-500 mt-0.5">Eigene Kontext-Definitionen als .md hinzufügen, bearbeiten oder löschen</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Built-in contexts (read-only display) */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Eingebaut (schreibgeschützt)</p>
            <div className="space-y-1.5">
              {BUILTIN_CONTEXTS.map((ctx) => (
                <div key={ctx.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-700">{ctx.label}</span>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{ctx.description}</p>
                  </div>
                  <span className="text-xs text-gray-300 shrink-0">Eingebaut</span>
                </div>
              ))}
            </div>
          </div>

          {/* Custom contexts */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Eigene Kontexte</p>

            {loading ? (
              <p className="text-xs text-gray-400 py-2">Lädt...</p>
            ) : customContexts.length === 0 && !isCreating ? (
              <p className="text-xs text-gray-400 py-2">Noch keine eigenen Kontexte vorhanden.</p>
            ) : (
              <div className="space-y-2">
                {customContexts.map((ctx) => (
                  <div key={ctx.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {editingId === ctx.id ? (
                      <div className="p-3 space-y-2 bg-blue-50">
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Name des Kontexts"
                        />
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={10}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Markdown-Inhalt des Kontexts..."
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            Abbrechen
                          </button>
                          <button
                            type="button"
                            onClick={saveEdit}
                            disabled={saving}
                            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            {saving ? "Speichert..." : "Speichern"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-800">{ctx.label}</span>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{ctx.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => startEdit(ctx)}
                          className="text-xs text-blue-600 hover:text-blue-800 shrink-0 transition-colors"
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteContext(ctx.id, ctx.label)}
                          className="text-xs text-gray-400 hover:text-red-500 shrink-0 transition-colors"
                        >
                          Löschen
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Create new context form */}
          {isCreating && (
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-2">
              <p className="text-xs font-semibold text-blue-700 mb-2">Neuer Kontext</p>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Name (z.B. Mietvertrag, Protokoll, ...)"
                autoFocus
              />
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Kurzbeschreibung (optional)"
              />
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`Beschreibe dem AI-Assistenten hier seinen Kontext, z.B.:\n\nDu bist ein Assistent für Mietvertragsanalyse...\n\n## Aufgabenbereich\n- ...\n\n## Qualität\n- ...`}
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setIsCreating(false); setNewLabel(""); setNewDescription(""); setNewContent(""); }}
                  className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={createContext}
                  disabled={saving}
                  className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Erstellt..." : "Erstellen"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <button
            type="button"
            onClick={() => { setIsCreating(true); setEditingId(null); }}
            disabled={isCreating}
            className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
          >
            + Neuer Kontext
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */

export default function DocGenPage() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [streamingMarkdown, setStreamingMarkdown] = useState("");
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [allContexts, setAllContexts] = useState<ContextEntry[]>(BUILTIN_CONTEXTS);
  const [selectedContextId, setSelectedContextId] = useState(DEFAULT_CONTEXT_ID);
  const [showContextPicker, setShowContextPicker] = useState(false);
  const [showContextManager, setShowContextManager] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // --- New Feature States ---
  const [cost, setCost] = useState<{ formatted: string; inputTokens: number; outputTokens: number } | null>(null);

  // Plan Mode
  const [isPlanMode, setIsPlanMode] = useState(false);
  const [planMessages, setPlanMessages] = useState<PlanMessage[]>([]);
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);

  // PDF Generation
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"markdown" | "html">("markdown");

  // Sources Panel
  const [showSourcesPanel, setShowSourcesPanel] = useState(false);
  // --------------------------

  const [resources, setResources] = useState<(Resource & { warning?: string })[]>([]);
  const [resourceUrl, setResourceUrl] = useState("");
  const [loadingResource, setLoadingResource] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const modelPickerRef = useRef<HTMLDivElement>(null);
  const contextPickerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const selectedModel = AI_MODELS.find((m) => m.id === selectedModelId) ?? AI_MODELS[0];
  const selectedContext = allContexts.find((c) => c.id === selectedContextId) ?? allContexts[0];

  const refreshContexts = useCallback(async () => {
    try {
      const res = await fetch("/api/doc-gen/contexts");
      const json = await res.json();
      const custom: ContextEntry[] = json.contexts ?? [];
      setAllContexts([...BUILTIN_CONTEXTS, ...custom]);
    } catch {
      // keep built-ins
    }
  }, []);

  useEffect(() => {
    refreshContexts();
  }, [refreshContexts]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false);
      }
      if (contextPickerRef.current && !contextPickerRef.current.contains(e.target as Node)) {
        setShowContextPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ── Plan Mode ────────────────────────────────────────────────── */

  const runPlan = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error("Bitte einen Prompt eingeben");
      return;
    }

    setStatus("generating");
    setStatusMessage("Analysiere Anfrage und plane...");
    
    try {
      const res = await fetch("/api/doc-gen/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          modelId: selectedModelId,
          contextId: selectedContextId,
          priorMessages: planMessages.length > 0 ? planMessages : undefined,
          resources: resources.length > 0 ? resources : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler im Plan-Modus");
      
      const newPlan = json.planResult as PlanResult;
      setPlanResult(newPlan);
      
      setPlanMessages(prev => [
        ...prev, 
        { role: "user", content: prompt },
        { role: "assistant", content: JSON.stringify(newPlan) }
      ]);
      
      setPrompt("");
      setStatus("done");
      setStatusMessage("");
      
      if (newPlan.ready) {
        toast.success("Planung abgeschlossen! Du kannst nun generieren.");
      } else {
        toast.success("Rückfragen erhalten.");
      }
      
    } catch (error) {
       setStatus("error");
       const msg = error instanceof Error ? error.message : "Unbekannter Fehler";
       setStatusMessage(msg);
       toast.error(msg);
    }
  }, [prompt, selectedModelId, selectedContextId, planMessages, resources]);

  /* ── PDF Generation ───────────────────────────────────────────── */

  const generateStyledPdf = useCallback(async () => {
     let finalPrompt = prompt.trim();
     if (isPlanMode && planResult?.ready) {
       finalPrompt = `Bitte erstelle das Dokument exakt nach diesem Plan in HTML:\n\n${planResult.proposal}`;
     }

     if (!finalPrompt && !isEditMode && !result?.markdown) {
        toast.error("Bitte einen Text generieren oder Prompt eingeben");
        return;
     }

     setStatus("generating");
     setStatusMessage("Erstelle formatiertes HTML-Design für PDF...");
     setViewMode("html");
     setGeneratedHtml(null);

     try {
        const res = await fetch("/api/doc-gen/generate-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
             prompt: finalPrompt || "Formatiere das angezeigte Dokument in perfektes HTML für PDF-Druck.",
             modelId: selectedModelId,
             contextId: selectedContextId,
             resources: resources.length > 0 ? resources : undefined,
             existingMarkdown: result?.markdown,
          })
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "PDF generation failed");

        setGeneratedHtml(json.html);
        setStatus("done");
        setStatusMessage("");
        toast.success("Design geladen! PDF kann jetzt geladen werden.");
     } catch(err) {
        setStatus("error");
        const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
        setStatusMessage(msg);
        toast.error(msg);
        setViewMode("markdown");
     }

  }, [prompt, isEditMode, result, selectedModelId, selectedContextId, resources]);

  /* ── Resource loading ─────────────────────────────────────────── */

  const loadDriveResource = useCallback(async () => {
    if (!resourceUrl.trim()) return;
    setLoadingResource(true);
    try {
      const res = await fetch("/api/doc-gen/fetch-resource", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: resourceUrl.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler beim Laden");
      const resource = json as Resource & { warning?: string };
      setResources((prev) => [...prev, resource]);
      setResourceUrl("");
      if (resource.warning) {
        toast.error(`"${resource.name}" geladen – mit Warnung`);
      } else {
        toast.success(`"${resource.name}" geladen`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Laden");
    } finally {
      setLoadingResource(false);
    }
  }, [resourceUrl]);

  const uploadFile = useCallback(async (file: File) => {
    setLoadingResource(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/doc-gen/fetch-resource", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler beim Hochladen");
      const resource = json as Resource & { warning?: string };
      setResources((prev) => [...prev, resource]);
      if (resource.warning) {
        toast.error(`"${resource.name}" – ${resource.warning}`);
      } else {
        toast.success(`"${resource.name}" geladen`);
      }
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
    let finalPrompt = prompt.trim();
    if (isPlanMode && planResult?.ready) {
      finalPrompt = `Bitte erstelle das Dokument exakt nach diesem Plan:\n\n${planResult.proposal}`;
    }

    if (!finalPrompt) {
      toast.error("Bitte einen Prompt eingeben");
      return;
    }

    setStatus("streaming");
    setStatusMessage("Generiere Dokument...");
    setStreamingMarkdown("");
    if (!isEditMode) setResult(null);

    const existingMarkdown = isEditMode ? result?.markdown : undefined;

    try {
      const res = await fetch("/api/doc-gen/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
          modelId: selectedModelId,
          contextId: selectedContextId,
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
                const finalMarkdown = eventData.markdown
                  .replace(/^```[a-z]*\s*/i, "")
                  .replace(/\s*```$/i, "")
                  .trim();
                setResult({ markdown: finalMarkdown });
                if (eventData.cost) setCost(eventData.cost);
                setStreamingMarkdown("");
                setStatus("done");
                setStatusMessage("");
                setPrompt("");
                setIsEditMode(false);
                setPlanMessages([]); // Reset plan mode once generated
                setPlanResult(null);
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
  }, [prompt, selectedModelId, selectedContextId, isEditMode, result, resources]);

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
      toast.error(err instanceof Error ? err.message : "PDF-Erzeugung fehlgeschlagen");
    }
  }, [result]);

  const downloadHtmlAsPdf = useCallback(async () => {
    if (!generatedHtml) return;
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const element = document.createElement("div");
      element.innerHTML = generatedHtml;
      toast.success("Erstelle PDF...");
      html2pdf()
        .set({
          margin: [0, 0, 0, 0],
          filename: `Styled-Dokument-${Date.now()}.pdf`,
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(element)
        .save()
        .then(() => toast.success("PDF gespeichert!"));
    } catch(err) {
       toast.error("PDF-Download fehlgeschlagen");
    }
  }, [generatedHtml]);

  const isRunning = status === "generating" || status === "streaming";
  const displayMarkdown = isRunning ? streamingMarkdown : result?.markdown ?? "";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Context Manager Modal */}
      {showContextManager && (
        <ContextManagerModal
          onClose={() => setShowContextManager(false)}
          onContextsChanged={refreshContexts}
        />
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dokumentengenerator</h1>
            <p className="text-sm text-gray-500">AI-gestützte Dokumentenerstellung</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSourcesPanel(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors border border-indigo-200"
            >
              <span>⚡</span> Quellen
            </button>
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
              {status === "idle" ? "Bereit" : status === "done" ? "Fertig" : status === "error" ? "Fehler" : "Läuft..."}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel */}
          <div className="lg:col-span-1 space-y-4">

            {/* Prompt card */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">
                  {isEditMode ? "Dokument bearbeiten" : "Neues Dokument"}
                </h2>
                <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-2 py-1 rounded-lg border border-gray-200">
                  <span className="text-xs font-medium text-gray-600">Plan-Modus</span>
                  <input
                    type="checkbox"
                    checked={isPlanMode}
                    onChange={(e) => setIsPlanMode(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </label>
              </div>

              {isEditMode && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-xs text-amber-700 font-medium">Bearbeitungsmodus aktiv</span>
                  <button
                    type="button"
                    onClick={() => setIsEditMode(false)}
                    className="ml-auto text-xs text-amber-600 hover:text-amber-800 underline"
                  >
                    Abbrechen
                  </button>
                </div>
              )}

              {/* Context picker */}
              <div className="relative" ref={contextPickerRef}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-gray-500">Kontext</p>
                  <button
                    type="button"
                    onClick={() => setShowContextManager(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Verwalten
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowContextPicker((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 border border-gray-300 rounded-lg px-3 py-2.5 text-left hover:border-gray-400 transition-colors bg-white"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {selectedContext?.custom && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-purple-100 text-purple-700 shrink-0">
                          Eigens
                        </span>
                      )}
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {selectedContext?.label ?? "Allgemein"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {selectedContext?.description ?? ""}
                    </p>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${showContextPicker ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showContextPicker && (
                  <div className="absolute z-40 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                    {allContexts.length === 0 ? (
                      <p className="text-xs text-gray-400 px-3 py-3">Keine Kontexte verfügbar</p>
                    ) : (
                      <>
                        {/* Built-in */}
                        <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Eingebaut</span>
                        </div>
                        {allContexts.filter((c) => !c.custom).map((ctx) => (
                          <button
                            key={ctx.id}
                            type="button"
                            onClick={() => { setSelectedContextId(ctx.id); setShowContextPicker(false); }}
                            className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${selectedContextId === ctx.id ? "bg-blue-50" : ""}`}
                          >
                            <span className="text-sm font-medium text-gray-900 block">{ctx.label}</span>
                            <p className="text-xs text-gray-400 mt-0.5">{ctx.description}</p>
                            {selectedContextId === ctx.id && (
                              <span className="text-xs text-blue-600 font-medium">Ausgewählt</span>
                            )}
                          </button>
                        ))}
                        {/* Custom */}
                        {allContexts.some((c) => c.custom) && (
                          <>
                            <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 border-t border-gray-200">
                              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Eigene</span>
                            </div>
                            {allContexts.filter((c) => c.custom).map((ctx) => (
                              <button
                                key={ctx.id}
                                type="button"
                                onClick={() => { setSelectedContextId(ctx.id); setShowContextPicker(false); }}
                                className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${selectedContextId === ctx.id ? "bg-blue-50" : ""}`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-purple-100 text-purple-700 shrink-0">Eigens</span>
                                  <span className="text-sm font-medium text-gray-900">{ctx.label}</span>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">{ctx.description}</p>
                                {selectedContextId === ctx.id && (
                                  <span className="text-xs text-blue-600 font-medium">Ausgewählt</span>
                                )}
                              </button>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {isPlanMode && planMessages.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3 mb-2 max-h-60 overflow-y-auto">
                  {planMessages.map((msg, idx) => (
                    <div key={idx} className={`text-sm ${msg.role === 'user' ? 'text-right' : ''}`}>
                      {msg.role === 'assistant' ? (
                        <div className="text-slate-800 bg-white p-2 rounded border border-slate-100 space-y-2">
                          {(() => {
                             try {
                               const p = JSON.parse(msg.content) as PlanResult;
                               return (
                                 <>
                                   <div className="flex items-start gap-2">
                                     <span className="text-blue-500 mt-0.5">💡</span>
                                     <p className="text-xs">{p.interpretation}</p>
                                   </div>
                                   {p.questions.length > 0 && (
                                     <div className="bg-orange-50 text-orange-800 p-2 rounded text-xs border border-orange-100">
                                       <span className="font-semibold block mb-1">Rückfragen:</span>
                                       <ul className="list-disc pl-4 space-y-0.5">
                                         {p.questions.map((q, qidx) => <li key={qidx}>{q}</li>)}
                                       </ul>
                                     </div>
                                   )}
                                   {p.proposal && (
                                     <div className="text-xs text-slate-500 italic mt-1 border-t border-slate-100 pt-1">
                                       " {p.proposal} "
                                     </div>
                                   )}
                                   {p.ready && (
                                     <div className="text-xs text-green-600 font-medium flex items-center gap-1 mt-1">
                                       <span>✓</span> Plan bereit zur Generierung
                                     </div>
                                   )}
                                 </>
                               )
                             } catch {
                               return <span className="text-xs">{msg.content}</span>;
                             }
                          })()}
                        </div>
                      ) : (
                        <div className="bg-blue-100 text-blue-800 p-2 rounded inline-block text-left text-xs max-w-[85%] border border-blue-200">
                           {msg.content}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                     if (isPlanMode && !planResult?.ready) runPlan();
                     else generate();
                  }
                }}
                placeholder={
                  isEditMode
                    ? "Was soll geändert werden?"
                    : isPlanMode && planMessages.length > 0 && !planResult?.ready
                    ? "Antworte auf die Rückfragen..."
                    : selectedContextId === "cost-plan"
                      ? "Erstelle eine Kostenplanung für Projekt Arlberg mit 2 Grundstücken und 3 Haustypen..."
                      : selectedContextId === "summary"
                        ? "Fasse das hochgeladene Dokument zusammen und hebe die wichtigsten Punkte hervor..."
                        : "Was soll erstellt werden?"
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
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${selectedModel.paid ? PAID_BADGE : FREE_BADGE}`}>
                        {selectedModel.paid ? "Bezahlt" : "Kostenlos"}
                      </span>
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {selectedModel.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{selectedModel.description}</p>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${showModelPicker ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showModelPicker && (
                  <div className="absolute z-40 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-80 overflow-y-auto">
                    <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Kostenlos</span>
                    </div>
                    {AI_MODELS.filter((m) => !m.paid).map((model) => (
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
                        {selectedModelId === model.id && <span className="text-xs text-blue-600 font-medium">Ausgewählt</span>}
                      </button>
                    ))}
                    <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 border-t border-gray-200">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Bezahlt (bessere Qualität)</span>
                    </div>
                    {AI_MODELS.filter((m) => m.paid).map((model) => (
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
                        {selectedModelId === model.id && <span className="text-xs text-blue-600 font-medium">Ausgewählt</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                 {isPlanMode && !planResult?.ready ? (
                   <>
                     <button
                       onClick={runPlan}
                       disabled={isRunning}
                       className="flex-1 bg-slate-800 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                     >
                       {isRunning ? "Analysiere..." : planMessages.length > 0 ? "Antworten" : "Planen"}
                     </button>
                     {planMessages.length > 0 && (
                       <button
                         onClick={() => {
                           setPlanResult(prev => prev ? { ...prev, ready: true } : null);
                           setTimeout(() => generate(), 0);
                         }}
                         disabled={isRunning}
                         className="shrink-0 bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                         title="Rückfragen überspringen und direkt generieren"
                       >
                         Start
                       </button>
                     )}
                   </>
                 ) : (
                   <button
                     onClick={generate}
                     disabled={isRunning}
                     className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                   >
                     {isRunning ? "Generiert..." : isEditMode ? "Anpassen" : "Generieren"}
                   </button>
                 )}
              </div>

              {statusMessage && (
                <p className={`text-xs ${status === "error" ? "text-red-600" : "text-blue-600"}`}>
                  {statusMessage}
                </p>
              )}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <p>Tipp: Ctrl+Enter zum Starten</p>
                {cost && (
                  <p className="flex items-center gap-1 font-medium text-slate-500" title={`In: ${cost.inputTokens} | Out: ${cost.outputTokens}`}>
                    <span className="text-slate-400">💰</span> ~{cost.formatted}
                  </p>
                )}
              </div>
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

              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Link laden</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={resourceUrl}
                    onChange={(e) => setResourceUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") loadDriveResource(); }}
                    placeholder="https://... (beliebige URL oder Google Drive)"
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={loadDriveResource}
                    disabled={!resourceUrl.trim() || loadingResource}
                    className="shrink-0 bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loadingResource ? "..." : "Laden"}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Webseiten, Artikel, Google Docs/Sheets, Drive-Dateien</p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Datei hochladen</p>
                <div
                  ref={dropZoneRef}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg px-4 py-5 text-center cursor-pointer transition-colors ${
                    isDragging ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {loadingResource ? (
                    <p className="text-xs text-blue-600">Wird verarbeitet...</p>
                  ) : (
                    <>
                      <p className="text-xs font-medium text-gray-600">Datei hierher ziehen</p>
                      <p className="text-xs text-gray-400 mt-0.5">oder klicken zum Auswählen</p>
                      <p className="text-xs text-gray-300 mt-1">PDF, DOCX, TXT, MD, CSV, JSON</p>
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

              {resources.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-500">Geladen</p>
                  {resources.map((r, i) => {
                    const hasWarning = !!r.warning;
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-2 px-3 py-2 border rounded-lg ${
                          hasWarning ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"
                        }`}
                      >
                        <span className={`text-xs shrink-0 mt-0.5 ${hasWarning ? "text-amber-500" : "text-green-600"}`}>
                          {hasWarning ? "⚠" : "✓"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs font-medium truncate block ${hasWarning ? "text-amber-800" : "text-green-800"}`}>
                            {r.name}
                          </span>
                          {hasWarning && (
                            <span className="text-xs text-amber-600 block mt-0.5 leading-snug">{r.warning}</span>
                          )}
                        </div>
                        <span className={`text-xs shrink-0 ${hasWarning ? "text-amber-500" : "text-green-500"}`}>
                          {(Math.round(r.content.length / 100) / 10).toFixed(1)}k
                        </span>
                        <button
                          type="button"
                          onClick={() => removeResource(i)}
                          className={`text-xs shrink-0 transition-colors ml-1 ${hasWarning ? "text-amber-400 hover:text-red-500" : "text-green-400 hover:text-red-500"}`}
                          title="Entfernen"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
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
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={downloadPDF}
                    disabled={isRunning}
                    className="w-full bg-gray-900 text-white py-2 px-2 rounded-lg text-xs font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Raw PDF (Markdown)
                  </button>
                  <button
                    onClick={generateStyledPdf}
                    disabled={isRunning}
                    className="w-full bg-indigo-600 text-white py-2 px-2 rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Design PDF (AI)
                  </button>
                </div>
                {generatedHtml && viewMode === "html" && (
                  <button
                    onClick={downloadHtmlAsPdf}
                    disabled={isRunning}
                    className="w-full bg-indigo-900 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
                  >
                    Design PDF herunterladen
                  </button>
                )}
                <button
                  onClick={() => { setIsEditMode(true); setPrompt(""); }}
                  disabled={isRunning}
                  className="w-full mt-2 bg-blue-50 text-blue-700 border border-blue-200 py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Dokument bearbeiten
                </button>
                {result.title && (
                  <p className="pt-1 text-xs text-gray-400">{result.title}</p>
                )}
              </div>
            )}
          </div>

          {/* Right panel: Markdown/HTML Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
              <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <h2 className="text-sm font-semibold text-gray-700">Vorschau</h2>
                  {result !== null && !isRunning && (
                    <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                      <button
                        onClick={() => setViewMode("markdown")}
                        className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${viewMode === "markdown" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
                      >
                        Inhalt
                      </button>
                      <button
                        onClick={() => setViewMode("html")}
                        disabled={!generatedHtml}
                        className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${viewMode === "html" ? "bg-white shadow text-indigo-700" : "text-gray-500 hover:text-gray-700 disabled:opacity-50"}`}
                      >
                        Design
                      </button>
                    </div>
                  )}
                </div>
                
                {isRunning && (
                  <span className="flex items-center gap-1.5 text-xs text-blue-600">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                    Generiert live...
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-hidden relative">
                {viewMode === "html" && generatedHtml ? (
                  <iframe
                    srcDoc={generatedHtml}
                    className="w-full h-full border-0 bg-white"
                    title="PDF Design Preview"
                  />
                ) : displayMarkdown ? (
                  <div
                    ref={previewRef}
                    id="markdown-preview"
                    className="prose prose-blue max-w-none p-8 overflow-auto h-full"
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {displayMarkdown}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex items-center justify-center text-gray-400 text-sm h-full">
                    <div className="text-center space-y-2">
                      <p className="text-4xl">📄</p>
                      <p>Gib einen Prompt ein und klicke &quot;Generieren&quot;</p>
                      <p className="text-xs text-gray-300">Das Dokument erscheint hier während der Generierung</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <SourcesPanel
        open={showSourcesPanel}
        onClose={() => setShowSourcesPanel(false)}
        onResourcesLoaded={(activeSources) => {
          setResources(prev => {
             const manualResources = prev.filter(r => r.sourceType === "file" || r.sourceType === "web" || !r.sourceType);
             return [...manualResources, ...activeSources];
          });
        }}
      />
    </div>
  );
}
