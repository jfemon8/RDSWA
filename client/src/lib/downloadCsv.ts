import api from './api';

/** Fetch a CSV endpoint and save it under the filename the server's `Content-Disposition` chose. */
export async function downloadCsv(url: string, fallbackFilename: string): Promise<string> {
  const res = await api.get(url, { responseType: 'text' });

  const disposition = (res.headers as any)?.['content-disposition'] as string | undefined;
  const filename = disposition?.match(/filename="?([^";]+)"?/)?.[1] || fallbackFilename;

  const blob = new Blob([res.data], { type: 'text/csv; charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);

  return res.data as string;
}
