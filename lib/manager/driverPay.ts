/** Reserved for a later % of fare split. Unused in v1 — pay is gratuity only. */
export const DRIVER_PAY_PERCENT = 0

/** v1 driver pay for a completed job = gratuity, or $0 if none. */
export function driverPayForJob(gratuityAmount: number | null | undefined): number {
  const n = Number(gratuityAmount ?? 0)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}
