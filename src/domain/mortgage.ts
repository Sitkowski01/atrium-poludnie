export interface MortgageInput {
  price: number
  downPaymentPct: number
  years: number
  ratePct: number
}

export interface MortgageResult {
  downPayment: number
  loan: number
  monthly: number
  totalInterest: number
  totalPaid: number
}

/** Raty równe (annuitet), kapitalizacja miesięczna, ratePct = roczna stopa nominalna. */
export function calcMortgage({ price, downPaymentPct, years, ratePct }: MortgageInput): MortgageResult {
  const downPayment = (price * downPaymentPct) / 100
  const loan = price - downPayment
  const months = years * 12
  const r = ratePct / 100 / 12

  let monthly = 0
  if (loan > 0 && months > 0) {
    monthly = r === 0 ? loan / months : (loan * r) / (1 - Math.pow(1 + r, -months))
  }

  const totalPaid = monthly * months
  return { downPayment, loan, monthly, totalInterest: totalPaid - loan, totalPaid }
}
