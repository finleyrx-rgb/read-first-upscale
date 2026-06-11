// Client-side PDF → page-image rendering using pdfjs-dist.
// Each call renders one page to a JPEG data URL suitable for the vision LLM.

import * as pdfjs from "pdfjs-dist";
// Vite serves the worker as a URL; set once at module load.
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
}

export type RenderedPage = {
  index: number; // 1-based
  dataUrl: string; // image/jpeg
  width: number;
  height: number;
};

/** Render every page of a PDF file as JPEG data URLs. */
export async function renderPdfPages(
  file: File,
  opts: { scale?: number; quality?: number } = {},
): Promise<RenderedPage[]> {
  const scale = opts.scale ?? 1.4;
  const quality = opts.quality ?? 0.78;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: RenderedPage[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2d unavailable");
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      pages.push({
        index: i,
        dataUrl: canvas.toDataURL("image/jpeg", quality),
        width: canvas.width,
        height: canvas.height,
      });
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return pages;
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.readAsDataURL(file);
  });
}
