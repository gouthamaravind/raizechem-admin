export const COMPANY_STATE_CODE = "36"; // Telangana

export function calculateGST(
  taxableAmount: number,
  gstRate: number,
  dealerStateCode: string | null
) {
  const isIntraState = dealerStateCode === COMPANY_STATE_CODE;
  const gstAmount = (taxableAmount * gstRate) / 100;

  return {
    cgst: isIntraState ? Math.round((gstAmount / 2) * 100) / 100 : 0,
    sgst: isIntraState ? Math.round((gstAmount / 2) * 100) / 100 : 0,
    igst: isIntraState ? 0 : Math.round(gstAmount * 100) / 100,
    totalGst: Math.round(gstAmount * 100) / 100,
    totalWithGst: Math.round((taxableAmount + gstAmount) * 100) / 100,
  };
}
