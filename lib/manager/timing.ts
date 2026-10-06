/** One line per manager page render. Path and milliseconds only — no secrets or customer data. */
export function logManagerRender(path: string, startedAt: number) {
  console.log(`[manager] ${path} ${Date.now() - startedAt}ms`)
}
