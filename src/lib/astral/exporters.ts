// Sheet exporters — PNG (current sheet), full A0–A5 PDF set (Phase 11), CSV (BOM).
//
// The PDF set walks the live model and renders every sheet in the Oxford-convention
// taxonomy defined in sheet.ts:
//   A0  cover / drawing register
//   A1  plans  (arch / foundation / framing / services)
//   A2  elevations (arch / framing / foundation × 4 faces)
//   A3  sections (cross + long, with callout bubbles to A5 sheets)
//   A4  schedules (openings, lintels, bracing, fixings + areas, stud takeoff)
//   A5  construction details (wall, eave, slab edge, lintel)
//
// Every page carries the watermark "CONCEPT — INDICATIVE, NOT FOR CONSTRUCTION".

import { jsPDF } from "jspdf";
import { useAstral, type AstralState } from "./store";
import { qtys, buildModel } from "./model";
import { buildTakeoff, type Takeoff } from "./takeoff";
import {
  SHEETS, SHEET_INDEX, SHEET_SERIES, COMPASS, PROJECT, getSheetMeta,
} from "./sheet";

// ---------- helpers ----------

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

// ---------- PDF set ----------

type SheetSpec =
  | { kind: "svg"; sheetKey: string; label: string; patch: Partial<AstralState> & { detailFor?: string | null } }
  | { kind: "cover"; sheetKey: "cover"; label: string }
  | { kind: "schedule"; sheetKey: string; label: string; render: (pdf: jsPDF, S: AstralState, T: Takeoff, pageW: number, pageH: number) => void };

function sheetNumber(key: string, face?: string): string {
  const ref = SHEETS[key]?.byFace ? `${key}@${face || "front"}` : key;
  const ix = SHEET_INDEX[ref];
  if (!ix) return key.toUpperCase();
  return `${ix.prefix}.${String(ix.seq).padStart(2, "0")}`;
}

function buildSheetSet(S: AstralState): SheetSpec[] {
  const M = buildModel(S);
  const wallId = `wall-${(S.openings[0]?.wall ?? "S")}`;
  const wallNode = M.byId[wallId] ? wallId : M.byId["wall-S"] ? "wall-S" : "building";
  const firstOpening = S.openings[0] ? `opening-${S.openings[0].id}` : null;

  const set: SheetSpec[] = [];
  set.push({ kind: "cover", sheetKey: "cover", label: "Drawing Register" });

  // A1 plans
  set.push({ kind: "svg", sheetKey: "plan_arch",       label: "Floor Plan",       patch: { view: "plan", layer: "arch",       detailFor: null } });
  set.push({ kind: "svg", sheetKey: "plan_foundation", label: "Foundation Plan",  patch: { view: "plan", layer: "foundation", detailFor: null } });
  set.push({ kind: "svg", sheetKey: "plan_framing",    label: "Framing Plan",     patch: { view: "plan", layer: "framing",    detailFor: null } });
  set.push({ kind: "svg", sheetKey: "plan_services",   label: "Services Plan",    patch: { view: "plan", layer: "services",   detailFor: null } });

  // A2 elevations — arch, framing, foundation × 4 faces
  const faces = ["front", "back", "left", "right"] as const;
  (["arch", "framing", "foundation"] as const).forEach((lyr) => {
    faces.forEach((f) => {
      const key = lyr === "framing" ? "elevation_framing"
        : lyr === "foundation" ? "elevation_foundation"
        : "elevation_arch";
      const compass = COMPASS[f];
      const layerName = lyr === "arch" ? "" : ` (${lyr})`;
      set.push({
        kind: "svg", sheetKey: key,
        label: `${compass} Elevation${layerName}`,
        patch: { view: "elevation", layer: lyr, face: f, detailFor: null },
      });
    });
  });

  // A3 sections
  set.push({ kind: "svg", sheetKey: "section_cross", label: "Cross Section A–A", patch: { view: "section", cut: "cross", detailFor: null } });
  set.push({ kind: "svg", sheetKey: "section_long",  label: "Longitudinal Section B–B", patch: { view: "section", cut: "long",  detailFor: null } });

  // A4 schedules
  set.push({ kind: "schedule", sheetKey: "schedule_openings", label: "Door / Window Schedule", render: renderOpeningsSchedule });
  set.push({ kind: "schedule", sheetKey: "schedule_lintels",  label: "Lintel Schedule",        render: renderLintelSchedule });
  set.push({ kind: "schedule", sheetKey: "schedule_bracing",  label: "Bracing Schedule",       render: renderBracingSchedule });
  set.push({ kind: "schedule", sheetKey: "schedule_areas",    label: "Areas & Fixings",        render: renderAreasFixingsSchedule });
  set.push({ kind: "schedule", sheetKey: "schedule_studs",    label: "Stud Takeoff",           render: renderStudSchedule });

  // A5 details — wall, eave, slab, opening (skip opening if no openings)
  set.push({ kind: "svg", sheetKey: "detail_wall",    label: "Wall Framing Detail", patch: { view: "detail", detailFor: wallNode } });
  set.push({ kind: "svg", sheetKey: "detail_roof",    label: "Eave Detail",         patch: { view: "detail", detailFor: "roof" } });
  set.push({ kind: "svg", sheetKey: "detail_slab",    label: "Slab Edge Detail",    patch: { view: "detail", detailFor: "slab" } });
  if (firstOpening) {
    set.push({ kind: "svg", sheetKey: "detail_opening", label: "Lintel / Head Detail", patch: { view: "detail", detailFor: firstOpening } });
  }
  return set;
}

