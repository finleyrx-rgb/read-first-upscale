// Sheet exporters — PNG (current sheet), PDF (multi-sheet set), CSV (BOM).

import { jsPDF } from "jspdf";
import { useAstral, type AstralState } from "./store";
import { qtys } from "./model";

type SheetSpec = {
  label: string;
  patch: Partial<AstralState>;
};

const SHEET_SET: SheetSpec[] = [
  { label: "A1.01 Plan — Architectural", patch: { view: "plan", layer: "arch" } },
  { label: "A1.13 Framing Plan", patch: { view: "plan", layer: "framing" } },
  { label: "A1.20 Foundation Plan", patch: { view: "plan", layer: "foundation" } },
  { label: "A2.01 Elevation — Front", patch: { view: "elevation", face: "front", layer: "arch" } },
  { label: "A2.02 Elevation — Back", patch: { view: "elevation", face: "back", layer: "arch" } },
  { label: "A2.03 Elevation — Left", patch: { view: "elevation", face: "left", layer: "arch" } },
  { label: "A2.04 Elevation — Right", patch: { view: "elevation", face: "right", layer: "arch" } },
  { label: "A3.01 Section A–A (cross)", patch: { view: "section", cut: "cross" } },
  { label: "A3.02 Section B–B (long)", patch: { view: "section", cut: "long" } },
];

function findActiveSvg(): SVGSVGElement | null {
  return document.querySelector<SVGSVGElement>(".astral-canvas svg");
}

function nextFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

async function svgToPng(svg: SVGSVGElement, scale = 2): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const xml = new XMLSerializer().serializeToString(clone);
  const url = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));

  const vb = svg.viewBox.baseVal;
  const w = (vb.width || svg.clientWidth || 800) * scale;
  const h = (vb.height || svg.clientHeight || 600) * scale;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = Math.round(w); cv.height = Math.round(h);
      const ctx = cv.getContext("2d");
      if (!ctx) return reject(new Error("no 2d context"));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      resolve(cv.toDataURL("image/png"));
    };
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

function downloadBlob(data: string | Blob, filename: string, mime?: string) {
  const blob = typeof data === "string" ? new Blob([data], { type: mime || "text/plain" }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = /data:(.*?);/.exec(head)?.[1] || "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function exportCurrentPNG(filename = "astral-sheet.png"): Promise<void> {
  const svg = findActiveSvg();
  if (!svg) throw new Error("No active sheet to export");
  const png = await svgToPng(svg, 2);
  downloadBlob(dataUrlToBlob(png), filename);
}

export async function exportAllPDF(filename = "astral-set.pdf"): Promise<void> {
  const store = useAstral.getState();
  const orig: Partial<AstralState> = {
    view: store.view, layer: store.layer, face: store.face, cut: store.cut,
  };
  const pdf = new jsPDF({ orientation: "landscape", format: "a3", unit: "mm" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  try {
    for (let i = 0; i < SHEET_SET.length; i++) {
      const sheet = SHEET_SET[i];
      useAstral.getState().patch(sheet.patch);
      await nextFrame(); await nextFrame();
      const svg = findActiveSvg();
      if (!svg) continue;
      const png = await svgToPng(svg, 2);
      if (i > 0) pdf.addPage();
      // fit into page with aspect
      const vb = svg.viewBox.baseVal;
      const ar = (vb.width || 628) / (vb.height || 540);
      const availW = pageW - 2 * margin;
      const availH = pageH - 2 * margin - 10;
      let w = availW, h = availW / ar;
      if (h > availH) { h = availH; w = h * ar; }
      pdf.addImage(png, "PNG", (pageW - w) / 2, margin, w, h);
      pdf.setFontSize(9);
      pdf.text(sheet.label, margin, pageH - margin);
      pdf.text(`${i + 1} / ${SHEET_SET.length}`, pageW - margin, pageH - margin, { align: "right" });
    }
    pdf.save(filename);
  } finally {
    useAstral.getState().patch(orig);
  }
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportBOMCsv(s: AstralState, filename = "astral-quantities.csv"): void {
  const q = qtys(s);
  const rows: [string, string][] = [
    ["Project type", s.type],
    ["Length (mm)", String(s.L)],
    ["Width (mm)", String(s.W)],
    ["Stud height (mm)", String(s.studH)],
    ["Stud spacing (mm)", String(s.spacing)],
    ["Units", String(s.units)],
    ["Roof form", s.roof + (s.roof === "Flat" && s.parapet ? " + parapet" : "")],
    ["Roof pitch (°)", String(s.pitch)],
    ["Roof cover", s.cover],
    ["Roof colour", s.roofCol],
    ["Roof structure", s.struct],
    ["Cladding", s.clad],
    ["Cladding colour", s.cladCol],
    ["Lining", s.lining],
    ["Flooring", s.floor],
    ["Insulation", s.insul],
    ["Joinery", s.joinery],
    ["Wind zone", s.wind],
    ["Foundation", s.found],
    ["", ""],
    ["Perimeter (m)", q.perim],
    ["Floor area (m²)", q.floorA],
    ["Wall area (m²)", q.wallA],
    ["Roof area (m²)", q.roofA],
    ["Concrete (m³)", q.concrete],
    ["Mesh sheets", String(q.mesh)],
    ["Stud length (lm)", String(q.studsLm)],
    ["Purlin length (lm)", String(q.purlinsLm)],
    ["Roofing (m²)", String(q.roofingM2)],
    ["Cladding (m²)", String(q.cladM2)],
    ["Lining (m²)", String(q.liningM2)],
    ["Openings", q.joinery],
  ];
  const openingRows = s.openings.map((o) => [
    `Opening #${o.id}`,
    `${o.kind} · ${o.wall} · off ${o.off}mm · w ${o.width}mm`,
  ] as [string, string]);
  const all = [["Item", "Value"], ...rows, ["", ""], ...openingRows];
  const csv = all.map((r) => r.map(csvEscape).join(",")).join("\n");
  downloadBlob(csv, filename, "text/csv;charset=utf-8");
}
