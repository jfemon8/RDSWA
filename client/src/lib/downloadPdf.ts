import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from './date';

/** Splits a CSV into headers and rows, keeping quoted commas, escaped quotes and newlines intact. */
export function parseCsv(csv: string): { headers: string[]; rows: string[][] } {
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];

    if (quoted) {
      if (char === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      // A CRLF pair closes one record, not two.
      if (char === '\r' && csv[i + 1] === '\n') i++;
      row.push(field);
      records.push(row);
      row = [];
      field = '';
    } else field += char;
  }

  if (field || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  const filled = records.filter((r) => r.some((c) => c.trim() !== ''));
  return { headers: filled[0] ?? [], rows: filled.slice(1) };
}

/** jsPDF's built-in fonts cover cp1252 and silently drop the rest, Bangla and curly punctuation included. */
const STANDARD_FONT_SAFE = /^[\t\n\r\x20-\x7E\xA0-\xFF]*$/;

/** Whether text survives the built-in fonts, which is what decides between writing it and capturing it. */
export function isStandardFontSafe(text: string): boolean {
  return STANDARD_FONT_SAFE.test(text);
}

/** Writes the table as real PDF text, which is a fraction of the size of a screenshot and stays searchable. */
function tableToVectorPdf(
  headers: string[],
  rows: string[][],
  title: string,
  filename: string,
  siteName: string,
  siteNameFull: string
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const centre = pageWidth / 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(37, 99, 235);
  doc.text(siteName, centre, 12, { align: 'center' });

  let headingBottom = 12;
  if (siteNameFull) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(102, 102, 102);
    doc.text(siteNameFull, centre, (headingBottom += 5), { align: 'center' });
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(51, 51, 51);
  doc.text(title, centre, (headingBottom += 7), { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(136, 136, 136);
  doc.text(
    `Generated on ${formatDate(new Date())} - Total: ${rows.length} records`,
    centre,
    (headingBottom += 5),
    { align: 'center' }
  );

  const footer = `${siteName}${siteNameFull ? ` - ${siteNameFull}` : ''}`;
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: headingBottom + 4,
    margin: { top: 10, left: 8, right: 8, bottom: 12 },
    styles: { fontSize: 7, cellPadding: 1.4, overflow: 'linebreak', textColor: [51, 51, 51] },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    didDrawPage: () => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(170, 170, 170);
      doc.text(footer, centre, pageHeight - 6, { align: 'center' });
    },
  });

  doc.save(`${filename}.pdf`);
}

const CAPTURE_SCALE = 2;

/** The heights a page may end on, so a break never lands in the middle of a row. */
export function pageSlices(
  boundaries: number[],
  totalHeight: number,
  capacity: number
): number[] {
  const stops = [...new Set(boundaries.filter((b) => b > 0 && b < totalHeight))].sort(
    (a, b) => a - b
  );
  const slices: number[] = [];
  let top = 0;

  while (top < totalHeight) {
    const limit = top + capacity;
    if (limit >= totalHeight) {
      slices.push(totalHeight - top);
      break;
    }
    const stop = [...stops].reverse().find((b) => b > top && b <= limit);
    // A single row taller than the page has to be cut, since no break point fits.
    slices.push((stop ?? limit) - top);
    top += slices[slices.length - 1]!;
  }

  return slices;
}

/** Captures an element and saves the capture as a multi-page PDF, breaking only between `breakAfter` elements. */
async function htmlToPdf(
  container: HTMLElement,
  filename: string,
  orientation: 'portrait' | 'landscape' = 'landscape',
  breakAfter?: string
): Promise<void> {
  // Only the screenshot path needs html2canvas, so it is fetched when that path is actually taken.
  const { default: html2canvas } = await import('html2canvas');

  // Measured before the capture, since the offscreen container is torn down right after it.
  const containerTop = container.getBoundingClientRect().top;
  const boundaries = breakAfter
    ? Array.from(container.querySelectorAll(breakAfter)).map(
        (el) => (el.getBoundingClientRect().bottom - containerTop) * CAPTURE_SCALE
      )
    : [];

  const canvas = await html2canvas(container, {
    scale: CAPTURE_SCALE,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });

  // Without `compress` jsPDF stores the capture as raw pixels, which is what made these files enormous.
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4', compress: true });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;

  // Canvas pixels that fit on one page once the capture is scaled to the printable width.
  const pixelsPerMm = canvas.width / usableWidth;
  const slices = pageSlices(boundaries, canvas.height, usableHeight * pixelsPerMm);

  const slice = document.createElement('canvas');
  const ctx = slice.getContext('2d');
  let top = 0;

  slices.forEach((height, index) => {
    if (index > 0) doc.addPage();

    slice.width = canvas.width;
    slice.height = height;
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, top, canvas.width, height, 0, 0, canvas.width, height);
    }

    doc.addImage(
      slice.toDataURL('image/png'),
      'PNG',
      margin,
      margin,
      usableWidth,
      height / pixelsPerMm
    );
    top += height;
  });

  doc.save(`${filename}.pdf`);
}

