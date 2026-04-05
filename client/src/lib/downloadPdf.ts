import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { formatDate } from './date';

/**
 * Parse CSV string into headers + rows arrays.
 */
function parseCsv(csv: string): { headers: string[]; rows: string[][] } {
  const lines = csv.split('\n').filter((r) => r.trim());
  const parse = (line: string) =>
    (line.match(/(".*?"|[^,]+)/g) || []).map((c) =>
      c.replace(/^"|"$/g, '').replace(/""/g, '"')
    );

  const headers = lines.length > 0 ? parse(lines[0]) : [];
  const rows = lines.slice(1).map(parse);
  return { headers, rows };
}

/**
 * Render an HTML element offscreen, capture with html2canvas, and save as multi-page PDF.
 */
async function htmlToPdf(container: HTMLElement, filename: string, orientation: 'portrait' | 'landscape' = 'landscape'): Promise<void> {
  const canvas = await html2canvas(container, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });

  const imgData = canvas.toDataURL('image/png');
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;

  const imgWidth = usableWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // Multi-page support
  let yOffset = 0;
  let page = 1;

  while (yOffset < imgHeight) {
    if (page > 1) doc.addPage();

    doc.addImage(
      imgData,
      'PNG',
      margin,
      margin - yOffset,
      imgWidth,
      imgHeight
    );

    yOffset += usableHeight;
    page++;
  }

  doc.save(`${filename}.pdf`);
}

/**
 * Build styled HTML table from CSV, render offscreen, capture as PDF.
 * Supports Bangla/Unicode text perfectly since it uses browser font rendering.
 */
export async function downloadTablePdf(csv: string, title: string, filename: string): Promise<void> {
  const { headers, rows } = parseCsv(csv);

  // Build HTML table
  const headerCells = headers.map((h) => `<th>${h}</th>`).join('');
  const bodyRows = rows.map((row, i) =>
    `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">${row.map((c) => `<td>${c}</td>`).join('')}</tr>`
  ).join('');

  const html = `
    <div style="font-family:'Noto Sans Bengali','Segoe UI',Arial,sans-serif;padding:20px;color:#333;background:#fff;">
      <div style="text-align:center;margin-bottom:6px;">
        <h1 style="margin:0;color:#2563eb;font-size:22px;">RDSWA</h1>
        <p style="margin:2px 0;color:#666;font-size:11px;">Rangpur Divisional Student Welfare Association — University of Barishal</p>
      </div>
      <h2 style="text-align:center;font-size:16px;margin:8px 0 4px;">${title}</h2>
      <p style="text-align:center;color:#888;font-size:10px;margin:0 0 12px;">
        Generated on ${formatDate(new Date())} — Total: ${rows.length} records
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:10px;">
        <thead>
          <tr style="background:#2563eb;color:#fff;">${headerCells}</tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
      <p style="text-align:center;font-size:9px;color:#aaa;margin-top:12px;border-top:1px solid #e5e7eb;padding-top:8px;">
        RDSWA — Rangpur Divisional Student Welfare Association, University of Barishal
      </p>
    </div>
  `;

  // Create offscreen container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = '1400px'; // Wide enough for landscape table
  container.innerHTML = html;

  // Style table cells
  const style = document.createElement('style');
  style.textContent = `
    th { padding: 6px 5px; text-align: left; font-weight: 600; font-size: 9px; white-space: nowrap; }
    td { padding: 5px 5px; border-bottom: 1px solid #e5e7eb; font-size: 9px; word-break: break-word; }
  `;
  container.prepend(style);

  document.body.appendChild(container);

  try {
    await htmlToPdf(container, filename, 'landscape');
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Download donation receipt HTML as PDF. Supports Bangla/Unicode.
 */
export async function downloadHtmlPdf(html: string, filename: string): Promise<void> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = '600px';
  container.innerHTML = html;

  // Override font to include Bangla support
  const style = document.createElement('style');
  style.textContent = `body, * { font-family: 'Noto Sans Bengali', 'Segoe UI', Arial, sans-serif !important; }`;
  container.prepend(style);

  document.body.appendChild(container);

  try {
    await htmlToPdf(container, filename, 'portrait');
  } finally {
    document.body.removeChild(container);
  }
}