// ---------- PDF chrome ----------

const INK = "#1d2a2a";
const SOFT = "#7a6f57";
const MUTED = "#9a8f78";
const RULE = "#cfc6b4";
const ACCENT = "#bf6b2c";

function drawWatermark(pdf: jsPDF, pageW: number, pageH: number) {
  pdf.saveGraphicsState();
  try {
    // jsPDF exposes GState on the constructor for opacity control
    const Ctor = (jsPDF as unknown as { GState?: new (o: { opacity: number }) => unknown }).GState;
    if (Ctor) {
      (pdf as unknown as { setGState: (s: unknown) => void }).setGState(new Ctor({ opacity: 0.08 }));
    }
  } catch {
    /* opacity not supported — fall back to faint colour */
  }
  pdf.setTextColor(190, 110, 60);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(64);
  pdf.text(
    "CONCEPT — INDICATIVE, NOT FOR CONSTRUCTION",
    pageW / 2,
    pageH / 2,
    { align: "center", angle: 30 },
  );
  pdf.restoreGraphicsState();
}

type ChromeInfo = {
  sheetNumber: string;
  series: string;
  title: string;
  sub?: string;
  scale: string;
  pageIndex: number;
  pageTotal: number;
};

function drawChrome(pdf: jsPDF, pageW: number, pageH: number, S: AstralState, info: ChromeInfo) {
  const margin = 8;
  // outer frame
  pdf.setDrawColor(INK); pdf.setLineWidth(0.5);
  pdf.rect(margin, margin, pageW - 2 * margin, pageH - 2 * margin);

  // title block band along the bottom
  const tbH = 26;
  const tbY = pageH - margin - tbH;
  pdf.setFillColor(251, 249, 243);
  pdf.rect(margin, tbY, pageW - 2 * margin, tbH, "F");
  pdf.setDrawColor(INK); pdf.setLineWidth(0.4);
  pdf.rect(margin, tbY, pageW - 2 * margin, tbH);
  pdf.line(margin, tbY + 7, pageW - margin, tbY + 7);

  // metadata strip
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
  pdf.setTextColor(SOFT);
  pdf.text("PROJECT ASTRAL · SPATIAL CONSTRUCTION SET", margin + 3, tbY + 5);
  pdf.text(`${info.series} SERIES · ${info.sheetNumber}`, pageW / 2, tbY + 5, { align: "center" });
  pdf.text(`REV ${PROJECT.rev} · ISSUED ${PROJECT.date}`, pageW - margin - 3, tbY + 5, { align: "right" });

  // main strip — identity / project / title / scale / sheet number
  const colW = (pageW - 2 * margin) / 5;
  const cx = (i: number) => margin + i * colW + 3;
  const baseY = tbY + 13;

  pdf.setFontSize(9); pdf.setTextColor(INK); pdf.setFont("helvetica", "bold");
  pdf.text("PROJECT ASTRAL", cx(0), baseY);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5); pdf.setTextColor(SOFT);
  pdf.text(PROJECT.tagline, cx(0), baseY + 4);
  pdf.setTextColor(ACCENT);
  pdf.text(PROJECT.consent, cx(0), baseY + 9);

  // project
  pdf.setFontSize(6.5); pdf.setTextColor(MUTED);
  pdf.text("PROJECT", cx(1), baseY - 3);
  pdf.setTextColor(INK); pdf.setFontSize(8); pdf.setFont("helvetica", "bold");
  pdf.text(`${(S.type || "BUILDING").toUpperCase()} — ${PROJECT.location.toUpperCase()}`, cx(1), baseY + 2);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5); pdf.setTextColor(SOFT);
  pdf.text(`${(S.L / 1000).toFixed(1)} × ${(S.W / 1000).toFixed(1)} m`, cx(1), baseY + 6);
  const hot = S.wind === "Extra High" || S.wind === "Cyclonic (SED)";
  pdf.setTextColor(hot ? ACCENT : SOFT);
  pdf.text(`WIND ZONE — ${S.wind.toUpperCase()}`, cx(1), baseY + 10);

  // drawing
  pdf.setTextColor(MUTED); pdf.setFontSize(6.5);
  pdf.text("DRAWING", cx(2), baseY - 3);
  pdf.setTextColor(INK); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
  pdf.text(info.title.toUpperCase(), cx(2), baseY + 2);
  if (info.sub) {
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5); pdf.setTextColor(ACCENT);
    pdf.text(info.sub.toUpperCase(), cx(2), baseY + 7);
  }

  // scale / date
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5); pdf.setTextColor(MUTED);
  pdf.text("SCALE", cx(3), baseY - 3);
  pdf.setTextColor(INK); pdf.setFontSize(8); pdf.text(info.scale, cx(3), baseY + 2);
  pdf.setTextColor(MUTED); pdf.setFontSize(6.5);
  pdf.text("DATE", cx(3), baseY + 7);
  pdf.setTextColor(INK); pdf.text(PROJECT.date, cx(3), baseY + 11);

  // sheet number
  pdf.setTextColor(MUTED); pdf.setFontSize(6.5); pdf.text("SHEET", cx(4), baseY - 3);
  pdf.setTextColor(INK); pdf.setFont("helvetica", "bold"); pdf.setFontSize(16);
  pdf.text(info.sheetNumber, cx(4), baseY + 6);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5); pdf.setTextColor(MUTED);
  pdf.text(`${info.pageIndex} / ${info.pageTotal}`, cx(4), baseY + 11);

  drawWatermark(pdf, pageW, pageH);
}

