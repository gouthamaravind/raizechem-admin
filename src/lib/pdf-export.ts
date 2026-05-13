import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";

export interface PdfTableOpts {
  title: string;
  subtitle?: string;
  filename: string;
  columns: string[];
  rows: RowInput[];
  footerSummary?: { label: string; value: string }[];
}

/**
 * Generic table-to-PDF exporter used for ledgers, daybook, and registers.
 * Filename convention: caller passes the final filename (e.g. `dealer_name.pdf`).
 */
export function exportTablePdf(opts: PdfTableOpts) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(opts.title, pageWidth / 2, 36, { align: "center" });

  if (opts.subtitle) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(opts.subtitle, pageWidth / 2, 52, { align: "center" });
  }

  autoTable(doc, {
    startY: opts.subtitle ? 66 : 50,
    head: [opts.columns],
    body: opts.rows,
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 28, right: 28 },
  });

  if (opts.footerSummary?.length) {
    const finalY = (doc as any).lastAutoTable?.finalY ?? 80;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    let y = finalY + 18;
    opts.footerSummary.forEach((f) => {
      doc.text(`${f.label}: ${f.value}`, pageWidth - 28, y, { align: "right" });
      y += 14;
    });
  }

  doc.save(opts.filename);
}

export function safeFileSlug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}
