import api from './api';

interface CsvPayload {
  csv: string;
  filename: string;
}

/** Fetch a CSV endpoint without saving anything, for callers that reshape it first. */
export async function fetchCsv(url: string, fallbackFilename: string): Promise<CsvPayload> {
  const res = await api.get(url, { responseType: 'text' });

  const disposition = (res.headers as any)?.['content-disposition'] as string | undefined;
  const filename = disposition?.match(/filename="?([^";]+)"?/)?.[1] || fallbackFilename;

  return { csv: res.data as string, filename };
}

/** Hand the browser a file to save under the given name. */
export function saveTextFile(text: string, filename: string, mime = 'text/csv; charset=utf-8'): void {
  const blob = new Blob([text], { type: mime });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}

/** Fetch a CSV endpoint and save it under the filename the server's `Content-Disposition` chose. */
export async function downloadCsv(url: string, fallbackFilename: string): Promise<string> {
  const { csv, filename } = await fetchCsv(url, fallbackFilename);
  saveTextFile(csv, filename);
  return csv;
}