// ---------- schedule renderers ----------

function tableHeader(pdf: jsPDF, x: number, y: number, cols: { label: string; w: number; align?: "L" | "R" | "C" }[]) {
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.setTextColor(INK);
  let cx = x;
  cols.forEach((c) => {
    const tx = c.align === "R" ? cx + c.w - 1 : c.align === "C" ? cx + c.w / 2 : cx + 1;
    pdf.text(c.label, tx, y, { align: c.align === "R" ? "right" : c.align === "C" ? "center" : "left" });
    cx += c.w;
  });
  pdf.setDrawColor(INK); pdf.setLineWidth(0.4);
  pdf.line(x, y + 1.2, x + cols.reduce((a, c) => a + c.w, 0), y + 1.2);
}

function tableRow(
  pdf: jsPDF, x: number, y: number,
  cols: { value: string; w: number; align?: "L" | "R" | "C" }[],
) {
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); pdf.setTextColor(INK);
  let cx = x;
  cols.forEach((c) => {
    const tx = c.align === "R" ? cx + c.w - 1 : c.align === "C" ? cx + c.w / 2 : cx + 1;
    pdf.text(c.value, tx, y, { align: c.align === "R" ? "right" : c.align === "C" ? "center" : "left" });
    cx += c.w;
  });
  pdf.setDrawColor(RULE); pdf.setLineWidth(0.15);
  pdf.line(x, y + 1.2, x + cols.reduce((a, c) => a + c.w, 0), y + 1.2);
}

