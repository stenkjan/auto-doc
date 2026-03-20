/**
 * Cloud-based "Write-Ahead" Memory System.
 * Stores and retrieves contextual data (fetched API responses, scrape results)
 * using Vercel Blob. Each session gets its own namespace.
 */

import { put, del, list } from "@vercel/blob";

export interface MemoryEntry {
  key: string;
  content: string;
  url: string;
  createdAt: string;
}

const MEMORY_PREFIX = "doc-gen/memory";

/**
 * Save content to cloud memory under a session namespace.
 */
export async function saveMemory(
  sessionId: string,
  key: string,
  content: string
): Promise<MemoryEntry> {
  const pathname = `${MEMORY_PREFIX}/${sessionId}/${key}.md`;
  const { url } = await put(pathname, content, {
    access: "public",
    addRandomSuffix: false,
  });

  return {
    key,
    content,
    url,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Load all memory entries for a given session.
 */
export async function loadMemory(sessionId: string): Promise<MemoryEntry[]> {
  const prefix = `${MEMORY_PREFIX}/${sessionId}/`;
  const entries: MemoryEntry[] = [];

  try {
    const { blobs } = await list({ prefix });

    for (const blob of blobs) {
      const key = blob.pathname
        .replace(prefix, "")
        .replace(/\.md$/, "");

      try {
        const res = await fetch(blob.url, { cache: "no-store" });
        if (!res.ok) continue;
        const content = await res.text();
        entries.push({
          key,
          content,
          url: blob.url,
          createdAt: blob.uploadedAt.toISOString(),
        });
      } catch {
        // Skip unreadable entries
      }
    }
  } catch {
    // No memory yet for this session
  }

  return entries;
}

/**
 * Load a single memory entry by key.
 */
export async function loadMemoryEntry(
  sessionId: string,
  key: string
): Promise<MemoryEntry | null> {
  const entries = await loadMemory(sessionId);
  return entries.find((e) => e.key === key) ?? null;
}

/**
 * Clear all memory for a given session.
 */
export async function clearMemory(sessionId: string): Promise<void> {
  const prefix = `${MEMORY_PREFIX}/${sessionId}/`;
  try {
    const { blobs } = await list({ prefix });
    for (const blob of blobs) {
      await del(blob.url);
    }
  } catch {
    // Nothing to clear
  }
}
