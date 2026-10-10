/** Total unit prices in PKR. Upper bounds are exclusive, never overlapping. */
export const PROJECT_BUDGETS = [
  { value: 'under-15m', label: 'Under PKR 1.5 Cr', min: 0, max: 15_000_000 },
  { value: '15m-25m', label: 'PKR 1.5–2.5 Cr', min: 15_000_000, max: 25_000_000 },
  { value: '25m-50m', label: 'PKR 2.5–5 Cr', min: 25_000_000, max: 50_000_000 },
  { value: '50m-plus', label: 'PKR 5 Cr and above', min: 50_000_000, max: Infinity },
] as const

export function priceMatchesBudget(price: number, budget: string): boolean {
  const range = PROJECT_BUDGETS.find((option) => option.value === budget)
  return !range || (Number.isFinite(price) && price >= range.min && price < range.max)
}

export function propertyTypeLabel(type: string): string {
  return (
    (
      {
        Flat: 'Apartments',
        Plot: 'Plots',
        Office: 'Offices',
        Shop: 'Shops',
        Commercial: 'Commercial',
      } as Record<string, string>
    )[type] ?? type
  )
}
