/**
 * GSTR-1 JSON generator — produces JSON in the exact format accepted by the GST portal.
 * Sections: B2B, B2CS, HSN, CDNR
 */

type InvoiceItem = {
  invoices: {
    invoice_number: string;
    invoice_date: string;
    dealer_id: string;
    total_amount?: number;
    dealers: { name: string; gst_number: string | null; state_code: string | null };
  };
  products: { name: string };
  hsn_code: string | null;
  qty: number;
  rate: number;
  amount: number;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
};

type CreditNoteItem = {
  credit_notes: {
    credit_note_number: string;
    credit_date: string;
    dealer_id: string;
    invoice_id: string;
    dealers: { name: string; gst_number: string | null };
    invoices?: { invoice_number: string; invoice_date: string };
  };
  products: { name: string };
  hsn_code: string | null;
  qty: number;
  rate: number;
  amount: number;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
};

function formatDate(dateStr: string): string {
  // Convert YYYY-MM-DD to DD-MM-YYYY
  const [y, m, d] = dateStr.split("-");
  return `${d}-${m}-${y}`;
}

/**
 * Generate B2B section — supplies to registered dealers (with GSTIN)
 */
function generateB2B(items: InvoiceItem[]) {
  // Group by GSTIN then by invoice
  const gstinMap: Record<string, Record<string, InvoiceItem[]>> = {};

  items.forEach((it) => {
    const gstin = it.invoices?.dealers?.gst_number;
    if (!gstin) return; // Skip unregistered
    const invNum = it.invoices.invoice_number;
    if (!gstinMap[gstin]) gstinMap[gstin] = {};
    if (!gstinMap[gstin][invNum]) gstinMap[gstin][invNum] = [];
    gstinMap[gstin][invNum].push(it);
  });

  return Object.entries(gstinMap).map(([gstin, invoices]) => ({
    ctin: gstin,
    inv: Object.entries(invoices).map(([invNum, invItems]) => {
      const first = invItems[0];
      const invVal = invItems.reduce((s, i) => s + Number(i.total_amount), 0);
      // Group items by GST rate
      const rateMap: Record<number, { taxableVal: number; cgst: number; sgst: number; igst: number }> = {};
      invItems.forEach((it) => {
        const rate = Number(it.gst_rate);
        if (!rateMap[rate]) rateMap[rate] = { taxableVal: 0, cgst: 0, sgst: 0, igst: 0 };
        rateMap[rate].taxableVal += Number(it.amount);
        rateMap[rate].cgst += Number(it.cgst_amount);
        rateMap[rate].sgst += Number(it.sgst_amount);
        rateMap[rate].igst += Number(it.igst_amount);
      });

      return {
        inum: invNum,
        idt: formatDate(first.invoices.invoice_date),
        val: Math.round(invVal * 100) / 100,
        pos: first.invoices.dealers?.state_code || "36",
        rchrg: "N",
        inv_typ: "R",
        itms: Object.entries(rateMap).map(([rate, vals]) => ({
          num: 0,
          itm_det: {
            rt: Number(rate),
            txval: Math.round(vals.taxableVal * 100) / 100,
            camt: Math.round(vals.cgst * 100) / 100,
            samt: Math.round(vals.sgst * 100) / 100,
            iamt: Math.round(vals.igst * 100) / 100,
            csamt: 0,
          },
        })),
      };
    }),
  }));
}

/**
 * Generate B2CS section — supplies to unregistered consumers (no GSTIN)
 */
function generateB2CS(items: InvoiceItem[]) {
  const unregistered = items.filter((it) => !it.invoices?.dealers?.gst_number);
  
  // Group by state code + GST rate
  const map: Record<string, { taxableVal: number; cgst: number; sgst: number; igst: number; stateCode: string; rate: number }> = {};
  unregistered.forEach((it) => {
    const stateCode = it.invoices?.dealers?.state_code || "36";
    const rate = Number(it.gst_rate);
    const key = `${stateCode}-${rate}`;
    if (!map[key]) map[key] = { taxableVal: 0, cgst: 0, sgst: 0, igst: 0, stateCode, rate };
    map[key].taxableVal += Number(it.amount);
    map[key].cgst += Number(it.cgst_amount);
    map[key].sgst += Number(it.sgst_amount);
    map[key].igst += Number(it.igst_amount);
  });

  return Object.values(map).map((v) => ({
    sply_ty: v.stateCode === "36" ? "INTRA" : "INTER",
    pos: v.stateCode,
    typ: "OE",
    rt: v.rate,
    txval: Math.round(v.taxableVal * 100) / 100,
    camt: Math.round(v.cgst * 100) / 100,
    samt: Math.round(v.sgst * 100) / 100,
    iamt: Math.round(v.igst * 100) / 100,
    csamt: 0,
  }));
}

