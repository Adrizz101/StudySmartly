import type { SourceInput } from './learning-models';

export async function readSource(file: File): Promise<SourceInput> {
  if (!file.size) throw new Error('This file is empty.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Please upload a file smaller than 20 MB.');
  if (file.type.startsWith('image/')) return { name: file.name, text: '', images: [await dataURL(file)] };
  if (/\.pdf$/i.test(file.name)) {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const texts: string[] = [], images: string[] = [];
    try {
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        const text = content.items.map(i => 'str' in i ? i.str : '').join(' ');
        texts.push(`[${file.name}, page ${n}]\n${text}`);
        // Render every page so diagrams, equations and scanned content are visible.
        if (pdf.numPages > 50) throw new Error('Split PDFs longer than 50 pages into smaller files so every diagram can be analyzed.');
        const viewport = page.getViewport({ scale: 1.2 });
        const canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvas, viewport }).promise;
        images.push(canvas.toDataURL('image/jpeg', .75));
      }
    } finally { await pdf.cleanup(); }
    return { name: file.name, text: texts.join('\n\n'), images };
  }
  if (/\.(txt|md|csv)$/i.test(file.name)) return { name: file.name, text: await file.text(), images: [] };
  throw new Error('Choose a PDF, image, text, Markdown or CSV file.');
}
export function dataURL(file: File): Promise<string> {
  return new Promise((resolve,reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error('Could not read the file.')); r.readAsDataURL(file); });
}