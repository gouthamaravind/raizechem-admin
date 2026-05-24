export const COMPANY_STATE_CODE = "36"; // Telangana — legacy default, prefer dynamic

export function calculateGST(
  taxableAmount: number,
  gstRate: number,
  dealerStateCode: string | null,
  companyStateCode: string = COMPANY_STATE_CODE
) {
  const isIntraState = dealerStateCode === companyStateCode;
  
  // Use integer-based math for precision: work in paise (cent-equivalent)
  const taxablePaise = Math.round(taxableAmount * 100);
  const gstPaise = Math.round((taxablePaise * gstRate) / 100);
  const gstAmount = gstPaise / 100;

  let cgst = 0, sgst = 0, igst = 0;
  if (isIntraState) {
    // Split paise evenly, handle odd paise by giving 1 extra to SGST to ensure balancing
    const cgstPaise = Math.floor(gstPaise / 2);
    const sgstPaise = gstPaise - cgstPaise;
    cgst = cgstPaise / 100;
    sgst = sgstPaise / 100;
  } else {
    igst = gstAmount;
  }

  const totalWithGst = (taxablePaise + gstPaise) / 100;

  return {
    cgst,
    sgst,
    igst,
    totalGst: gstAmount,
    totalWithGst,
  };
}