/**
 * Generate HSN section
 */
function generateHSN(items: InvoiceItem[]) {
  const map: Record<string, { hsn: string; qty: number; txval: number; camt: number; samt: number; iamt: number; rt: number; uqc: string }> = {};
  items.forEach((it) => {
    const hsn = it.hsn_code || "N/A";
    const rate = Number(it.gst_rate);
    const key = `${hsn}-${rate}`;
    if (!map[key]) map[key] = { hsn, qty: 0, txval: 0, camt: 0, samt: 0, iamt: 0, rt: rate, uqc: "KGS" };
    map[key].qty += Number(it.qty);
    map[key].txval += Number(it.amount);
    map[key].camt += Number(it.cgst_amount);
    map[key].samt += Number(it.sgst_amount);
    map[key].iamt += Number(it.igst_amount);
  });

  return {
    data: Object.values(map).map((v) => ({
      num: 0,
      hsn_sc: v.hsn,
      uqc: v.uqc,
      qty: Math.round(v.qty * 100) / 100,
      rt: v.rt,
      txval: Math.round(v.txval * 100) / 100,
      camt: Math.round(v.camt * 100) / 100,
      samt: Math.round(v.samt * 100) / 100,
      iamt: Math.round(v.iamt * 100) / 100,
      csamt: 0,
    })),
  };
}

/**
 * Generate CDNR section — credit/debit notes to registered dealers
 */
function generateCDNR(cnItems: CreditNoteItem[]) {
  const gstinMap: Record<string, CreditNoteItem[]> = {};
  cnItems.forEach((it) => {
    const gstin = it.credit_notes?.dealers?.gst_number;
    if (!gstin) return;
    if (!gstinMap[gstin]) gstinMap[gstin] = [];
    gstinMap[gstin].push(it);
  });

  return Object.entries(gstinMap).map(([gstin, noteItems]) => {
    // Group by credit note number
    const cnMap: Record<string, CreditNoteItem[]> = {};
    noteItems.forEach((it) => {
      const cnNum = it.credit_notes.credit_note_number;
      if (!cnMap[cnNum]) cnMap[cnNum] = [];
      cnMap[cnNum].push(it);
    });

    return {
      ctin: gstin,
      nt: Object.entries(cnMap).map(([cnNum, items]) => {
        const first = items[0];
        const val = items.reduce((s, i) => s + Number(i.total_amount), 0);

        const rateMap: Record<number, { txval: number; camt: number; samt: number; iamt: number }> = {};
        items.forEach((it) => {
          const rate = Number(it.gst_rate);
          if (!rateMap[rate]) rateMap[rate] = { txval: 0, camt: 0, samt: 0, iamt: 0 };
          rateMap[rate].txval += Number(it.amount);
          rateMap[rate].camt += Number(it.cgst_amount);
          rateMap[rate].samt += Number(it.sgst_amount);
          rateMap[rate].iamt += Number(it.igst_amount);
        });

        return {
          ntty: "C",
          nt_num: cnNum,
          nt_dt: formatDate(first.credit_notes.credit_date),
          val: Math.round(val * 100) / 100,
          pos: "36",
          rchrg: "N",
          inv_typ: "R",
          itms: Object.entries(rateMap).map(([rate, vals]) => ({
            num: 0,
            itm_det: {
              rt: Number(rate),
              txval: Math.round(vals.txval * 100) / 100,
              camt: Math.round(vals.camt * 100) / 100,
              samt: Math.round(vals.samt * 100) / 100,
              iamt: Math.round(vals.iamt * 100) / 100,
              csamt: 0,
            },
          })),
        };
      }),
    };
  });
}

