import { google, drive_v3 } from "googleapis";
import { Readable } from "stream";

let driveClient: drive_v3.Drive | null = null;

// drive.file scope only allows files created by the app.
// drive.readonly allows reading any file the SA has access to.
const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly",
];

async function getDrive(): Promise<drive_v3.Drive> {
  if (driveClient) return driveClient;

  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not configured");

  const credentials = JSON.parse(keyJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: DRIVE_SCOPES,
  });

  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

/* ------------------------------------------------------------------ */
/*  Drive file ID extraction from URL                                  */
/* ------------------------------------------------------------------ */

export function extractDriveFileId(url: string): string | null {
  // Handles:
  // https://drive.google.com/file/d/{id}/view
  // https://drive.google.com/open?id={id}
  // https://docs.google.com/document/d/{id}/edit
  // https://docs.google.com/spreadsheets/d/{id}/edit
  // plain file ID
  const patterns = [
    /\/d\/([a-zA-Z0-9_-]{25,})/,
    /[?&]id=([a-zA-Z0-9_-]{25,})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  // If it looks like a bare file ID
  if (/^[a-zA-Z0-9_-]{25,}$/.test(url.trim())) return url.trim();
  return null;
}

/* ------------------------------------------------------------------ */
/*  Drive resource fetching                                             */
/* ------------------------------------------------------------------ */

export type DriveResource = {
  name: string;
  content: string;
  type: "text";
};

/**
 * Fetch a file from Google Drive and return its text content.
 * Supports: Google Docs, Sheets, plain text, PDF (text extraction), DOCX.
 */
export async function fetchDriveResource(fileId: string): Promise<DriveResource> {
  const drive = await getDrive();

  // Get file metadata
  const meta = await drive.files.get({
    fileId,
    fields: "id,name,mimeType",
  });

  const name = meta.data.name ?? fileId;
  const mimeType = meta.data.mimeType ?? "";

  // Google Workspace files — export as plain text
  if (mimeType === "application/vnd.google-apps.document") {
    const res = await drive.files.export(
      { fileId, mimeType: "text/plain" },
      { responseType: "text" }
    );
    return { name, content: String(res.data), type: "text" };
  }

  if (mimeType === "application/vnd.google-apps.spreadsheet") {
    const res = await drive.files.export(
      { fileId, mimeType: "text/csv" },
      { responseType: "text" }
    );
    return { name, content: String(res.data), type: "text" };
  }

  if (mimeType === "application/vnd.google-apps.presentation") {
    const res = await drive.files.export(
      { fileId, mimeType: "text/plain" },
      { responseType: "text" }
    );
    return { name, content: String(res.data), type: "text" };
  }

  // Binary files — download and parse
  const dlRes = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  const buffer = Buffer.from(dlRes.data as ArrayBuffer);

  // DOCX
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return { name, content: result.value, type: "text" };
  }

  // Plain text / markdown / CSV
  if (mimeType.startsWith("text/") || mimeType === "application/json") {
    return { name, content: buffer.toString("utf-8"), type: "text" };
  }

  // PDF — extract text via pdf-parse if available, otherwise return placeholder
  if (mimeType === "application/pdf") {
    try {
      const { default: pdfParse } = await import("pdf-parse");
      const data = await pdfParse(buffer);
      return { name, content: data.text, type: "text" };
    } catch {
      return {
        name,
        content: `[PDF-Datei: ${name} – Textextraktion nicht verfügbar]`,
        type: "text",
      };
    }
  }

  throw new Error(
    `Dateityp "${mimeType}" wird nicht unterstützt. Unterstützte Typen: Google Docs, Sheets, DOCX, TXT, PDF.`
  );
}

export async function uploadToDrive(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  subfolder?: string
): Promise<{ fileId: string; webViewLink: string }> {
  const drive = await getDrive();
  const outputFolderId = process.env.GOOGLE_DRIVE_OUTPUT_FOLDER_ID;
  if (!outputFolderId) throw new Error("GOOGLE_DRIVE_OUTPUT_FOLDER_ID not set");

  let parentId = outputFolderId;

  if (subfolder) {
    parentId = await getOrCreateFolder(drive, subfolder, outputFolderId);
  }

  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [parentId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: "id,webViewLink",
  });

  await drive.permissions.create({
    fileId: res.data.id!,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  return {
    fileId: res.data.id!,
    webViewLink: res.data.webViewLink!,
  };
}

async function getOrCreateFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string
): Promise<string> {
  const existing = await drive.files.list({
    q: `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id)",
  });

  if (existing.data.files?.length) {
    return existing.data.files[0].id!;
  }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });

  return created.data.id!;
}

export async function uploadPDFToDrive(
  pdf: Buffer,
  title: string,
  projectRef?: string
): Promise<{ fileId: string; webViewLink: string }> {
  return uploadToDrive(
    pdf,
    `${title}.pdf`,
    "application/pdf",
    projectRef
  );
}

export async function uploadExcelToDrive(
  xlsx: Buffer,
  title: string,
  projectRef?: string
): Promise<{ fileId: string; webViewLink: string }> {
  return uploadToDrive(
    xlsx,
    `${title}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    projectRef
  );
}
