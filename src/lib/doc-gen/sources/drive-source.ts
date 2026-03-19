/**
 * Google Drive source adapter.
 * Wraps the existing drive-output.ts to support folder-level access:
 * fetches all files in a Drive folder and returns them as Resources.
 */
import type { Resource } from "../ai-engine";
import { fetchDriveResource, extractDriveFileId } from "../drive-output";
import { google, drive_v3 } from "googleapis";

export interface DriveSourceConfig {
  folderUrl: string;    // Google Drive folder URL
  maxFiles?: number;    // max files to fetch (default: 10)
}

async function getDriveClient(): Promise<drive_v3.Drive> {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY nicht konfiguriert");

  const credentials = JSON.parse(keyJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });

  return google.drive({ version: "v3", auth });
}

function extractFolderId(url: string): string | null {
  return extractDriveFileId(url);
}

/**
 * Fetch all text files in a Google Drive folder as Resources.
 */
export async function fetchDriveSource(config: DriveSourceConfig): Promise<Resource[]> {
  const folderId = extractFolderId(config.folderUrl);
  if (!folderId) {
    throw new Error(`Ungültige Drive-Ordner URL: ${config.folderUrl}`);
  }

  const drive = await getDriveClient();
  const maxFiles = config.maxFiles ?? 10;

  // List files in the folder
  const listRes = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: "files(id, name, mimeType)",
    pageSize: maxFiles,
  });

  const files = listRes.data.files ?? [];

  if (files.length === 0) {
    return [
      {
        name: "Drive Ordner",
        content: "Keine Dateien im angegebenen Drive-Ordner gefunden.",
        type: "text",
        sourceType: "drive",
      },
    ];
  }

  const resources: Resource[] = [];

  await Promise.allSettled(
    files.map(async (file) => {
      if (!file.id) return;
      try {
        const resource = await fetchDriveResource(file.id);
        resources.push({
          ...resource,
          sourceType: "drive",
        });
      } catch {
        // Skip unsupported file types
      }
    })
  );

  return resources;
}
