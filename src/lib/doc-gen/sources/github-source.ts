/**
 * GitHub source adapter.
 * Fetches file tree and file contents from a GitHub repository.
 * Supports public repos (no auth) and private repos (with PAT).
 */
import type { Resource } from "../ai-engine";

export interface GithubSourceConfig {
  repoUrl: string;        // e.g. https://github.com/owner/repo
  branch?: string;        // default: main
  path?: string;          // optional sub-path filter, e.g. "src/lib"
  token?: string;         // PAT for private repos
  maxFiles?: number;      // max number of files to fetch (default: 20)
}

function parseRepoUrl(repoUrl: string): { owner: string; repo: string } | null {
  try {
    const url = new URL(repoUrl);
    const parts = url.pathname.replace(/^\//, "").replace(/\/$/, "").split("/");
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

function githubHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "AutoDoc/1.0",
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

interface GithubTreeItem {
  path: string;
  type: "blob" | "tree";
  url: string;
  sha: string;
  size?: number;
}

/**
 * Fetch repository contents as Resources.
 * Returns a tree summary + content of key files.
 */
export async function fetchGithubSource(
  config: GithubSourceConfig
): Promise<Resource[]> {
  const parsed = parseRepoUrl(config.repoUrl);
  if (!parsed) {
    throw new Error(`Ungültige GitHub URL: ${config.repoUrl}`);
  }

  const { owner, repo } = parsed;
  const branch = config.branch ?? "main";
  const headers = githubHeaders(config.token);
  const maxFiles = config.maxFiles ?? 20;

  // Fetch the git tree recursively
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const treeRes = await fetch(treeUrl, { headers });

  if (!treeRes.ok) {
    if (treeRes.status === 404) {
      throw new Error(`GitHub Repo nicht gefunden: ${owner}/${repo} (Branch: ${branch})`);
    }
    if (treeRes.status === 401 || treeRes.status === 403) {
      throw new Error(`GitHub Zugriff verweigert – Token benötigt für privates Repo`);
    }
    throw new Error(`GitHub API Fehler ${treeRes.status}`);
  }

  const treeData = await treeRes.json() as { tree: GithubTreeItem[]; truncated: boolean };
  let items = treeData.tree.filter((item) => item.type === "blob");

  // Filter by path prefix if specified
  if (config.path) {
    const pathPrefix = config.path.replace(/^\//, "").replace(/\/$/, "");
    items = items.filter((item) => item.path.startsWith(pathPrefix));
  }

  // Filter out binary/large files — focus on text files
  const textExtensions = /\.(ts|tsx|js|jsx|py|md|txt|json|yaml|yml|toml|env\.example|sh|html|css|go|rs|java|php|rb|tf|sql)$/i;
  const textItems = items.filter(
    (item) => textExtensions.test(item.path) && (item.size ?? 0) < 100_000
  );

  // Build a file tree summary resource first
  const treeSummary = items
    .map((item) => item.path)
    .slice(0, 500)
    .join("\n");

  const resources: Resource[] = [
    {
      name: `${owner}/${repo} – Dateistruktur`,
      content: `Repository: ${config.repoUrl}\nBranch: ${branch}\n\nDateistruktur:\n${treeSummary}${treeData.truncated ? "\n... (abgeschnitten)" : ""}`,
      type: "text",
      sourceType: "github",
    },
  ];

  // Fetch contents of up to maxFiles text files
  const filesToFetch = textItems.slice(0, maxFiles);

  await Promise.allSettled(
    filesToFetch.map(async (item) => {
      try {
        const contentUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${item.path}?ref=${branch}`;
        const contentRes = await fetch(contentUrl, { headers });
        if (!contentRes.ok) return;

        const contentData = await contentRes.json() as { content?: string; encoding?: string };
        if (contentData.encoding === "base64" && contentData.content) {
          const decoded = Buffer.from(
            contentData.content.replace(/\n/g, ""),
            "base64"
          ).toString("utf-8");
          resources.push({
            name: `${owner}/${repo}/${item.path}`,
            content: decoded.slice(0, 30_000),
            type: "text",
            sourceType: "github",
          });
        }
      } catch {
        // Skip failed files silently
      }
    })
  );

  return resources;
}