/** Renders the CSV as a styled offscreen HTML table captured to PDF, which preserves Bangla through browser font rendering. */
async function tableToRasterPdf(
  headers: string[],
  rows: string[][],
  title: string,
  filename: string,
  siteName: string,
  siteNameFull: string
): Promise<void> {
  const headerCells = headers.map((h) => `<th>${h}</th>`).join('');
  const bodyRows = rows.map((row, i) =>
    `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">${row.map((c) => `<td>${c}</td>`).join('')}</tr>`
  ).join('');

  const html = `
    <div style="font-family:'Noto Sans Bengali','Segoe UI',Arial,sans-serif;padding:20px;color:#333;background:#fff;">
      <div style="text-align:center;margin-bottom:6px;">
        <h1 style="margin:0;color:#2563eb;font-size:22px;">${siteName}</h1>
        <p style="margin:2px 0;color:#666;font-size:11px;">${siteNameFull}</p>
      </div>
      <h2 style="text-align:center;font-size:16px;margin:8px 0 4px;">${title}</h2>
      <p style="text-align:center;color:#888;font-size:10px;margin:0 0 12px;">
        Generated on ${formatDate(new Date())} - Total: ${rows.length} records
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:10px;">
        <thead>
          <tr style="background:#2563eb;color:#fff;">${headerCells}</tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
      <p style="text-align:center;font-size:9px;color:#aaa;margin-top:12px;border-top:1px solid #e5e7eb;padding-top:8px;">
        ${siteName}${siteNameFull ? ` - ${siteNameFull}` : ''}
      </p>
    </div>
  `;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = '1400px'; // Wide enough for landscape table
  container.innerHTML = html;

  const style = document.createElement('style');
  style.textContent = `
    th { padding: 6px 5px; text-align: left; font-weight: 600; font-size: 9px; white-space: nowrap; }
    td { padding: 5px 5px; border-bottom: 1px solid #e5e7eb; font-size: 9px; word-break: break-word; }
  `;
  container.prepend(style);

  document.body.appendChild(container);

  try {
    await htmlToPdf(container, filename, 'landscape', 'thead tr, tbody tr');
  } finally {
    document.body.removeChild(container);
  }
}

/** Saves a CSV as a table PDF, written as text where the built-in fonts can carry it and captured as an image otherwise. */
export async function downloadTablePdf(csv: string, title: string, filename: string, siteName = 'RDSWA', siteNameFull = ''): Promise<void> {
  const { headers, rows } = parseCsv(csv);

  if (isStandardFontSafe(`${siteName}\n${siteNameFull}\n${title}\n${csv}`)) {
    tableToVectorPdf(headers, rows, title, filename, siteName, siteNameFull);
    return;
  }

  await tableToRasterPdf(headers, rows, title, filename, siteName, siteNameFull);
}

/** Download a donation receipt as PDF, with Bangla and Unicode preserved. */
export async function downloadHtmlPdf(html: string, filename: string): Promise<void> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = '600px';
  container.innerHTML = html;

  const style = document.createElement('style');
  style.textContent = `body, * { font-family: 'Noto Sans Bengali', 'Segoe UI', Arial, sans-serif !important; }`;
  container.prepend(style);

  document.body.appendChild(container);

  try {
    await htmlToPdf(container, filename, 'portrait', 'tr, p, div');
  } finally {
    document.body.removeChild(container);
  }
}
