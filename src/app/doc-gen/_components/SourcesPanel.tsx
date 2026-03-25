"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import type { Resource } from "@/lib/doc-gen/ai-engine";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export type SourceType = "github" | "mcp" | "drive";

export interface SourceRecord {
  id: string;
  type: SourceType;
  label: string;
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
}

interface SourcesPanelProps {
  open: boolean;
  onClose: () => void;
  /** Called when source resources should be fetched and added to context */
  onResourcesLoaded: (resources: Resource[]) => void;
}

/* ------------------------------------------------------------------ */
/*  Icons                                                               */
/* ------------------------------------------------------------------ */

const GithubIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

const McpIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const DriveIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6.28 3L1 12.31 4.36 18h15.28L23 12.31 17.72 3H6.28zm-.84 13.5L2.8 12.31 7.13 4.5h9.74l4.33 7.81-2.64 4.69H5.44zM8.5 13l3.5-6 3.5 6H8.5z" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

type AddSourceType = SourceType | null;

/* ------------------------------------------------------------------ */
/*  Add Source Form                                                     */
/* ------------------------------------------------------------------ */

function AddSourceForm({
  type,
  onCancel,
  onSaved,
}: {
  type: SourceType;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  // GitHub fields
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [path, setPath] = useState("");
  const [token, setToken] = useState("");

  // MCP fields
  const [serverUrl, setServerUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  // Drive fields
  const [folderUrl, setFolderUrl] = useState("");

  const save = async () => {
    if (!label.trim()) {
      toast.error("Bitte einen Namen eingeben");
      return;
    }

    let config: Record<string, unknown> = {};
    if (type === "github") {
      if (!repoUrl.trim()) { toast.error("Repository URL fehlt"); return; }
      config = { repoUrl, branch: branch || "main", path: path || undefined, token: token || undefined };
    } else if (type === "mcp") {
      if (!serverUrl.trim()) { toast.error("Server URL fehlt"); return; }
      config = { serverUrl, apiKey: apiKey || undefined };
    } else if (type === "drive") {
      if (!folderUrl.trim()) { toast.error("Ordner URL fehlt"); return; }
      config = { folderUrl };
    }

    setSaving(true);
    try {
      const res = await fetch("/api/doc-gen/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, label, config }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? "Fehler beim Speichern");
      }
      toast.success(`"${label}" hinzugefügt`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="border border-blue-200 rounded-xl bg-blue-50 p-4 space-y-3">
      <input type="text" value={label} onChange={(e) => setLabel(e.target.value)}
        placeholder="Name (z.B. Mein Repo, Intranet-MCP...)"
        className={inputCls} autoFocus />

      {type === "github" && (
        <>
          <input type="text" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo" className={inputCls} />
          <div className="grid grid-cols-2 gap-2">
            <input type="text" value={branch} onChange={(e) => setBranch(e.target.value)}
              placeholder="Branch (z.B. main)" className={inputCls} />
            <input type="text" value={path} onChange={(e) => setPath(e.target.value)}
              placeholder="Pfad (optional, z.B. src/)" className={inputCls} />
          </div>
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)}
            placeholder="Personal Access Token (privates Repo)" className={inputCls} />
        </>
      )}

      {type === "mcp" && (
        <>
          <input type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)}
            placeholder="http://localhost:3001 oder https://mcp.example.com" className={inputCls} />
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
            placeholder="API-Key (optional)" className={inputCls} />
        </>
      )}

      {type === "drive" && (
        <input type="text" value={folderUrl} onChange={(e) => setFolderUrl(e.target.value)}
          placeholder="Google Drive Ordner URL" className={inputCls} />
      )}

      <div className="flex gap-2 justify-end pt-1">
        <button type="button" onClick={onCancel}
          className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          Abbrechen
        </button>
        <button type="button" onClick={save} disabled={saving}
          className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? "Speichert..." : "Speichern"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Source Card                                                         */
/* ------------------------------------------------------------------ */

function SourceCard({
  source,
  onToggle,
  onFetch,
  onDelete,
  fetching,
}: {
  source: SourceRecord;
  onToggle: (id: string, enabled: boolean) => void;
  onFetch: (id: string) => void;
  onDelete: (id: string, label: string) => void;
  fetching: boolean;
}) {
  const typeLabel = { github: "GitHub", mcp: "MCP", drive: "Drive" }[source.type];
  const TypeIcon = source.type === "github" ? GithubIcon : source.type === "mcp" ? McpIcon : DriveIcon;
  const typeBg = {
    github: "bg-gray-900 text-white",
    mcp: "bg-violet-600 text-white",
    drive: "bg-yellow-500 text-white",
  }[source.type];

  return (
    <div className={`border rounded-xl p-3 transition-all ${source.enabled ? "border-blue-200 bg-white" : "border-gray-200 bg-gray-50 opacity-60"}`}>
      <div className="flex items-start gap-3">
        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${typeBg}`}>
          <TypeIcon />
          {typeLabel}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{source.label}</p>
          <p className="text-xs text-gray-400 truncate">
            {source.type === "github" && String((source.config as Record<string, unknown>).repoUrl ?? "")}
            {source.type === "mcp" && String((source.config as Record<string, unknown>).serverUrl ?? "")}
            {source.type === "drive" && "Drive Ordner"}
          </p>
        </div>

        {/* Toggle */}
        <button
          type="button"
          onClick={() => onToggle(source.id, !source.enabled)}
          className={`relative w-10 h-5 rounded-full transition-colors shrink-0 mt-0.5 ${source.enabled ? "bg-blue-500" : "bg-gray-300"}`}
          title={source.enabled ? "Deaktivieren" : "Aktivieren"}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${source.enabled ? "translate-x-5" : ""}`} />
        </button>
      </div>

      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={() => onFetch(source.id)}
          disabled={!source.enabled || fetching}
          className="text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400 transition-colors font-medium"
        >
          {fetching ? "Lädt..." : "Jetzt laden →"}
        </button>
        <button
          type="button"
          onClick={() => onDelete(source.id, source.label)}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors ml-auto"
        >
          Entfernen
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SourcesPanel                                                        */
/* ------------------------------------------------------------------ */

export function SourcesPanel({ open, onClose, onResourcesLoaded }: SourcesPanelProps) {
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [addType, setAddType] = useState<AddSourceType>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [fetchingIds, setFetchingIds] = useState<Set<string>>(new Set());

  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/doc-gen/sources");
      const json = await res.json();
      setSources(json.sources ?? []);
    } catch {
      toast.error("Fehler beim Laden der Quellen");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchSources();
  }, [open, fetchSources]);

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const res = await fetch("/api/doc-gen/sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      if (!res.ok) throw new Error("Fehler beim Aktualisieren");
      setSources((prev) => prev.map((s) => s.id === id ? { ...s, enabled } : s));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    }
  };

  const handleFetch = async (sourceId: string) => {
    setFetchingIds((prev) => new Set([...prev, sourceId]));
    try {
      const res = await fetch("/api/doc-gen/fetch-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler beim Laden");
      const resources = json.resources as Resource[];
      onResourcesLoaded(resources);
      toast.success(`${resources.length} Ressource(n) aus Quelle geladen`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Laden der Quelle");
    } finally {
      setFetchingIds((prev) => { const next = new Set(prev); next.delete(sourceId); return next; });
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Quelle "${label}" wirklich entfernen?`)) return;
    try {
      const res = await fetch("/api/doc-gen/sources", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Fehler beim Löschen");
      setSources((prev) => prev.filter((s) => s.id !== id));
      toast.success(`"${label}" entfernt`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    }
  };

  const handleFetchAllEnabled = async () => {
    const enabled = sources.filter((s) => s.enabled);
    if (enabled.length === 0) {
      toast.error("Keine aktiven Quellen vorhanden");
      return;
    }
    for (const source of enabled) {
      await handleFetch(source.id);
    }
  };

  if (!open) return null;

  const enabledCount = sources.filter((s) => s.enabled).length;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-bold text-gray-900">Quellen</h2>
            <p className="text-xs text-gray-500">MCP, GitHub, Google Drive</p>
          </div>
          <div className="flex items-center gap-2">
            {enabledCount > 0 && (
              <button
                type="button"
                onClick={handleFetchAllEnabled}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Alle laden ({enabledCount})
              </button>
            )}
            <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-100">
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Lädt...</p>
          ) : sources.length === 0 && !addType ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-sm text-gray-500">Noch keine Quellen hinzugefügt.</p>
              <p className="text-xs text-gray-400">Verbinde GitHub Repos, MCP-Server oder Drive-Ordner um deren Inhalte als Referenz zu nutzen.</p>
            </div>
          ) : (
            sources.map((source) => (
              <SourceCard
                key={source.id}
                source={source}
                onToggle={handleToggle}
                onFetch={handleFetch}
                onDelete={handleDelete}
                fetching={fetchingIds.has(source.id)}
              />
            ))
          )}

          {/* Add form */}
          {addType && (
            <AddSourceForm
              type={addType}
              onCancel={() => setAddType(null)}
              onSaved={() => { setAddType(null); fetchSources(); }}
            />
          )}
        </div>

        {/* Footer / Add menu */}
        <div className="px-4 py-3 border-t border-gray-200">
          {showAddMenu && !addType ? (
            <div className="grid grid-cols-3 gap-2 mb-2">
              {(["github", "mcp", "drive"] as SourceType[]).map((t) => {
                const Icon = t === "github" ? GithubIcon : t === "mcp" ? McpIcon : DriveIcon;
                const labels = { github: "GitHub", mcp: "MCP Server", drive: "Drive Ordner" };
                const colors = {
                  github: "bg-gray-900 text-white hover:bg-gray-800",
                  mcp: "bg-violet-600 text-white hover:bg-violet-700",
                  drive: "bg-yellow-500 text-white hover:bg-yellow-600",
                };
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setAddType(t); setShowAddMenu(false); }}
                    className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl transition-colors text-xs font-medium ${colors[t]}`}
                  >
                    <Icon />
                    {labels[t]}
                  </button>
                );
              })}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => { setShowAddMenu((v) => !v); setAddType(null); }}
            className="w-full text-sm px-4 py-2 border border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-500 hover:text-blue-600 transition-colors font-medium"
          >
            {showAddMenu ? "Abbrechen" : "+ Quelle hinzufügen"}
          </button>
        </div>
      </div>
    </>
  );
}
