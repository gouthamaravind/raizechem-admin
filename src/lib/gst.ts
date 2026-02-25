export const COMPANY_STATE_CODE = "36"; // Telangana — legacy default, prefer dynamic

export function calculateGST(
  taxableAmount: number,
  gstRate: number,
  dealerStateCode: string | null,
  companyStateCode: string = COMPANY_STATE_CODE
) {
  const isIntraState = dealerStateCode === companyStateCode;
  const gstAmount = Math.round((taxableAmount * gstRate) / 100 * 100) / 100;

  let cgst = 0, sgst = 0, igst = 0;
  if (isIntraState) {
    // Split evenly, ensure cgst + sgst === gstAmount
    cgst = Math.floor(gstAmount / 2 * 100) / 100;
    sgst = Math.round((gstAmount - cgst) * 100) / 100;
  } else {
    igst = gstAmount;
  }

  return {
    cgst,
    sgst,
    igst,
    totalGst: gstAmount,
    totalWithGst: Math.round((taxableAmount + gstAmount) * 100) / 100,
  };
}