function scheduleHeader(pdf: jsPDF, pageW: number, title: string, note: string) {
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.setTextColor(INK);
  pdf.text(title, 16, 22);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(SOFT);
  pdf.text(note, 16, 28);
  pdf.setDrawColor(INK); pdf.setLineWidth(0.4);
  pdf.line(16, 31, pageW - 16, 31);
}

function renderOpeningsSchedule(pdf: jsPDF, _S: AstralState, T: Takeoff, pageW: number) {
  scheduleHeader(pdf, pageW, "DOOR / WINDOW SCHEDULE", "Indicative — refer to joinery supplier for confirmation");
  const cols = [
    { label: "REF",    w: 14, align: "L" as const },
    { label: "TYPE",   w: 22 },
    { label: "WALL",   w: 24 },
    { label: "W (mm)", w: 20, align: "R" as const },
    { label: "H (mm)", w: 20, align: "R" as const },
    { label: "HEAD",   w: 20, align: "R" as const },
    { label: "SILL",   w: 20, align: "R" as const },
    { label: "OFFSET", w: 22, align: "R" as const },
    { label: "AREA m²", w: 22, align: "R" as const },
  ];
  tableHeader(pdf, 16, 40, cols);
  let y = 46;
  T.openings.forEach((o) => {
    tableRow(pdf, 16, y, [
      { value: o.ref, w: 14 },
      { value: o.kind, w: 22 },
      { value: o.wallName, w: 24 },
      { value: String(o.width_mm), w: 20, align: "R" },
      { value: String(o.height_mm), w: 20, align: "R" },
      { value: String(o.head_mm), w: 20, align: "R" },
      { value: String(o.sill_mm), w: 20, align: "R" },
      { value: String(o.off_mm), w: 22, align: "R" },
      { value: o.area_m2.toFixed(2), w: 22, align: "R" },
    ]);
    y += 5;
  });
}

function renderLintelSchedule(pdf: jsPDF, _S: AstralState, T: Takeoff, pageW: number) {
  scheduleHeader(pdf, pageW, "LINTEL SCHEDULE", "Per NZS 3604 Table 8.10 — SED items flagged for engineer review");
  const cols = [
    { label: "REF",     w: 14 },
    { label: "SIZE",    w: 80 },
    { label: "SPAN mm", w: 25, align: "R" as const },
    { label: "COUNT",   w: 20, align: "R" as const },
    { label: "EACH mm", w: 25, align: "R" as const },
    { label: "TOTAL lm", w: 25, align: "R" as const },
    { label: "STATUS",  w: 25 },
  ];
  tableHeader(pdf, 16, 40, cols);
  let y = 46;
  T.lintels.forEach((l) => {
    tableRow(pdf, 16, y, [
      { value: l.ref, w: 14 },
      { value: l.size, w: 80 },
      { value: String(l.span_mm), w: 25, align: "R" },
      { value: String(l.count), w: 20, align: "R" },
      { value: String(l.length_per_mm), w: 25, align: "R" },
      { value: l.total_lm.toFixed(2), w: 25, align: "R" },
      { value: l.sed ? "SED" : "3604", w: 25 },
    ]);
    y += 5;
  });
}