export function generateGSTR1JSON(
  gstin: string,
  fp: string, // filing period MMYYYY
  items: InvoiceItem[],
  cnItems: CreditNoteItem[]
) {
  return {
    gstin,
    fp,
    b2b: generateB2B(items),
    b2cs: generateB2CS(items),
    hsn: generateHSN(items),
    cdnr: generateCDNR(cnItems),
  };
}

/**
 * GSTR-3B Table calculations
 */
export function calculateGSTR3B(
  salesItems: InvoiceItem[],
  cnItems: CreditNoteItem[],
  purchaseItems: { amount: number; cgst_amount: number; sgst_amount: number; igst_amount: number; total_amount: number }[]
) {
  // Table 3.1 — Outward supplies
  const outwardTaxable = salesItems.reduce((s, i) => s + Number(i.amount), 0);
  const outwardCGST = salesItems.reduce((s, i) => s + Number(i.cgst_amount), 0);
  const outwardSGST = salesItems.reduce((s, i) => s + Number(i.sgst_amount), 0);
  const outwardIGST = salesItems.reduce((s, i) => s + Number(i.igst_amount), 0);

  // Separate intra-state vs inter-state for Table 3.2
  const interStateItems = salesItems.filter((i) => Number(i.igst_amount) > 0);
  const intraStateItems = salesItems.filter((i) => Number(i.cgst_amount) > 0);

  const interStateTaxable = interStateItems.reduce((s, i) => s + Number(i.amount), 0);
  const interStateIGST = interStateItems.reduce((s, i) => s + Number(i.igst_amount), 0);
  const intraStateTaxable = intraStateItems.reduce((s, i) => s + Number(i.amount), 0);
  const intraStateCGST = intraStateItems.reduce((s, i) => s + Number(i.cgst_amount), 0);
  const intraStateSGST = intraStateItems.reduce((s, i) => s + Number(i.sgst_amount), 0);

  // Credit notes deduction
  const cnTaxable = cnItems.reduce((s, i) => s + Number(i.amount), 0);
  const cnCGST = cnItems.reduce((s, i) => s + Number(i.cgst_amount), 0);
  const cnSGST = cnItems.reduce((s, i) => s + Number(i.sgst_amount), 0);
  const cnIGST = cnItems.reduce((s, i) => s + Number(i.igst_amount), 0);

  // Table 4 — Eligible ITC from purchases
  const itcIGST = purchaseItems.reduce((s, i) => s + Number(i.igst_amount), 0);
  const itcCGST = purchaseItems.reduce((s, i) => s + Number(i.cgst_amount), 0);
  const itcSGST = purchaseItems.reduce((s, i) => s + Number(i.sgst_amount), 0);

  // Net tax payable
  const netCGST = Math.max(0, (outwardCGST - cnCGST) - itcCGST);
  const netSGST = Math.max(0, (outwardSGST - cnSGST) - itcSGST);
  const netIGST = Math.max(0, (outwardIGST - cnIGST) - itcIGST);

  return {
    table3_1: {
      taxable_value: Math.round(outwardTaxable * 100) / 100,
      igst: Math.round(outwardIGST * 100) / 100,
      cgst: Math.round(outwardCGST * 100) / 100,
      sgst: Math.round(outwardSGST * 100) / 100,
    },
    table3_2: {
      inter_state: {
        taxable_value: Math.round(interStateTaxable * 100) / 100,
        igst: Math.round(interStateIGST * 100) / 100,
      },
      intra_state: {
        taxable_value: Math.round(intraStateTaxable * 100) / 100,
        cgst: Math.round(intraStateCGST * 100) / 100,
        sgst: Math.round(intraStateSGST * 100) / 100,
      },
    },
    credit_notes: {
      taxable_value: Math.round(cnTaxable * 100) / 100,
      igst: Math.round(cnIGST * 100) / 100,
      cgst: Math.round(cnCGST * 100) / 100,
      sgst: Math.round(cnSGST * 100) / 100,
    },
    table4_itc: {
      igst: Math.round(itcIGST * 100) / 100,
      cgst: Math.round(itcCGST * 100) / 100,
      sgst: Math.round(itcSGST * 100) / 100,
    },
    net_tax_payable: {
      igst: Math.round(netIGST * 100) / 100,
      cgst: Math.round(netCGST * 100) / 100,
      sgst: Math.round(netSGST * 100) / 100,
      total: Math.round((netIGST + netCGST + netSGST) * 100) / 100,
    },
  };
}

export function downloadJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
