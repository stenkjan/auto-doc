import { put, del, list } from '@vercel/blob';

/**
 * Universelle Speicher-Klasse für Vercel Blob.
 * Ersetzt lokale Dateioperationen (fs.writeFileSync) im Serverless-Umfeld.
 */
export async function uploadFileToBlob(filename: string, content: string | Buffer | Blob, isPublic = true): Promise<string> {
  const { url } = await put(filename, content, {
    access: 'public',
    // In Produktion könnten wir addRandomSuffix: true nutzen, um Kollisionen zu vermeiden
    addRandomSuffix: true, 
  });
  return url;
}

export async function readTextFromBlob(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Fehler beim Lesen aus dem Blob-Storage: ${res.statusText}`);
  return res.text();
}

export async function deleteFromBlob(url: string): Promise<void> {
  await del(url);
}