function renderBracingSchedule(pdf: jsPDF, _S: AstralState, T: Takeoff, pageW: number) {
  scheduleHeader(pdf, pageW, "BRACING SCHEDULE", `Indicative P21 panels — total ${T.bracingTotalBU} BU achieved`);
  const cols = [
    { label: "WALL",          w: 30 },
    { label: "LENGTH mm",     w: 30, align: "R" as const },
    { label: "AVAILABLE mm",  w: 30, align: "R" as const },
    { label: "PANELS",        w: 25, align: "R" as const },
    { label: "BU",            w: 25, align: "R" as const },
    { label: "STATUS",        w: 30 },
  ];
  tableHeader(pdf, 16, 40, cols);
  let y = 46;
  T.bracing.forEach((b) => {
    tableRow(pdf, 16, y, [
      { value: b.wallName, w: 30 },
      { value: String(b.length_mm), w: 30, align: "R" },
      { value: String(b.available_mm), w: 30, align: "R" },
      { value: String(b.panels), w: 25, align: "R" },
      { value: String(b.bu), w: 25, align: "R" },
      { value: b.sed ? "Portal req." : "P21 OK", w: 30 },
    ]);
    y += 5;
  });
}

function renderAreasFixingsSchedule(pdf: jsPDF, _S: AstralState, T: Takeoff, pageW: number) {
  scheduleHeader(pdf, pageW, "AREAS & FIXINGS", "Wastage allowance baked into order quantities");
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.setTextColor(INK);
  pdf.text("CLADDING / LINING / ROOFING (m²)", 16, 38);
  const colsA = [
    { label: "ITEM",      w: 50 },
    { label: "GROSS",     w: 22, align: "R" as const },
    { label: "OPENINGS",  w: 25, align: "R" as const },
    { label: "NET",       w: 22, align: "R" as const },
    { label: "WASTE %",   w: 22, align: "R" as const },
    { label: "ORDER",     w: 22, align: "R" as const },
    { label: "SPEC",      w: 60 },
  ];
  tableHeader(pdf, 16, 44, colsA);
  let y = 50;
  T.areas.forEach((a) => {
    tableRow(pdf, 16, y, [
      { value: a.item, w: 50 },
      { value: a.gross_m2.toFixed(1), w: 22, align: "R" },
      { value: a.openings_m2.toFixed(1), w: 25, align: "R" },
      { value: a.net_m2.toFixed(1), w: 22, align: "R" },
      { value: String(a.waste_pct), w: 22, align: "R" },
      { value: a.order_m2.toFixed(1), w: 22, align: "R" },
      { value: a.spec, w: 60 },
    ]);
    y += 5;
  });

  y += 6;
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.setTextColor(INK);
  pdf.text("FIXINGS / FASTENERS", 16, y);
  y += 6;
  const colsB = [
    { label: "ITEM",  w: 130 },
    { label: "QTY",   w: 25, align: "R" as const },
    { label: "UNIT",  w: 20, align: "L" as const },
    { label: "NOTE",  w: 60 },
  ];
  tableHeader(pdf, 16, y, colsB);
  y += 6;
  T.fixings.forEach((f) => {
    tableRow(pdf, 16, y, [
      { value: f.item, w: 130 },
      { value: String(f.qty), w: 25, align: "R" },
      { value: f.unit, w: 20 },
      { value: f.note, w: 60 },
    ]);
    y += 5;
  });
}

