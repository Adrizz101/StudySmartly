import { SlideDocument } from '@/types';

declare global {
  interface Window {
    html2canvas?: (el: HTMLElement, opts?: Record<string, unknown>) => Promise<HTMLCanvasElement>;
    jspdf?: {
      jsPDF: new (opts?: Record<string, unknown>) => {
        addImage: (data: string, format: string, x: number, y: number, w: number, h: number) => void;
        addPage: () => void;
        save: (filename: string) => void;
        internal: { getNumberOfPages: () => number; pageSize: { getWidth: () => number; getHeight: () => number } };
      };
    };
  }
}

export function isPdfLibReady(): boolean {
  return typeof window.html2canvas !== 'undefined' && typeof window.jspdf !== 'undefined';
}

export async function waitForPdfLib(timeoutMs = 5000): Promise<void> {
  if (isPdfLibReady()) return;
  const [capture, pdfLibrary] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);
  window.html2canvas = capture.default as unknown as NonNullable<Window['html2canvas']>;
  window.jspdf = { jsPDF: pdfLibrary.jsPDF } as unknown as NonNullable<Window['jspdf']>;
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (isPdfLibReady()) { resolve(); return; }
      if (Date.now() - start > timeoutMs) {
        reject(new Error('PDF libraries failed to load'));
        return;
      }
      setTimeout(check, 200);
    };
    check();
  });
}

export async function exportSlidesToPDF(slideElements: HTMLElement[], fileName: string): Promise<void> {
  try {
    await waitForPdfLib();
  } catch {
    throw new Error('PDF libraries not available. Check your internet connection.');
  }

  const pdfLibrary = window.jspdf;
  const capture = window.html2canvas;
  if (!pdfLibrary || !capture) throw new Error('PDF libraries not available');
  const { jsPDF } = pdfLibrary;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [960, 540] });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < slideElements.length; i++) {
    const element = slideElements[i];
    if (!element) continue;
    const canvas = await capture(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
      logging: false,
    });
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
  }

  pdf.save(fileName);
}

export async function exportGuideToPDF(element: HTMLElement, fileName: string): Promise<void> {
  try {
    await waitForPdfLib();
  } catch {
    throw new Error('PDF libraries not available. Check your internet connection.');
  }

  const pdfLibrary = window.jspdf;
  const capture = window.html2canvas;
  if (!pdfLibrary || !capture) throw new Error('PDF libraries not available');
  const { jsPDF } = pdfLibrary;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const canvas = await capture(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
    logging: false,
  });

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;
  const imgData = canvas.toDataURL('image/jpeg', 0.92);

  pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(fileName);
}

export function exportAsHTML(doc: SlideDocument): string {
  const slidesHTML = doc.slides.map((s, i) => {
    const bullets = s.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('');
    return `
      <section class="slide" data-layout="${s.layout}">
        <div class="slide-number">${i + 1}</div>
        ${s.category ? `<div class="tag">${escapeHtml(s.category)}</div>` : ''}
        <h2>${escapeHtml(s.heading)}</h2>
        ${s.body ? `<p>${escapeHtml(s.body)}</p>` : ''}
        ${bullets ? `<ul>${bullets}</ul>` : ''}
        ${s.stats ? `<div class="stats">${s.stats.map(st => `<div class="stat"><div class="stat-val">${escapeHtml(st.value)}</div><div class="stat-lbl">${escapeHtml(st.label)}</div></div>`).join('')}</div>` : ''}
      </section>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(doc.title)}</title>
<style>
  body { font-family: 'Inter', -apple-system, sans-serif; background: #0a0c10; color: #e8ebf0; margin: 0; padding: 40px; }
  h1 { font-size: 28px; margin-bottom: 8px; }
  .meta { color: #8b94a6; font-size: 14px; margin-bottom: 32px; }
  .slide { background: linear-gradient(135deg, #0f172a, #1e293b); border: 1px solid #232936; border-radius: 16px; padding: 32px; margin-bottom: 24px; position: relative; }
  .slide-number { position: absolute; top: 16px; right: 16px; color: #5d6473; font-size: 12px; }
  .tag { display: inline-block; padding: 4px 12px; border-radius: 999px; background: rgba(16,185,129,0.15); color: #34d399; font-size: 11px; font-weight: 600; margin-bottom: 12px; }
  .slide h2 { color: #34d399; font-size: 22px; margin: 0 0 12px; }
  .slide p { color: #94a3b8; line-height: 1.6; margin: 0 0 12px; }
  .slide ul { color: #94a3b8; padding-left: 20px; line-height: 1.8; }
  .stats { display: flex; gap: 16px; margin-top: 16px; }
  .stat { background: rgba(255,255,255,0.06); border-radius: 12px; padding: 16px; flex: 1; }
  .stat-val { font-size: 24px; font-weight: 700; color: #34d399; }
  .stat-lbl { font-size: 12px; color: #94a3b8; margin-top: 4px; }
  .slide[data-layout="title"] { text-align: center; padding: 64px 32px; }
  .slide[data-layout="title"] h2 { font-size: 32px; color: #e8ebf0; }
  .slide[data-layout="summary"] h2 { color: #34d399; }
</style>
</head>
<body>
<h1>${escapeHtml(doc.title)}</h1>
<div class="meta">${doc.slides.length} ${doc.format} · Generated by StudySmart · ${new Date(doc.updatedAt).toLocaleDateString()}</div>
${slidesHTML}
</body>
</html>`;
}

export function exportAsText(doc: SlideDocument): string {
  let text = `${doc.title}\n${'='.repeat(doc.title.length)}\n${doc.slides.length} ${doc.format}\nGenerated by StudySmart\n${new Date(doc.updatedAt).toLocaleString()}\n\n`;
  doc.slides.forEach((s, i) => {
    text += `\n--- ${i + 1}. ${s.heading} ---\n`;
    if (s.category) text += `[${s.category}]\n`;
    if (s.body) text += `${s.body}\n`;
    if (s.bullets.length > 0) {
      text += '\n';
      s.bullets.forEach((b) => { text += `  • ${b}\n`; });
    }
    if (s.stats && s.stats.length > 0) {
      text += '\n';
      s.stats.forEach((st) => { text += `  ▸ ${st.value} — ${st.label}\n`; });
    }
    text += '\n';
  });
  return text;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
