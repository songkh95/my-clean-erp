export function calcQuoteTotals(
  items: Array<{ quantity: number; unit_price: number; exclude_from_total?: boolean }>,
  vatRate = 10
) {
  const supply = items
    .filter((i) => !i.exclude_from_total)
    .reduce((s, i) => s + Math.round(Number(i.quantity) || 0) * Math.round(Number(i.unit_price) || 0), 0)
  const vat = Math.round((supply * (Number(vatRate) || 10)) / 100)
  return { supply, vat, total: supply + vat }
}