function renderStudSchedule(pdf: jsPDF, S: AstralState, T: Takeoff, pageW: number) {
  scheduleHeader(
    pdf, pageW, "STUD TAKEOFF",
    `Studs @${S.spacing}mm c/c, ${T.studTotals.size} — totals: ${T.studTotals.studs_pcs} studs · ${T.studTotals.plates_lm}lm plates · ${T.studTotals.nogs_lm}lm nogs`,
  );
  const cols = [
    { label: "WALL",     w: 28 },
    { label: "LENGTH mm", w: 24, align: "R" as const },
    { label: "COMMON",   w: 22, align: "R" as const },
    { label: "JACK",     w: 20, align: "R" as const },
    { label: "TRIMMER",  w: 22, align: "R" as const },
    { label: "CORNER",   w: 22, align: "R" as const },
    { label: "PLATES lm", w: 22, align: "R" as const },
    { label: "NOGS lm",   w: 22, align: "R" as const },
  ];
  tableHeader(pdf, 16, 40, cols);
  let y = 46;
  T.studs.forEach((s) => {
    tableRow(pdf, 16, y, [
      { value: s.wallName, w: 28 },
      { value: String(s.length_mm), w: 24, align: "R" },
      { value: String(s.common), w: 22, align: "R" },
      { value: String(s.jack), w: 20, align: "R" },
      { value: String(s.trimmer), w: 22, align: "R" },
      { value: String(s.corner), w: 22, align: "R" },
      { value: s.plates_lm.toFixed(2), w: 22, align: "R" },
      { value: s.nogs_lm.toFixed(2), w: 22, align: "R" },
    ]);
    y += 5;
  });
}

// ---------- cover / register ----------

function renderCover(pdf: jsPDF, S: AstralState, registry: { number: string; series: string; title: string }[], pageW: number, pageH: number) {
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(22); pdf.setTextColor(INK);
  pdf.text("PROJECT ASTRAL", 16, 30);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(SOFT);
  pdf.text("Spatial construction set — building consent (concept)", 16, 37);

  pdf.setDrawColor(INK); pdf.setLineWidth(0.4);
  pdf.line(16, 42, pageW - 16, 42);

  // Project summary
  const q = qtys(S);
  pdf.setFontSize(9); pdf.setTextColor(INK);
  const rows = [
    ["Project type", S.type],
    ["Location", PROJECT.location],
    ["Footprint", `${(S.L / 1000).toFixed(1)} × ${(S.W / 1000).toFixed(1)} m  (${q.floorA} m² floor)`],
    ["Wind zone", S.wind],
    ["Foundation", S.found],
    ["Roof", `${S.roof}  ${S.pitch}°  · ${S.cover} (${S.roofCol})`],
    ["Cladding", `${S.clad} · ${S.cladCol}`],
    ["Joinery", S.joinery],
    ["Insulation", S.insul],
    ["Issue", `${PROJECT.status} · REV ${PROJECT.rev} · ${PROJECT.date}`],
  ];
  let y = 50;
  rows.forEach(([k, v]) => {
    pdf.setTextColor(MUTED); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
    pdf.text(k.toUpperCase(), 16, y);
    pdf.setTextColor(INK); pdf.setFontSize(9);
    pdf.text(String(v), 60, y);
    y += 6;
  });

  // Drawing register table
  const tableY = y + 4;
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(INK);
  pdf.text("DRAWING REGISTER", 16, tableY);
  const cols = [
    { label: "SHEET",  w: 28 },
    { label: "SERIES", w: 36 },
    { label: "TITLE",  w: 200 },
  ];
  tableHeader(pdf, 16, tableY + 8, cols);
  let ry = tableY + 14;
  registry.forEach((r) => {
    if (ry > pageH - 40) return;
    tableRow(pdf, 16, ry, [
      { value: r.number, w: 28 },
      { value: r.series, w: 36 },
      { value: r.title, w: 200 },
    ]);
    ry += 5;
  });

  // Disclaimer
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.setTextColor(ACCENT);
  pdf.text("CONCEPT — INDICATIVE, NOT FOR CONSTRUCTION", 16, pageH - 40);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(SOFT);
  pdf.text(
    "This set is a parametric concept generated by Project Astral. Quantities, spans, and details are indicative only and must be confirmed by a licensed design professional and/or engineer before construction. SED items require PS1.",
    16, pageH - 34, { maxWidth: pageW - 32 },
  );
}

