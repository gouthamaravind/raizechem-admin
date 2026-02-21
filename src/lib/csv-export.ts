export function exportToCsv(
  filename: string,
  rows: Record<string, any>[],
  columns: { key: string; label: string }[]
) {
  const header = columns.map((c) => `"${c.label}"`).join(",");
  const csv = rows
    .map((row) =>
      columns
        .map((c) => {
          const val = String(row[c.key] ?? "").replace(/"/g, '""');
          return `"${val}"`;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob([header + "\n" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
