"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import remarkGfm from "remark-gfm";
import toast from "react-hot-toast";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { AI_MODELS, DEFAULT_MODEL_ID } from "@/lib/doc-gen/models";
import { BUILTIN_CONTEXTS, DEFAULT_CONTEXT_ID } from "@/lib/doc-gen/context-registry";
import type { Resource } from "@/lib/doc-gen/ai-engine";
import { SourcesPanel } from "./_components/SourcesPanel";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

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
/*  Context Manager Modal (unchanged from previous)                   */
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
/*  Main Page - Agentic Chat UI                                         */
/* ------------------------------------------------------------------ */

export default function DocGenPage() {
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [allContexts, setAllContexts] = useState<ContextEntry[]>(BUILTIN_CONTEXTS);
  const [selectedContextId, setSelectedContextId] = useState(DEFAULT_CONTEXT_ID);
  const [showContextPicker, setShowContextPicker] = useState(false);
  const [showContextManager, setShowContextManager] = useState(false);
  const [showSourcesPanel, setShowSourcesPanel] = useState(false);
  
  const [selectedDesignStandard, setSelectedDesignStandard] = useState<"corporate" | "data-heavy" | "editorial" | "custom">("corporate");
  const [customDesignPrompt, setCustomDesignPrompt] = useState("");

  const [resources, setResources] = useState<(Resource & { warning?: string })[]>([]);
  const [resourceUrl, setResourceUrl] = useState("");
  const [loadingResource, setLoadingResource] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const modelPickerRef = useRef<HTMLDivElement>(null);
  const contextPickerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  /* ── Vercel AI SDK Chat Hook ────────────────────────────────────── */

  // Local input state (useChat v6 no longer manages input)
  const [input, setInput] = useState("");

  // Refs hold the latest dynamic values so the stable transport can read them
  const bodyRef = useRef({
    modelId: selectedModelId,
    contextId: selectedContextId,
    resources: resources.length > 0 ? resources : (undefined as Resource[] | undefined),
    designStandard: selectedDesignStandard as string,
    customDesignPrompt: customDesignPrompt || undefined as string | undefined,
  });
  useEffect(() => {
    bodyRef.current = {
      modelId: selectedModelId,
      contextId: selectedContextId,
      resources: resources.length > 0 ? resources : undefined,
      designStandard: selectedDesignStandard,
      customDesignPrompt: selectedDesignStandard === "custom" && customDesignPrompt ? customDesignPrompt : undefined,
    };
  }, [selectedModelId, selectedContextId, resources, selectedDesignStandard, customDesignPrompt]);

  // Create the transport once so the chat state survives re-renders
  const transportRef = useRef(
    new TextStreamChatTransport({
      api: "/api/doc-gen/stream",
      body: () => bodyRef.current,
    })
  );

  const { messages, sendMessage, status, error } = useChat({
    transport: transportRef.current,
    onError: (err: Error) => {
      toast.error(err.message || "Fehler bei der Generierung");
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Extract the latest markdown from assistant messages for the preview panel
  const getMessageText = (m: { parts: Array<{ type: string; text?: string }> }) =>
    m.parts.filter(p => p.type === "text").map(p => p.text ?? "").join("");

  const latestAssistantMessage = [...messages].reverse().find(m => m.role === "assistant" && getMessageText(m).length > 0);
  const latestMarkdown = latestAssistantMessage ? getMessageText(latestAssistantMessage) : "";
  const isHtmlDocument = latestMarkdown.includes("<!DOCTYPE html>") || latestMarkdown.includes("<html");

  /* ── Resource loading ─────────────────────────────────────────── */

  /** Upload a single File object to /api/doc-gen/fetch-resource and append to resources */
  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/doc-gen/fetch-resource", { method: "POST", body: formData });
      const json = await res.json();
      if (res.ok) {
        setResources((p) => [...p, json]);
        if (json.warning) toast.error(`"${json.name}" geladen – mit Warnung`);
        else toast.success(`"${json.name}" angehängt`);
      } else {
        toast.error(json.error || "Upload fehlgeschlagen");
      }
    } catch {
      toast.error("Upload fehlgeschlagen");
    }
  }, []);

  /** Handle drag-and-drop onto the chat panel */
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    setLoadingResource(true);
    for (const file of files) await uploadFile(file);
    setLoadingResource(false);
  }, [uploadFile]);

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

  /* ── PDF Export ───────────────────────────────────────────────── */

  /** Fetch the server-rendered styled A4 HTML for the current markdown */
  const fetchRenderedHTML = useCallback(async (): Promise<string | null> => {
    if (!latestMarkdown) {
      toast.error("Kein Dokument vorhanden.");
      return null;
    }
    const isHtml = latestMarkdown.includes("<!DOCTYPE html>") || latestMarkdown.includes("<html");
    if (isHtml) return latestMarkdown;

    const res = await fetch("/api/doc-gen/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: latestMarkdown }),
    });
    if (!res.ok) {
      toast.error("Render-Fehler: " + res.statusText);
      return null;
    }
    return res.text();
  }, [latestMarkdown]);

  const downloadPDF = useCallback(async () => {
    try {
      toast.success("PDF wird generiert...");
      const html = await fetchRenderedHTML();
      if (!html) return;

      const html2pdf = (await import("html2pdf.js")).default;
      const filename = `Dokument-${Date.now()}.pdf`;

      // Parse the server-rendered HTML into a DOM element for html2pdf
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const element = (doc.querySelector(".page-wrapper") as HTMLElement) ?? doc.body;

      await html2pdf()
        .set({
          margin: 0,
          filename,
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(element)
        .save();

      toast.success("PDF erfolgreich gespeichert");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF-Erzeugung fehlgeschlagen");
    }
  }, [fetchRenderedHTML]);

  const printDocument = useCallback(async () => {
    const html = await fetchRenderedHTML();
    if (!html) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup-Blocker verhindert das Drucken.");
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    // Allow Geist font + styles to load before triggering print dialog
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 600);
  }, [fetchRenderedHTML]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Context Manager Modal */}
      {showContextManager && (
        <ContextManagerModal
          onClose={() => setShowContextManager(false)}
          onContextsChanged={refreshContexts}
        />
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 shrink-0">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Agentic Prompt Machine</h1>
            <p className="text-sm text-gray-500">AI-gestützte iterierende Dokumentenerstellung</p>
          </div>
          <div className="flex items-center gap-6">
            
            {/* Context Selector mini */}
            <div className="relative text-sm" ref={contextPickerRef}>
              <button
                onClick={() => setShowContextPicker(p => !p)}
                className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="text-gray-500">Kontext:</span>
                <span className="font-medium text-gray-800">{selectedContext?.label}</span>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showContextPicker && (
                <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">
                   <div className="px-3 py-2 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                     <span className="text-xs font-semibold text-gray-400 uppercase">Kontexte</span>
                     <button onClick={() => setShowContextManager(true)} className="text-xs text-blue-600 hover:underline">Verwalten</button>
                   </div>
                   {allContexts.map(c => (
                     <button
                       key={c.id}
                       onClick={() => { setSelectedContextId(c.id); setShowContextPicker(false); }}
                       className={`w-full text-left px-4 py-2 hover:bg-gray-50 text-sm ${selectedContextId === c.id ? 'bg-blue-50 font-medium' : ''}`}
                     >
                       {c.label} {c.custom && <span className="ml-2 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Custom</span>}
                     </button>
                   ))}
                </div>
              )}
            </div>

            {/* Design Standard Picker */}
            <div className="relative text-sm">
              <div className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg bg-gray-50">
                <span className="text-gray-500 whitespace-nowrap">Design:</span>
                <select
                  value={selectedDesignStandard}
                  onChange={e => setSelectedDesignStandard(e.target.value as "corporate" | "data-heavy" | "editorial" | "custom")}
                  className="font-medium text-gray-800 bg-transparent border-none outline-none cursor-pointer pr-1"
                >
                  <option value="corporate">Corporate (Fluent)</option>
                  <option value="data-heavy">Data-Heavy (Carbon)</option>
                  <option value="editorial">Editorial (Butterick)</option>
                  <option value="custom">Eigenes Design</option>
                </select>
              </div>
              {selectedDesignStandard === "custom" && (
                <div className="absolute right-0 top-full mt-1 z-50 w-80 bg-white border border-gray-200 rounded-xl shadow-lg p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Design-Instruktionen</p>
                  <textarea
                    value={customDesignPrompt}
                    onChange={e => setCustomDesignPrompt(e.target.value)}
                    rows={4}
                    placeholder="Was genau soll ich aus der angehängten Datei übernehmen? (z.B. 'Extrahiere die Blautöne, die runde Tabellenform und die dicken Überschriften aus der angehängten PDF')"
                    className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400 resize-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Lade eine Referenzdatei als Anhang hoch, damit der Agent das Design extrahieren kann.</p>
                </div>
              )}
            </div>

            {/* Model Selector mini */}
            <div className="relative text-sm" ref={modelPickerRef}>
              <button
                onClick={() => setShowModelPicker(p => !p)}
                className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="text-gray-500">Modell:</span>
                <span className="font-medium text-gray-800">{selectedModel.label}</span>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showModelPicker && (
                <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">
                   {AI_MODELS.map(m => (
                     <button
                       key={m.id}
                       onClick={() => { setSelectedModelId(m.id); setShowModelPicker(false); }}
                       className={`w-full text-left px-4 py-2 hover:bg-gray-50 text-sm ${selectedModelId === m.id ? 'bg-blue-50 font-medium' : ''}`}
                     >
                       <div className="flex justify-between items-center">
                         <span>{m.label}</span>
                         <span className={`text-[10px] px-1.5 py-0.5 rounded ${m.paid ? PAID_BADGE : FREE_BADGE}`}>{m.paid ? 'Paid' : 'Free'}</span>
                       </div>
                     </button>
                   ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowSourcesPanel(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors border border-indigo-200"
            >
              <span>⚡</span> Externe Quellen
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Interface */}
      <div className="flex-1 flex overflow-hidden max-w-[1600px] w-full mx-auto p-4 gap-4">
        
        {/* LEFT: Agentic Chat */}
        <div
          className={`w-[450px] shrink-0 bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden relative transition-colors ${isDragOver ? "border-blue-400 ring-2 ring-blue-300 bg-blue-50/20" : "border-gray-200"}`}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
          onDrop={handleDrop}
        >
          {/* Drag overlay */}
          {isDragOver && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-blue-50/90 rounded-xl border-2 border-dashed border-blue-400 pointer-events-none gap-2">
              <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-blue-600 font-semibold text-sm">Datei hier ablegen</p>
              <p className="text-blue-400 text-xs">PDF, DOCX, TXT, MD, CSV, JSON</p>
            </div>
          )}
          <div className="p-3 border-b border-gray-100 bg-gray-50 text-sm font-semibold text-gray-700 flex justify-between items-center">
            <span>Agent Chat</span>
            <span className="text-xs font-normal text-gray-500 px-2 py-0.5 bg-gray-200 rounded-full">{isLoading ? 'Denkt nach...' : 'Bereit'}</span>
          </div>

          {/* Resources Mini-Panel */}
          {resources.length > 0 && (
            <div className="px-3 py-2 bg-blue-50/50 border-b border-blue-100 max-h-32 overflow-y-auto">
              <span className="text-xs font-medium text-blue-800 mb-1 block">Angehängte Dateien:</span>
              <div className="flex flex-wrap gap-1.5">
                {resources.map((r, i) => (
                  <div key={i} className="flex items-center gap-1 text-xs bg-white border border-blue-200 text-blue-700 px-2 py-1 rounded">
                    <span className="truncate max-w-[150px]">{r.name}</span>
                    <button onClick={() => setResources(prev => prev.filter((_, idx) => idx !== i))} className="text-blue-400 hover:text-red-500">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 text-sm mt-10">
                <p className="text-4xl mb-3">💬</p>
                <p>Starte die Konversation.</p>
                <p className="text-xs mt-1">Du kannst URLs in den Chat posten, der Agent kann diese lesen.</p>
              </div>
            ) : (
              messages.map(m => (
                <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {m.role === 'assistant' && (
                    <span className="text-xs font-medium text-blue-600 mb-1 ml-1">AI Assistant</span>
                  )}
                  
                  {/* Text Content */}
                  {m.role === 'user' && getMessageText(m) && (
                    <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2 max-w-[85%] text-sm shadow-sm whitespace-pre-wrap">
                      {getMessageText(m)}
                    </div>
                  )}

                  {/* Assistant response */}
                  {m.role === 'assistant' && getMessageText(m) && (() => {
                    const text = getMessageText(m);
                    const isHtml = text.includes("<!DOCTYPE html>") || text.includes("<html");
                    if (isHtml) {
                      return (
                        <div className="bg-gray-100 text-gray-800 rounded-2xl rounded-tl-sm px-4 py-2 max-w-[95%] text-sm shadow-sm font-mono text-[10px] overflow-hidden whitespace-pre-wrap">
                          {text.length > 150 ? text.substring(0, 150) + "...\n\n[HTML Dokument im rechten Panel]" : text}
                        </div>
                      );
                    }
                    return (
                      <div className="bg-gray-100 text-gray-800 rounded-2xl rounded-tl-sm px-4 py-2 max-w-[95%] text-sm shadow-sm prose prose-sm prose-blue">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {text.length > 300 && m === messages[messages.length-1] 
                            ? text.substring(0, 300) + "...\n\n_(Gesamtes Dokument im rechten Panel)_"
                            : text}
                        </ReactMarkdown>
                      </div>
                    );
                  })()}

                  {/* Tool Call Indicators */}
                  {m.parts.filter(p => p.type === 'dynamic-tool' || p.type.startsWith('tool-')).map((part) => {
                    const toolPart = part as { type: string; toolCallId: string; toolName?: string; state: string; input?: unknown; output?: unknown };
                    const toolCallId = toolPart.toolCallId;
                    const toolName = toolPart.toolName ?? toolPart.type.replace(/^tool-/, '');
                    
                    return (
                      <div key={toolCallId} className="mt-2 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-2 max-w-[95%] w-full flex flex-col gap-1">
                        <div className="flex items-center gap-2 font-medium">
                          {toolName === 'fetchWebPage' && <span>🌐 Rufe URL ab...</span>}
                          {toolName === 'fetchDriveFile' && <span>📁 Lade Drive Datei...</span>}
                          {toolName === 'fetchGithubRepo' && <span>🐙 Lese GitHub Repo...</span>}
                          {toolName === 'saveToMemory' && <span>💾 Speichere ins Gedächtnis...</span>}
                          {toolName === 'loadFromMemory' && <span>🧠 Lade aus Gedächtnis...</span>}
                          
                          {toolPart.state === 'output-available' ? (
                             <span className="text-green-600 ml-auto">✓ Fertig</span>
                          ) : (
                             <span className="text-blue-600 animate-pulse ml-auto">Lädt...</span>
                          )}
                        </div>
                        
                        <div className="font-mono text-[10px] text-gray-400 truncate opacity-70">
                          {JSON.stringify(toolPart.input)}
                        </div>

                        {toolPart.state === 'output-available' && (
                          <div className="font-mono text-[10px] text-gray-400 truncate mt-1 pt-1 border-t border-gray-100">
                            Result: {JSON.stringify(toolPart.output).substring(0, 100)}...
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
            
            {error && (
               <div className="bg-red-50 text-red-600 border border-red-200 p-3 rounded-xl text-sm">
                 Fehler: {error.message}
               </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          <div className="px-3 pb-2 flex gap-2">
             <input
                type="text"
                placeholder="URL hier laden..."
                value={resourceUrl}
                onChange={e => setResourceUrl(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") loadDriveResource(); }}
                className="flex-1 text-xs px-2 py-1.5 focus:outline-none border border-gray-200 rounded bg-gray-50"
             />
             <button
               onClick={loadDriveResource}
               disabled={!resourceUrl || loadingResource}
               className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium px-3 py-1.5 rounded disabled:opacity-50"
             >
               {loadingResource ? 'Lädt...' : 'Anhängen'}
             </button>
             <button
                onClick={() => document.getElementById('file-upload')?.click()}
                className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium px-3 py-1.5 rounded"
             >
               + Datei
             </button>
             <input id="file-upload" type="file" className="hidden" multiple onChange={async (e) => {
                const files = e.target.files;
                if (!files) return;
                setLoadingResource(true);
                for (let i = 0; i < files.length; i++) await uploadFile(files[i]);
                setLoadingResource(false);
                e.target.value = "";
             }} />
          </div>

          {/* Chat Input */}
          <div className="p-3 bg-white border-t border-gray-200">
            <form onSubmit={(e) => {
              e.preventDefault();
              if (input.trim() && !isLoading) {
                sendMessage({ text: input.trim() });
                setInput("");
              }
            }} className="relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim() && !isLoading) {
                      sendMessage({ text: input.trim() });
                      setInput("");
                    }
                  }
                }}
                placeholder={isLoading ? "Agent arbeitet..." : "Beschreibe das Dokument oder frage den Agenten... (Shift+Enter für neue Zeile)"}
                disabled={isLoading}
                className="w-full h-24 pl-3 pr-12 py-3 border border-gray-300 focus:border-blue-500 rounded-xl text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 bottom-3 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:bg-gray-300 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT: Live Preview */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col min-w-0">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <span>📄</span> Live Vorschau
              {isLoading && <span className="flex w-2 h-2 rounded-full bg-blue-500 animate-pulse ml-2"></span>}
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={printDocument} className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 font-medium text-gray-700">
                Drucken (Browser)
              </button>
              <button onClick={downloadPDF} className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-800 font-medium flex items-center gap-1.5">
                PDF Export
              </button>
            </div>
          </div>
          
          <div className={`flex-1 overflow-auto bg-gray-100/30 relative ${isHtmlDocument ? "" : "p-8"}`}>
            <div className={`mx-auto bg-white shadow-sm border border-gray-200 print:p-0 print:border-0 print:shadow-none print:bg-transparent ${isHtmlDocument ? "w-full h-full max-w-none border-0" : "max-w-4xl p-10 min-h-full"}`}>
              {latestMarkdown ? (
                isHtmlDocument ? (
                  <iframe 
                    ref={previewRef as any}
                    srcDoc={latestMarkdown} 
                    className="w-full h-full min-h-[800px] border-0 bg-transparent"
                    title="HTML Preview"
                    sandbox="allow-scripts allow-same-origin"
                  />
                ) : (
                  <div ref={previewRef} className="prose prose-blue max-w-none text-slate-800 break-words dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {latestMarkdown}
                    </ReactMarkdown>
                  </div>
                )
              ) : (
                <div className="text-center text-gray-300 mt-20 flex flex-col items-center">
                  <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="font-medium text-gray-400">Das generierte Dokument erscheint hier</p>
                  <p className="text-sm mt-1">Starte eine Unterhaltung im Agent Chat auf der linken Seite.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sources Panel hidden modal */}
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