// ---------- main export ----------

export async function exportAllPDF(filename = "astral-set.pdf"): Promise<void> {
  const store = useAstral.getState();
  const orig: Partial<AstralState> = {
    view: store.view, layer: store.layer, face: store.face,
    cut: store.cut, detailFor: store.detailFor,
  };

  const set = buildSheetSet(store);
  const takeoff = buildTakeoff(store);

  const pdf = new jsPDF({ orientation: "landscape", format: "a3", unit: "mm" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const tbH = 26;
  const drawAreaY = margin + 4;
  const drawAreaH = pageH - 2 * margin - tbH - 6;
  const drawAreaW = pageW - 2 * margin - 6;

  // Pre-compute registry for cover
  const registry = set.slice(1).map((s) => {
    const face = s.kind === "svg" ? (s.patch.face as string | undefined) : undefined;
    return {
      number: sheetNumber(s.sheetKey, face),
      series: SHEET_SERIES[SHEETS[s.sheetKey]?.prefix || "A0"] || "",
      title: s.label,
    };
  });

  try {
    for (let i = 0; i < set.length; i++) {
      const sheet = set[i];
      if (i > 0) pdf.addPage();
      const pageIndex = i + 1;

      if (sheet.kind === "cover") {
        renderCover(pdf, store, registry, pageW, pageH);
        drawChrome(pdf, pageW, pageH, store, {
          sheetNumber: sheetNumber("cover"),
          series: SHEET_SERIES.A0,
          title: "Drawing Register",
          scale: "NTS",
          pageIndex, pageTotal: set.length,
        });
        continue;
      }

      if (sheet.kind === "schedule") {
        sheet.render(pdf, store, takeoff, pageW, pageH);
        drawChrome(pdf, pageW, pageH, store, {
          sheetNumber: sheetNumber(sheet.sheetKey),
          series: SHEET_SERIES[SHEETS[sheet.sheetKey]?.prefix || "A4"],
          title: SHEETS[sheet.sheetKey]?.title || sheet.label,
          scale: "NTS",
          pageIndex, pageTotal: set.length,
        });
        continue;
      }

      // svg sheet — drive the live canvas, then snapshot
      useAstral.getState().patch(sheet.patch);
      await nextFrame(); await nextFrame();
      // small extra settle for canvases with measurement-derived geometry
      await new Promise((r) => setTimeout(r, 30));
      const svg = findActiveSvg();
      if (!svg) continue;
      const png = await svgToPng(svg, 2);
      const vb = svg.viewBox.baseVal;
      const ar = (vb.width || 628) / (vb.height || 540);
      let w = drawAreaW, h = drawAreaW / ar;
      if (h > drawAreaH) { h = drawAreaH; w = h * ar; }
      pdf.addImage(png, "PNG", (pageW - w) / 2, drawAreaY, w, h);

      // chrome on top
      const meta = getSheetMeta(useAstral.getState());
      drawChrome(pdf, pageW, pageH, store, {
        sheetNumber: sheetNumber(sheet.sheetKey, sheet.patch.face as string | undefined),
        series: meta.series,
        title: SHEETS[sheet.sheetKey]?.title || sheet.label,
        sub: meta.sub || undefined,
        scale: SHEETS[sheet.sheetKey]?.scale || meta.scale,
        pageIndex, pageTotal: set.length,
      });
    }

    pdf.save(filename);
  } finally {
    useAstral.getState().patch(orig);
  }
}

// ---------- CSV (unchanged) ----------

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
