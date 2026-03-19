/**
 * MCP (Model Context Protocol) source adapter.
 * Connects to an MCP server, lists available resources/tools,
 * and fetches content based on a query.
 */
import type { Resource } from "../ai-engine";

export interface McpSourceConfig {
  serverUrl: string;   // base URL of the MCP server
  apiKey?: string;     // optional authentication key
}

interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

interface McpResourceContent {
  uri: string;
  text?: string;
  mimeType?: string;
}

function mcpHeaders(config: McpSourceConfig): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }
  return headers;
}

/**
 * List all resources available from the MCP server.
 */
export async function listMcpResources(config: McpSourceConfig): Promise<McpResource[]> {
  const url = `${config.serverUrl.replace(/\/$/, "")}/resources/list`;
  const res = await fetch(url, {
    method: "POST",
    headers: mcpHeaders(config),
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`MCP Server Fehler ${res.status}: ${config.serverUrl}`);
  }

  const data = await res.json() as { resources?: McpResource[] };
  return data.resources ?? [];
}

/**
 * Read a specific resource from the MCP server by URI.
 */
export async function readMcpResource(
  config: McpSourceConfig,
  uri: string
): Promise<McpResourceContent[]> {
  const url = `${config.serverUrl.replace(/\/$/, "")}/resources/read`;
  const res = await fetch(url, {
    method: "POST",
    headers: mcpHeaders(config),
    body: JSON.stringify({ uri }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`MCP Lese-Fehler ${res.status} für URI: ${uri}`);
  }

  const data = await res.json() as { contents?: McpResourceContent[] };
  return data.contents ?? [];
}

/**
 * Fetch resources from an MCP server.
 * Returns up to 10 resources as Resource objects.
 */
export async function fetchMcpSource(
  config: McpSourceConfig,
  query?: string
): Promise<Resource[]> {
  let available: McpResource[];
  try {
    available = await listMcpResources(config);
  } catch (err) {
    throw new Error(
      `MCP Server nicht erreichbar (${config.serverUrl}): ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  if (available.length === 0) {
    return [
      {
        name: `MCP: ${config.serverUrl}`,
        content: "Keine Ressourcen auf dem MCP-Server verfügbar.",
        type: "text",
        sourceType: "mcp",
      },
    ];
  }

  // Filter by query if provided (simple keyword match on name/description)
  let filtered = available;
  if (query) {
    const q = query.toLowerCase();
    filtered = available.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        r.uri.toLowerCase().includes(q)
    );
    if (filtered.length === 0) filtered = available; // fall back to all
  }

  // Fetch content of up to 10 resources
  const toFetch = filtered.slice(0, 10);
  const resources: Resource[] = [];

  await Promise.allSettled(
    toFetch.map(async (mcpResource) => {
      try {
        const contents = await readMcpResource(config, mcpResource.uri);
        for (const content of contents) {
          if (content.text) {
            resources.push({
              name: `MCP: ${mcpResource.name}`,
              content: content.text.slice(0, 40_000),
              type: "text",
              sourceType: "mcp",
            });
          }
        }
      } catch {
        // Skip unreadable resources
      }
    })
  );

  // Include a summary if no content was fetched
  if (resources.length === 0) {
    resources.push({
      name: `MCP Ressourcen-Liste: ${config.serverUrl}`,
      content: available.map((r) => `- ${r.name} (${r.uri}): ${r.description ?? ""}`).join("\n"),
      type: "text",
      sourceType: "mcp",
    });
  }

  return resources;
}
