import { google, drive_v3 } from "googleapis";
import { Readable } from "stream";

let driveClient: drive_v3.Drive | null = null;

async function getDrive(): Promise<drive_v3.Drive> {
  if (driveClient) return driveClient;

  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not configured");

  const credentials = JSON.parse(keyJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
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
