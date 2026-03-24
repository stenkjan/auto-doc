"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import remarkGfm from "remark-gfm";
import toast from "react-hot-toast";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { MODEL_TIERS, DEFAULT_TIER_ID } from "@/lib/doc-gen/models";
import { BUILTIN_CONTEXTS, DEFAULT_CONTEXT_ID } from "@/lib/doc-gen/context-registry";
import type { Resource } from "@/lib/doc-gen/ai-engine";
import { SourcesPanel } from "./_components/SourcesPanel";
import { FullscreenDocViewer } from "./_components/FullscreenDocViewer";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

interface ContextEntry {
  id: string;
  label: string;
  description: string;
  content?: string;
  custom?: boolean;
}


/* ------------------------------------------------------------------ */
/*  Design Standard Options                                             */
/* ------------------------------------------------------------------ */

const DESIGN_OPTIONS = [
  {
    id: "corporate" as const,
    label: "Corporate (Fluent)",
    desc: "Angebote, Verträge — 11.5px, 20/25mm Ränder",
    previewUrl: "/api/doc-gen/baukoordination",
  },
  {
    id: "data-heavy" as const,
    label: "Data-Heavy (Carbon)",
    desc: "Kostenpläne, Berichte — 10.5px, 14/18mm Ränder",
    previewUrl: "/api/doc-gen/cost-plan",
  },
  {
    id: "editorial" as const,
    label: "Editorial (Butterick)",
    desc: "Konzepte, Freitexte — 12px, 25/30mm Ränder",
    previewUrl: "/api/doc-gen/report",
  },
  {
    id: "custom" as const,
    label: "Eigenes Design",
    desc: "CI aus Referenzdatei extrahieren",
    previewUrl: null,
  },
] as const;

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
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Kontexte verwalten</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Eigene Kontext-Definitionen als .md hinzufügen, bearbeiten oder löschen</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Built-in contexts (read-only display) */}
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Eingebaut (schreibgeschützt)</p>
            <div className="space-y-1.5">
              {BUILTIN_CONTEXTS.map((ctx) => (
                <div key={ctx.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{ctx.label}</span>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{ctx.description}</p>
                  </div>
                  <span className="text-xs text-gray-300 dark:text-gray-600 shrink-0">Eingebaut</span>
                </div>
              ))}
            </div>
          </div>

          {/* Custom contexts */}
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Eigene Kontexte</p>

            {loading ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 py-2">Lädt...</p>
            ) : customContexts.length === 0 && !isCreating ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 py-2">Noch keine eigenen Kontexte vorhanden.</p>
            ) : (
              <div className="space-y-2">
                {customContexts.map((ctx) => (
                  <div key={ctx.id} className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                    {editingId === ctx.id ? (
                      <div className="p-3 space-y-2 bg-blue-50 dark:bg-blue-900/20">
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="Name des Kontexts"
                        />
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={10}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="Markdown-Inhalt des Kontexts..."
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200 transition-colors"
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
                      <div className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-gray-750">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{ctx.label}</span>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{ctx.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => startEdit(ctx)}
                          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 shrink-0 transition-colors"
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteContext(ctx.id, ctx.label)}
                          className="text-xs text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 shrink-0 transition-colors"
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
            <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20 space-y-2">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">Neuer Kontext</p>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Name (z.B. Mietvertrag, Protokoll, ...)"
                autoFocus
              />
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Kurzbeschreibung (optional)"
              />
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder={`Beschreibe dem AI-Assistenten hier seinen Kontext, z.B.:\n\nDu bist ein Assistent für Mietvertragsanalyse...\n\n## Aufgabenbereich\n- ...\n\n## Qualität\n- ...`}
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setIsCreating(false); setNewLabel(""); setNewDescription(""); setNewContent(""); }}
                  className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200 transition-colors"
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
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
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
            className="text-sm px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200 transition-colors"
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
  const [selectedTierId, setSelectedTierId] = useState<string>(DEFAULT_TIER_ID);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [allContexts, setAllContexts] = useState<ContextEntry[]>(BUILTIN_CONTEXTS);
  const [selectedContextId, setSelectedContextId] = useState(DEFAULT_CONTEXT_ID);
  const [showContextPicker, setShowContextPicker] = useState(false);
  const [showContextManager, setShowContextManager] = useState(false);
  const [showSourcesPanel, setShowSourcesPanel] = useState(false);
  
  const [selectedDesignStandard, setSelectedDesignStandard] = useState<"corporate" | "data-heavy" | "editorial" | "custom">("corporate");
  const [showDesignPicker, setShowDesignPicker] = useState(false);
  const [customDesignPrompt, setCustomDesignPrompt] = useState("");

  const [resources, setResources] = useState<(Resource & { warning?: string })[]>([]);
  const [resourceUrl, setResourceUrl] = useState("");
  const [loadingResource, setLoadingResource] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  /* ── Dark Mode ─────────────────────────────────────────────────── */
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("docgen-dark-mode");
    if (stored !== null) {
      setDarkMode(stored === "true");
    } else {
      setDarkMode(window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem("docgen-dark-mode", String(next));
      return next;
    });
  }, []);

  /* ────────────────────────────────────────────────────────────────── */

  const modelPickerRef = useRef<HTMLDivElement>(null);
  const contextPickerRef = useRef<HTMLDivElement>(null);
  const designPickerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const designHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedTier = MODEL_TIERS.find(t => t.tierId === selectedTierId) ?? MODEL_TIERS[1];
  const selectedContext = allContexts.find((c) => c.id === selectedContextId) ?? allContexts[0];

  /* ── Info popover state ─────────────────────────────────────────── */
  const [hoveredDesignInfoId, setHoveredDesignInfoId] = useState<string | null>(null);
  const [pinnedDesignInfoId, setPinnedDesignInfoId] = useState<string | null>(null);
  const activeDesignInfoId = pinnedDesignInfoId ?? hoveredDesignInfoId;

  const [hoveredModelInfoId, setHoveredModelInfoId] = useState<string | null>(null);
  const [pinnedModelInfoId, setPinnedModelInfoId] = useState<string | null>(null);
  const activeModelInfoId = pinnedModelInfoId ?? hoveredModelInfoId;

  const [fullscreenDocUrl, setFullscreenDocUrl] = useState<string | null>(null);

  const clearDesignHideTimer = useCallback(() => {
    if (designHideTimer.current) { clearTimeout(designHideTimer.current); designHideTimer.current = null; }
  }, []);
  const scheduleDesignHide = useCallback(() => {
    clearDesignHideTimer();
    designHideTimer.current = setTimeout(() => setHoveredDesignInfoId(null), 200);
  }, [clearDesignHideTimer]);

  const clearModelHideTimer = useCallback(() => {
    if (modelHideTimer.current) { clearTimeout(modelHideTimer.current); modelHideTimer.current = null; }
  }, []);
  const scheduleModelHide = useCallback(() => {
    clearModelHideTimer();
    modelHideTimer.current = setTimeout(() => setHoveredModelInfoId(null), 200);
  }, [clearModelHideTimer]);

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
      if (designPickerRef.current && !designPickerRef.current.contains(e.target as Node)) {
        setShowDesignPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ── Vercel AI SDK Chat Hook ────────────────────────────────────── */

  const [input, setInput] = useState("");

  const bodyRef = useRef({
    modelId: selectedTier.modelId,
    contextId: selectedContextId,
    resources: resources.length > 0 ? resources : (undefined as Resource[] | undefined),
    designStandard: selectedDesignStandard as string,
    customDesignPrompt: customDesignPrompt || undefined as string | undefined,
  });
  useEffect(() => {
    const tier = MODEL_TIERS.find(t => t.tierId === selectedTierId) ?? MODEL_TIERS[1];
    bodyRef.current = {
      modelId: tier.modelId,
      contextId: selectedContextId,
      resources: resources.length > 0 ? resources : undefined,
      designStandard: selectedDesignStandard,
      customDesignPrompt: selectedDesignStandard === "custom" && customDesignPrompt ? customDesignPrompt : undefined,
    };
  }, [selectedTierId, selectedContextId, resources, selectedDesignStandard, customDesignPrompt]);

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

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const getMessageText = (m: { parts: Array<{ type: string; text?: string }> }) =>
    m.parts.filter(p => p.type === "text").map(p => p.text ?? "").join("");

  const latestAssistantMessage = [...messages].reverse().find(m => m.role === "assistant" && getMessageText(m).length > 0);
  const latestMarkdown = latestAssistantMessage ? getMessageText(latestAssistantMessage) : "";
  const isHtmlDocument = latestMarkdown.includes("<!DOCTYPE html>") || latestMarkdown.includes("<html");

  /* ── Resource loading ─────────────────────────────────────────── */

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
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 600);
  }, [fetchRenderedHTML]);

  /* ── Reset info popovers when dropdowns close ──────────────────── */
  useEffect(() => {
    if (!showDesignPicker) { setPinnedDesignInfoId(null); setHoveredDesignInfoId(null); }
  }, [showDesignPicker]);
  useEffect(() => {
    if (!showModelPicker) { setPinnedModelInfoId(null); setHoveredModelInfoId(null); }
  }, [showModelPicker]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Fullscreen Document Viewer */}
      {fullscreenDocUrl && (
        <FullscreenDocViewer url={fullscreenDocUrl} onClose={() => setFullscreenDocUrl(null)} />
      )}

      {/* Context Manager Modal */}
      {showContextManager && (
        <ContextManagerModal
          onClose={() => setShowContextManager(false)}
          onContextsChanged={refreshContexts}
        />
      )}

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 shrink-0">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
              aria-label={darkMode ? "Zum hellen Modus wechseln" : "Zum dunklen Modus wechseln"}
              title={darkMode ? "Heller Modus" : "Dunkler Modus"}
            >
              {darkMode ? (
                <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Agentic Prompt Machine</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">AI-gestützte iterierende Dokumentenerstellung</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            
            {/* Context Selector mini */}
            <div className="relative text-sm" ref={contextPickerRef}>
              <button
                onClick={() => setShowContextPicker(p => !p)}
                className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <span className="text-gray-500 dark:text-gray-400">Kontext:</span>
                <span className="font-medium text-gray-800 dark:text-gray-100">{selectedContext?.label}</span>
                <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showContextPicker && (
                <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-72 overflow-y-auto">
                   <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700">
                     <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">Kontexte</span>
                     <button onClick={() => setShowContextManager(true)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Verwalten</button>
                   </div>
                   {allContexts.map(c => (
                     <button
                       key={c.id}
                       onClick={() => { setSelectedContextId(c.id); setShowContextPicker(false); }}
                       className={`w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm dark:text-gray-200 ${selectedContextId === c.id ? 'bg-blue-50 dark:bg-blue-900/30 font-medium' : ''}`}
                     >
                       {c.label} {c.custom && <span className="ml-2 text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded">Custom</span>}
                     </button>
                   ))}
                </div>
              )}
            </div>

            {/* Design Standard Picker */}
            <div className="relative text-sm" ref={designPickerRef}>
              <button
                onClick={() => setShowDesignPicker(p => !p)}
                className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <span className="text-gray-500 dark:text-gray-400">Design:</span>
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  {selectedDesignStandard === "corporate" && "Corporate"}
                  {selectedDesignStandard === "data-heavy" && "Data-Heavy"}
                  {selectedDesignStandard === "editorial" && "Editorial"}
                  {selectedDesignStandard === "custom" && "Eigenes"}
                </span>
                <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showDesignPicker && (
                <div className="absolute right-0 top-full mt-1 z-50 w-72">
                  {/* Info box — rendered outside the overflow-hidden panel */}
                  {activeDesignInfoId && (() => {
                    const opt = DESIGN_OPTIONS.find(o => o.id === activeDesignInfoId);
                    if (!opt) return null;
                    return (
                      <div
                        className="absolute right-full top-0 mr-2 z-[70]"
                        style={{ width: 176 }}
                        onMouseEnter={clearDesignHideTimer}
                        onMouseLeave={() => { if (!pinnedDesignInfoId) scheduleDesignHide(); }}
                      >
                        <div
                          className="relative rounded-xl overflow-hidden shadow-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                          style={{ height: 300 }}
                        >
                          {/* X close */}
                          <button
                            type="button"
                            onClick={() => { setPinnedDesignInfoId(null); setHoveredDesignInfoId(null); clearDesignHideTimer(); }}
                            className="absolute top-1.5 right-1.5 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 text-white text-xs leading-none transition-colors"
                            aria-label="Schließen"
                          >×</button>
                          {/* Content */}
                          {opt.previewUrl ? (
                            <div
                              className="w-full h-full cursor-pointer"
                              onClick={() => { if (opt.previewUrl) setFullscreenDocUrl(opt.previewUrl); }}
                              title="Klicken für Vollbild"
                            >
                              <iframe
                                src={opt.previewUrl}
                                className="w-full h-full border-0 pointer-events-none"
                                title={opt.label}
                                sandbox="allow-same-origin allow-scripts"
                                style={{ transform: "scale(0.45)", transformOrigin: "top left", width: "222%", height: "222%" }}
                              />
                            </div>
                          ) : (
                            <div className="p-3 flex items-center justify-center h-full text-xs text-gray-500 dark:text-gray-400 text-center bg-gray-50 dark:bg-gray-700">
                              Eigenes CI wird aus Referenzdatei extrahiert
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Visual panel */}
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                      <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Design-Standard</span>
                    </div>
                    {DESIGN_OPTIONS.map(opt => (
                      <div key={opt.id} className="border-b border-gray-50 dark:border-gray-700 last:border-0">
                        <div className={`flex items-center px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${selectedDesignStandard === opt.id ? "bg-blue-50 dark:bg-blue-900/30" : ""}`}>
                          <button
                            type="button"
                            onClick={() => { setSelectedDesignStandard(opt.id); setShowDesignPicker(false); }}
                            className="flex-1 min-w-0 text-left"
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-sm ${selectedDesignStandard === opt.id ? "font-semibold text-blue-700 dark:text-blue-400" : "text-gray-800 dark:text-gray-200"}`}>{opt.label}</span>
                              {selectedDesignStandard === opt.id && (
                                <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{opt.desc}</p>
                          </button>
                          {/* ⓘ info trigger */}
                          <button
                            type="button"
                            onMouseEnter={() => { clearDesignHideTimer(); setHoveredDesignInfoId(opt.id); }}
                            onMouseLeave={() => { if (!pinnedDesignInfoId) scheduleDesignHide(); }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (pinnedDesignInfoId === opt.id) {
                                setPinnedDesignInfoId(null);
                                setHoveredDesignInfoId(null);
                              } else {
                                setPinnedDesignInfoId(opt.id);
                                setHoveredDesignInfoId(opt.id);
                              }
                            }}
                            className={`ml-2 shrink-0 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold transition-colors
                              ${activeDesignInfoId === opt.id
                                ? "bg-gray-600 text-white"
                                : "bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-400 dark:hover:bg-gray-500 hover:text-white"
                              }`}
                            aria-label="Info"
                          >i</button>
                        </div>
                      </div>
                    ))}
                    {selectedDesignStandard === "custom" && (
                      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                        <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Design-Instruktionen</p>
                        <textarea
                          value={customDesignPrompt}
                          onChange={e => setCustomDesignPrompt(e.target.value)}
                          rows={3}
                          placeholder="z.B. 'Extrahiere die Blautöne und runden Tabellen aus der angehängten PDF'"
                          className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400 resize-none bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
                        />
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Lade eine Referenzdatei als Anhang hoch.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Model Selector mini */}
            <div className="relative text-sm" ref={modelPickerRef}>
              <button
                onClick={() => setShowModelPicker(p => !p)}
                className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <span className="text-gray-500 dark:text-gray-400">Modell:</span>
                <span className="font-medium text-gray-800 dark:text-gray-100">{selectedTier.label}</span>
                <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showModelPicker && (
                <div className="absolute right-0 top-full mt-1 z-50 w-64">
                  {/* Info box — outside overflow-hidden panel */}
                  {activeModelInfoId && (() => {
                    const tier = MODEL_TIERS.find(t => t.tierId === activeModelInfoId);
                    if (!tier) return null;
                    return (
                      <div
                        className="absolute right-full top-0 mr-2 z-[70]"
                        style={{ width: 176 }}
                        onMouseEnter={clearModelHideTimer}
                        onMouseLeave={() => { if (!pinnedModelInfoId) scheduleModelHide(); }}
                      >
                        <div className="relative rounded-xl overflow-hidden shadow-xl border border-gray-300 bg-gray-700">
                          {/* X close */}
                          <button
                            type="button"
                            onClick={() => { setPinnedModelInfoId(null); setHoveredModelInfoId(null); clearModelHideTimer(); }}
                            className="absolute top-1.5 right-1.5 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 text-white text-xs leading-none transition-colors"
                            aria-label="Schließen"
                          >×</button>
                          <div className="p-3 pr-7">
                            <p className="text-[11px] font-bold text-white mb-1">{tier.label}</p>
                            <p className="text-[11px] text-gray-300 leading-relaxed">{tier.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Visual panel */}
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                      <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Modell</span>
                    </div>
                    {MODEL_TIERS.map(tier => (
                      <div key={tier.tierId} className="border-b border-gray-50 dark:border-gray-700 last:border-0">
                        <div className={`flex items-center px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${selectedTierId === tier.tierId ? "bg-blue-50 dark:bg-blue-900/30" : ""}`}>
                          <button
                            type="button"
                            onClick={() => { setSelectedTierId(tier.tierId); setShowModelPicker(false); }}
                            className="flex-1 min-w-0 text-left"
                          >
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium tracking-wide ${selectedTierId === tier.tierId ? "text-blue-700 dark:text-blue-400" : "text-gray-800 dark:text-gray-200"}`}>
                                {tier.label}
                              </span>
                              {selectedTierId === tier.tierId && (
                                <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                              )}
                            </div>
                          </button>
                          {/* ⓘ info trigger */}
                          <button
                            type="button"
                            onMouseEnter={() => { clearModelHideTimer(); setHoveredModelInfoId(tier.tierId); }}
                            onMouseLeave={() => { if (!pinnedModelInfoId) scheduleModelHide(); }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (pinnedModelInfoId === tier.tierId) {
                                setPinnedModelInfoId(null);
                                setHoveredModelInfoId(null);
                              } else {
                                setPinnedModelInfoId(tier.tierId);
                                setHoveredModelInfoId(tier.tierId);
                              }
                            }}
                            className={`ml-2 shrink-0 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold transition-colors
                              ${activeModelInfoId === tier.tierId
                                ? "bg-gray-600 text-white"
                                : "bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-400 dark:hover:bg-gray-500 hover:text-white"
                              }`}
                            aria-label="Info"
                          >i</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowSourcesPanel(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-200 dark:border-indigo-800"
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
          className={`w-[450px] shrink-0 bg-white dark:bg-gray-800 rounded-xl border shadow-sm flex flex-col overflow-hidden relative transition-colors ${isDragOver ? "border-blue-400 ring-2 ring-blue-300 bg-blue-50/20" : "border-gray-200 dark:border-gray-700"}`}
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
          <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 flex justify-between items-center">
            <span>Agent Chat</span>
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded-full">{isLoading ? 'Denkt nach...' : 'Bereit'}</span>
          </div>

          {/* Resources Mini-Panel */}
          {resources.length > 0 && (
            <div className="px-3 py-2 bg-blue-50/50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/40 max-h-32 overflow-y-auto">
              <span className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1 block">Angehängte Dateien:</span>
              <div className="flex flex-wrap gap-1.5">
                {resources.map((r, i) => (
                  <div key={i} className="flex items-center gap-1 text-xs bg-white dark:bg-gray-700 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 px-2 py-1 rounded">
                    <span className="truncate max-w-[150px]">{r.name}</span>
                    <button onClick={() => setResources(prev => prev.filter((_, idx) => idx !== i))} className="text-blue-400 hover:text-red-500 dark:hover:text-red-400">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 dark:text-gray-500 text-sm mt-10">
                <p className="text-4xl mb-3">💬</p>
                <p>Starte die Konversation.</p>
                <p className="text-xs mt-1">Du kannst URLs in den Chat posten, der Agent kann diese lesen.</p>
              </div>
            ) : (
              messages.map(m => (
                <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {m.role === 'assistant' && (
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 ml-1">AI Assistant</span>
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
                        <div className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-2xl rounded-tl-sm px-4 py-2 max-w-[95%] text-sm shadow-sm font-mono text-[10px] overflow-hidden whitespace-pre-wrap">
                          {text.length > 150 ? text.substring(0, 150) + "...\n\n[HTML Dokument im rechten Panel]" : text}
                        </div>
                      );
                    }
                    return (
                      <div className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-2xl rounded-tl-sm px-4 py-2 max-w-[95%] text-sm shadow-sm prose prose-sm prose-blue dark:prose-invert">
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
                      <div key={toolCallId} className="mt-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/60 border border-gray-100 dark:border-gray-700 rounded-lg p-2 max-w-[95%] w-full flex flex-col gap-1">
                        <div className="flex items-center gap-2 font-medium">
                          {toolName === 'fetchWebPage' && <span>🌐 Rufe URL ab...</span>}
                          {toolName === 'fetchDriveFile' && <span>📁 Lade Drive Datei...</span>}
                          {toolName === 'fetchGithubRepo' && <span>🐙 Lese GitHub Repo...</span>}
                          {toolName === 'saveToMemory' && <span>💾 Speichere ins Gedächtnis...</span>}
                          {toolName === 'loadFromMemory' && <span>🧠 Lade aus Gedächtnis...</span>}
                          
                          {toolPart.state === 'output-available' ? (
                             <span className="text-green-600 dark:text-green-400 ml-auto">✓ Fertig</span>
                          ) : (
                             <span className="text-blue-600 dark:text-blue-400 animate-pulse ml-auto">Lädt...</span>
                          )}
                        </div>
                        
                        <div className="font-mono text-[10px] text-gray-400 dark:text-gray-500 truncate opacity-70">
                          {JSON.stringify(toolPart.input)}
                        </div>

                        {toolPart.state === 'output-available' && (
                          <div className="font-mono text-[10px] text-gray-400 dark:text-gray-500 truncate mt-1 pt-1 border-t border-gray-100 dark:border-gray-600">
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
               <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 p-3 rounded-xl text-sm">
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
                className="flex-1 text-xs px-2 py-1.5 focus:outline-none border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
             />
             <button
               onClick={loadDriveResource}
               disabled={!resourceUrl || loadingResource}
               className="text-xs bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 font-medium px-3 py-1.5 rounded disabled:opacity-50"
             >
               {loadingResource ? 'Lädt...' : 'Anhängen'}
             </button>
             <button
                onClick={() => document.getElementById('file-upload')?.click()}
                className="text-xs bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 font-medium px-3 py-1.5 rounded"
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
          <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
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
                className="w-full h-24 pl-3 pr-12 py-3 border border-gray-300 dark:border-gray-600 focus:border-blue-500 rounded-xl text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm disabled:opacity-50 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 bottom-3 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:bg-gray-300 dark:disabled:bg-gray-600 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT: Live Preview */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col min-w-0">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <span>📄</span> Live Vorschau
              {isLoading && <span className="flex w-2 h-2 rounded-full bg-blue-500 animate-pulse ml-2"></span>}
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={printDocument} className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 font-medium text-gray-700 dark:text-gray-200">
                Drucken (Browser)
              </button>
              <button onClick={downloadPDF} className="text-xs px-3 py-1.5 bg-gray-900 dark:bg-gray-600 text-white rounded hover:bg-gray-800 dark:hover:bg-gray-500 font-medium flex items-center gap-1.5">
                PDF Export
              </button>
            </div>
          </div>
          
          <div className={`flex-1 overflow-auto bg-gray-100/30 dark:bg-gray-900/40 relative ${isHtmlDocument ? "" : "p-8"}`}>
            <div className={`mx-auto bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 print:p-0 print:border-0 print:shadow-none print:bg-transparent ${isHtmlDocument ? "w-full h-full max-w-none border-0" : "max-w-4xl p-10 min-h-full"}`}>
              {latestMarkdown ? (
                isHtmlDocument ? (
                  <iframe 
                    ref={previewRef as React.RefObject<HTMLIFrameElement>}
                    srcDoc={latestMarkdown} 
                    className="w-full h-full min-h-[800px] border-0 bg-transparent"
                    title="HTML Preview"
                    sandbox="allow-scripts allow-same-origin"
                  />
                ) : (
                  <div ref={previewRef} className="prose prose-blue max-w-none text-slate-800 dark:text-slate-200 break-words dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {latestMarkdown}
                    </ReactMarkdown>
                  </div>
                )
              ) : (
                <div className="text-center text-gray-300 dark:text-gray-600 mt-20 flex flex-col items-center">
                  <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="font-medium text-gray-400 dark:text-gray-500">Das generierte Dokument erscheint hier</p>
                  <p className="text-sm mt-1 dark:text-gray-600">Starte eine Unterhaltung im Agent Chat auf der linken Seite.</p>
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
