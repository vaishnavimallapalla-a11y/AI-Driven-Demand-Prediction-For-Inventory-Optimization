import { useMemo, useState, useEffect } from 'react';
import { Product } from '../types';

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── Helpers ────────────────────────────────────────────────────────────────────

function average(arr: (number | null)[]): number | null {
  const valid = arr.filter((v): v is number => v !== null && !isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/**
 * RULE 3: currentStock = last non-null history value, fallback to product.currentStock
 */
function resolveCurrentStock(product: Product): number {
  if (product.history && product.history.length > 0) {
    // Walk backwards to find the last valid month value
    for (let i = product.history.length - 1; i >= 0; i--) {
      const v = product.history[i];
      if (v !== null && v !== undefined && !isNaN(v) && v > 0) return v;
    }
  }
  // Fallback: quantity/stock column
  return product.currentStock ?? 0;
}

/**
 * Compute a safe minimum stock — never 0.
 * If product.minStock is missing/zero, derive from currentStock × 0.5 (min 100).
 * Stronger threshold ensures products aren't uniformly classified as Excess Stock.
 */
export function resolveSafeMinStock(minStock: number, currentStock: number): number {
  if (minStock && minStock > 0) return minStock;
  return Math.max(100, Math.round(currentStock * 0.5));
}

/**
 * RULE 2 — Strict, relative health status.
 * Uses safeMinStock so products are never uniformly classified.
 */
export type StockHealth = 'No Stock' | 'Low Stock' | 'In Stock' | 'Excess Stock';
export function getStockHealth(currentStock: number, minStock: number): StockHealth {
  const s = Math.max(0, currentStock);
  const m = resolveSafeMinStock(minStock, s);

  console.log('STOCK:', s, 'MIN:', m);

  if (!s || s === 0)          return 'No Stock';
  if (s < m)                  return 'Low Stock';
  if (s <= m * 1.5)           return 'In Stock';
  return 'Excess Stock';
}

/**
 * RULE 4: demand prediction from last-month vs previous-month
 */
function getDemandPrediction(history: (number | null)[] | undefined): {
  trend: number | null;
  trendLabel: 'Increasing' | 'Decreasing' | 'Stable';
  probability: number | null;
} {
  if (!history || history.length < 2) {
    return { trend: null, trendLabel: 'Stable', probability: null };
  }
  const valid = history.filter((v): v is number => v !== null && !isNaN(v) && v >= 0);
  if (valid.length < 2) return { trend: null, trendLabel: 'Stable', probability: null };

  const last = valid[valid.length - 1];
  const prev = valid[valid.length - 2];
  const trend = last - prev;

  // RULE 4: Probability = Math.min(100, Math.abs(trend) * 2)
  const probability = Math.min(100, Math.round(Math.abs(trend) * 2));

  return {
    trend,
    trendLabel: trend > 0 ? 'Increasing' : trend < 0 ? 'Decreasing' : 'Stable',
    probability
  };
}

// ── Chart Data ─────────────────────────────────────────────────────────────────

export interface ChartDataPoint {
  month: string;
  actual: number | null;
  predicted: number | null;
}

/**
 * RULE 7 + 8: Build actual (SUM history) and predicted (trend-based) series
 */
function generateForecastData(products: Product[]): ChartDataPoint[] {
  // RULE 7: SUM per month; null if no product has data for that month
  const actualData: (number | null)[] = MONTHS.map((_, i) => {
    let total = 0;
    let hasData = false;
    products.forEach(p => {
      if (p.history && p.history[i] != null && !isNaN(p.history[i])) {
        total += p.history[i];
        hasData = true;
      }
    });
    return hasData ? total : null;
  });

  // RULE 8: predicted = current + trend * 0.8 + index * 5
  const predictedData: (number | null)[] = actualData.map((value, i, arr) => {
    if (value == null) return null;
    if (i === 0)       return value;
    const prev = arr[i - 1];
    if (prev == null)  return value;
    const trend = value - prev;
    return Math.max(0, Math.round(value + trend * 0.8 + i * 5));
  });

  console.log("ACTUAL:", actualData);
  console.log("PREDICTED:", predictedData);

  return MONTHS.map((month, i) => ({
    month,
    actual: actualData[i],
    predicted: predictedData[i]
  }));
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export const useInventoryAnalytics = (products: Product[]) => {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  const analyticsOutput = useMemo(() => {
    // RULE 10: debug log
    console.log("PRODUCTS:", products);

    if (!products || products.length === 0) {
      return { globalAvgStock: null, enrichedProducts: [] };
    }

    // Global average of resolved current stocks
    const resolvedStocks = products.map(p => resolveCurrentStock(p)).filter(v => v > 0);
    const globalAvgStock = resolvedStocks.length
      ? resolvedStocks.reduce((a, b) => a + b, 0) / resolvedStocks.length
      : null;

    const enrichedProducts = products
      // FIX 4: reject products with no stock AND no usable history
      .filter(p => {
        const s = resolveCurrentStock(p);
        const hasValidHistory = p.history && p.history.some(v => v !== null && !isNaN(v as number) && (v as number) > 0);
        return s > 0 || hasValidHistory;
      })
      .map((product) => {
        // RULE 3: resolve real current stock from history
        const currentStock = resolveCurrentStock(product);

        // FIX 1: compute safeMinStock — never allow 0
        const safeMinStock = resolveSafeMinStock(product.minStock, currentStock);

        // RULE 4: demand prediction from history
        const { trend, trendLabel, probability } = getDemandPrediction(product.history);

        // Percent from global average
        let percentFromAvg: number | null = null;
        if (globalAvgStock && globalAvgStock > 0) {
          percentFromAvg = Math.round(((currentStock - globalAvgStock) / globalAvgStock) * 100);
        }

        // RULE 2: derive health from resolved stock + safeMinStock
        const health = getStockHealth(currentStock, safeMinStock);

        const enriched = {
          ...product,
          currentStock,          // override with resolved value
          minStock: safeMinStock, // expose computed min so UI can use it
          status: health,         // keep status field in sync
          analytics: {
            percentFromAvg,
            probabilityScore: probability,
            probability,           // alias for KPI consumers
            trendValue: trend,
            trendLabel,
            direction: trend === null ? 'stable' : trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable',
            health
          }
        };

        // STEP 5 DEBUG (MANDATORY)
        console.log('FINAL:', {
          stock: enriched.currentStock,
          min: enriched.minStock,
          status: enriched.status
        });

        return enriched;
    });

    console.log("ENRICHED:", enrichedProducts);

    return { globalAvgStock, enrichedProducts };
  }, [products]);

  // RULE 6 (reactive): update chart whenever enrichedProducts changes
  useEffect(() => {
    const newData = generateForecastData(analyticsOutput.enrichedProducts);
    console.log("CHART DATA:", newData);
    setChartData(newData);
  }, [analyticsOutput.enrichedProducts]);

  return {
    ...analyticsOutput,
    chartData
  };
};
