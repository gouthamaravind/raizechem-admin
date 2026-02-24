import * as XLSX from "xlsx";

export function exportToXlsx(
  filename: string,
  rows: Record<string, any>[],
  columns: { key: string; label: string }[]
) {
  const header = columns.map((c) => c.label);
  const data = rows.map((row) => columns.map((c) => row[c.key] ?? ""));
  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);

  // Auto-width columns
  ws["!cols"] = columns.map((c, i) => {
    const maxLen = Math.max(
      c.label.length,
      ...data.map((r) => String(r[i] ?? "").length)
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, filename);
}
