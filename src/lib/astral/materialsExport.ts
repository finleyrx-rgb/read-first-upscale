// Materials/schedule exporters — CSV + XLSX.

import * as XLSX from "xlsx";
import type { AstralState } from "./store";
import { buildTakeoff } from "./takeoff";

function downloadBlob(data: BlobPart, filename: string, mime: string) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

export function exportMaterialsCSV(S: AstralState, filename = "astral-materials.csv"): void {
  const t = buildTakeoff(S);
  const out: (string | number)[][] = [];
  const section = (title: string) => {
    out.push([]);
    out.push([title]);
  };

  section("STUDS BY WALL");
  out.push([
    "Wall",
    "Length (mm)",
    "Height (mm)",
    "Spacing",
    "Size",
    "Common",
    "Jack",
    "Trimmer",
    "Corner",
    "Nogs (lm)",
    "Plates (lm)",
  ]);
  t.studs.forEach((l) =>
    out.push([
      l.wallName,
      l.length_mm,
      l.height_mm,
      l.spacing_mm,
      l.size,
      l.common,
      l.jack,
      l.trimmer,
      l.corner,
      l.nogs_lm,
      l.plates_lm,
    ]),
  );
  out.push([
    "TOTAL",
    "",
    "",
    "",
    t.studTotals.size,
    t.studTotals.studs_pcs,
    "",
    "",
    "",
    t.studTotals.nogs_lm,
    t.studTotals.plates_lm,
  ]);

  section("DOOR / WINDOW SCHEDULE");
  out.push([
    "Ref",
    "Kind",
    "Wall",
    "Width (mm)",
    "Height (mm)",
    "Head (mm)",
    "Sill (mm)",
    "Off (mm)",
    "Area (m²)",
  ]);
  t.openings.forEach((o) =>
    out.push([
      o.ref,
      o.kind,
      o.wallName,
      o.width_mm,
      o.height_mm,
      o.head_mm,
      o.sill_mm,
      o.off_mm,
      o.area_m2,
    ]),
  );

  section("LINTEL SCHEDULE");
  out.push(["Ref", "Size", "Span (mm)", "Count", "Length each (mm)", "Total (lm)", "SED"]);
  t.lintels.forEach((r) =>
    out.push([r.ref, r.size, r.span_mm, r.count, r.length_per_mm, r.total_lm, r.sed ? "yes" : ""]),
  );

  section("BRACING SCHEDULE (indicative)");
  out.push(["Wall", "Length (mm)", "Available (mm)", "Panels", "BU", "SED"]);
  t.bracing.forEach((b) =>
    out.push([b.wallName, b.length_mm, b.available_mm, b.panels, b.bu, b.sed ? "yes" : ""]),
  );
  out.push(["TOTAL", "", "", "", t.bracingTotalBU, ""]);

  section("FIXINGS");
  out.push(["Item", "Qty", "Unit", "Note"]);
  t.fixings.forEach((f) => out.push([f.item, f.qty, f.unit, f.note]));

  section("CLADDING / LINING / ROOFING (with wastage)");
  out.push(["Item", "Gross (m²)", "Openings (m²)", "Net (m²)", "Waste %", "Order (m²)", "Spec"]);
  t.areas.forEach((a) =>
    out.push([a.item, a.gross_m2, a.openings_m2, a.net_m2, a.waste_pct, a.order_m2, a.spec]),
  );

  downloadBlob(toCsv(out), filename, "text/csv;charset=utf-8");
}

export function exportMaterialsXLSX(S: AstralState, filename = "astral-materials.xlsx"): void {
  const t = buildTakeoff(S);
  const wb = XLSX.utils.book_new();

  const studAOA: (string | number)[][] = [
    [
      "Wall",
      "Length (mm)",
      "Height (mm)",
      "Spacing",
      "Size",
      "Common",
      "Jack",
      "Trimmer",
      "Corner",
      "Nogs (lm)",
      "Plates (lm)",
    ],
    ...t.studs.map((l) => [
      l.wallName,
      l.length_mm,
      l.height_mm,
      l.spacing_mm,
      l.size,
      l.common,
      l.jack,
      l.trimmer,
      l.corner,
      l.nogs_lm,
      l.plates_lm,
    ]),
    [
      "TOTAL",
      "",
      "",
      "",
      t.studTotals.size,
      t.studTotals.studs_pcs,
      "",
      "",
      "",
      t.studTotals.nogs_lm,
      t.studTotals.plates_lm,
    ],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(studAOA), "Studs");

  const openAOA: (string | number)[][] = [
    [
      "Ref",
      "Kind",
      "Wall",
      "Width (mm)",
      "Height (mm)",
      "Head (mm)",
      "Sill (mm)",
      "Off (mm)",
      "Area (m²)",
    ],
    ...t.openings.map((o) => [
      o.ref,
      o.kind,
      o.wallName,
      o.width_mm,
      o.height_mm,
      o.head_mm,
      o.sill_mm,
      o.off_mm,
      o.area_m2,
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(openAOA), "Doors & Windows");

  const lintAOA: (string | number)[][] = [
    ["Ref", "Size", "Span (mm)", "Count", "Length each (mm)", "Total (lm)", "SED"],
    ...t.lintels.map((r) => [
      r.ref,
      r.size,
      r.span_mm,
      r.count,
      r.length_per_mm,
      r.total_lm,
      r.sed ? "yes" : "",
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lintAOA), "Lintels");

  const brAOA: (string | number)[][] = [
    ["Wall", "Length (mm)", "Available (mm)", "Panels", "BU", "SED"],
    ...t.bracing.map((b) => [
      b.wallName,
      b.length_mm,
      b.available_mm,
      b.panels,
      b.bu,
      b.sed ? "yes" : "",
    ]),
    ["TOTAL", "", "", "", t.bracingTotalBU, ""],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(brAOA), "Bracing");

  const fxAOA: (string | number)[][] = [
    ["Item", "Qty", "Unit", "Note"],
    ...t.fixings.map((f) => [f.item, f.qty, f.unit, f.note]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fxAOA), "Fixings");

  const arAOA: (string | number)[][] = [
    ["Item", "Gross (m²)", "Openings (m²)", "Net (m²)", "Waste %", "Order (m²)", "Spec"],
    ...t.areas.map((a) => [
      a.item,
      a.gross_m2,
      a.openings_m2,
      a.net_m2,
      a.waste_pct,
      a.order_m2,
      a.spec,
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(arAOA), "Cladding & Lining");

  const ab = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  downloadBlob(ab, filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}
