/**
 * Utility functions for stock analysis and health status calculation.
 * Mirrors src/lib/stockAnalysis.ts — keep in sync.
 */

export type HealthStatus = 'No Stock' | 'Low Stock' | 'In Stock' | 'Excess Stock';

/**
 * FIX 1: Compute a safe minStock — never allow 0.
 * If minStock is missing/zero, derive it from currentStock × 0.3 (min 50).
 */
export const resolveSafeMinStock = (minStock: number | null | undefined, currentStock: number): number => {
  if (minStock && minStock > 0) return minStock;
  return Math.max(100, Math.round(currentStock * 0.5));
};

/**
 * Calculates percentage change from average stock.
 */
export const calculateStockChange = (currentStock: number | null, avgStock: number | null): number => {
  const current = Math.max(0, currentStock || 0);
  const average = Math.max(0, avgStock    || 0);
  if (average === 0) return current > 0 ? 100 : 0;
  return ((current - average) / average) * 100;
};

/**
 * FIX 2 — Strict relative health status.
 * Uses safeMinStock so products are never uniformly classified as Excess.
 */
export const getHealthStatus = (stock: number | null, minStock?: number): HealthStatus => {
  const s = Math.max(0, stock ?? 0);
  const m = resolveSafeMinStock(minStock ?? 0, s);

  if (!s || s === 0)          return 'No Stock';
  if (s < m)                  return 'Low Stock';
  if (s <= m * 1.5)           return 'In Stock';
  return 'Excess Stock';
};

/**
 * Returns the appropriate badge variant for a given health status.
 */
export const getStatusVariant = (
  status: HealthStatus
): 'error' | 'warning' | 'primary' | 'secondary' | 'outline' => {
  switch (status) {
    case 'No Stock':     return 'error';
    case 'Low Stock':    return 'error';
    case 'In Stock':     return 'primary';
    case 'Excess Stock': return 'secondary';
    default:             return 'primary';
  }
};
