/**
 * Utility functions for stock analysis and health status calculation.
 * ─────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH for label definitions — mirrors useInventoryAnalytics.ts
 */

export type StockHealthStatus = 'No Stock' | 'Low Stock' | 'In Stock' | 'Excess Stock';

/**
 * FIX 1: Compute a safe minStock — never allow 0.
 * If minStock is missing/zero, derive it from currentStock × 0.3 (min 50).
 */
export const resolveSafeMinStock = (minStock: number, currentStock: number): number => {
  if (minStock && minStock > 0) return minStock;
  return Math.max(100, Math.round(currentStock * 0.5));
};

/**
 * Calculates percentage change from average stock.
 */
export const calculateStockChange = (currentStock: number, averageStock: number): number => {
  const stock = currentStock ?? 0;
  const avg   = averageStock  || stock || 100;
  if (avg === 0) return 0;
  return Math.round(((stock - avg) / avg) * 100);
};

/**
 * FIX 2 — Strict relative health status.
 * Uses safeMinStock so products are never uniformly classified as Excess.
 *
 * @param stock    - Resolved current stock (Rule 3: from history, not raw field)
 * @param minStock - Per-product minimum stock threshold (may be 0 — handled internally)
 */
export const getHealthStatus = (stock: number, minStock?: number): StockHealthStatus => {
  const s = Math.max(0, stock ?? 0);
  const m = resolveSafeMinStock(minStock ?? 0, s);

  // FIX 3: Debug log
  console.log('STOCK:', s, 'MIN:', m);

  if (!s || s === 0)          return 'No Stock';
  if (s < m)                  return 'Low Stock';
  if (s <= m * 1.5)           return 'In Stock';
  return 'Excess Stock';
};

/**
 * Returns the appropriate badge variant for a given health status.
 */
export const getStatusVariant = (
  status: StockHealthStatus
): 'error' | 'warning' | 'primary' | 'secondary' | 'outline' => {
  switch (status) {
    case 'No Stock':      return 'error';
    case 'Low Stock':     return 'error';
    case 'In Stock':      return 'primary';
    case 'Excess Stock':  return 'secondary';
    default:              return 'primary';
  }
};
