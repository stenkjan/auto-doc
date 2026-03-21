/**
 * Uploads the updated document_generator_standalone.md to Google Drive,
 * replacing the existing file (ID: 1DfypO8ABbNHSq1ibPPK7iijBvsgycJ9p).
 *
 * Usage:
 *   node scripts/upload-standalone-to-drive.js
 *
 * Requires GOOGLE_SERVICE_ACCOUNT_KEY in .env.local or as env variable.
 */

const fs = require("fs");
const path = require("path");

// Load .env.local manually since this is a plain Node script
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const { google } = require("googleapis");
const { Readable } = require("stream");

const FILE_ID = "1DfypO8ABbNHSq1ibPPK7iijBvsgycJ9p";
const SOURCE_FILE = path.join(
  __dirname,
  "../.cursor/plans/document_generator_standalone.md"
);

async function main() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    console.error("❌  GOOGLE_SERVICE_ACCOUNT_KEY not set");
    process.exit(1);
  }

  const credentials = JSON.parse(keyJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/drive.file",
    ],
  });

  const drive = google.drive({ version: "v3", auth });

  const content = fs.readFileSync(SOURCE_FILE, "utf-8");
  const stream = new Readable();
  stream.push(content);
  stream.push(null);

  console.log(`📤  Uploading ${path.basename(SOURCE_FILE)} → Drive file ${FILE_ID} …`);

  try {
    const res = await drive.files.update({
      fileId: FILE_ID,
      media: {
        mimeType: "text/markdown",
        body: stream,
      },
      fields: "id,name,modifiedTime,webViewLink",
    });

    console.log("✅  Drive file updated:");
    console.log(`    Name:     ${res.data.name}`);
    console.log(`    Modified: ${res.data.modifiedTime}`);
    console.log(`    Link:     ${res.data.webViewLink}`);
  } catch (err) {
    if (err.code === 403) {
      console.error("❌  Permission denied (403). Make sure the service account has Editor access to this file.");
      console.error("    Share the file with the service account email and try again.");
    } else {
      console.error("❌  Upload failed:", err.message);
    }
    process.exit(1);
  }
}

main();
