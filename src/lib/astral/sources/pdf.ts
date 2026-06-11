// Client-side PDF → page-image rendering using pdfjs-dist.
// pdfjs-dist references browser globals (DOMMatrix, etc.) at module load,
// so we lazy-import it inside the function to keep SSR safe.

export type RenderedPage = {
  index: number; // 1-based
  dataUrl: string; // image/jpeg
  width: number;
  height: number;
};

let workerConfigured = false;
async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (!workerConfigured) {
    const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url"))
      .default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    workerConfigured = true;
  }
  return pdfjs;
}

/** Render every page of a PDF file as JPEG data URLs. */
export async function renderPdfPages(
  file: File,
  opts: { scale?: number; quality?: number } = {},
): Promise<RenderedPage[]> {
  if (typeof window === "undefined") {
    throw new Error("renderPdfPages must run in the browser");
  }
  const pdfjs = await loadPdfjs();
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
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (doc as any).cleanup?.();
    } catch {
      /* noop */
    }
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
