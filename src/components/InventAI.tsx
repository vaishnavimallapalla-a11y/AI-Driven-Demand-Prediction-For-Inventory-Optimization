import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Trash2, Bot, User as UserIcon, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useInventoryAnalytics } from '../hooks/useInventoryAnalytics';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { cn, formatCurrency } from '../lib/utils';
import { toast } from 'react-hot-toast';

interface Message {
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
}

export const InventAI = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      content:
        "Hello! I'm Invent AI 👋\n\n" +
        "I can help you with:\n" +
        "• Stock health & low stock alerts\n" +
        "• Demand forecasts & trend analysis\n" +
        "• App debugging (wrong status, broken charts)\n" +
        "• Optimization & restocking recommendations\n\n" +
        "Just ask naturally — what would you like to explore?",
      timestamp: Date.now(),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const { products } = useStore();
  const { enrichedProducts } = useInventoryAnalytics(products);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (messages.length > 50) setMessages(prev => prev.slice(-50));
  }, [messages]);

  // ───────────────────────────────────────────────────────────────────────────
  // INVENT AI ENGINE v3
  // Priority: DEBUG > FORECAST > INVENTORY > OPTIMIZER > CHATBOT
  // Format:   Answer / Reason / Suggestion
  // Rules:    data-driven, no hallucination, enrichedProducts only
  // ───────────────────────────────────────────────────────────────────────────
  const generateAIResponse = async (query: string): Promise<string> => {
    const q = query.toLowerCase().trim();
    await new Promise(r => setTimeout(r, 420));

    try {
      // ── Helpers ──────────────────────────────────────────────────────────────
      /** Normalize: lowercase + strip spaces/symbols */
      const norm = (s: string) => s.toLowerCase().replace(/[\s\-_.,()'/\\]/g, '');
      /** Keyword detector */
      const det = (kws: string[]) => kws.some(k => q.includes(k));
      /** Normalized query string */
      const qn = norm(q);

      /** Robust product match — tries exact norm match first, then partial */
      const findProduct = () => {
        // 1. Exact normalized match
        const exact = enrichedProducts.find(p => qn.includes(norm(p.name)));
        if (exact) return exact;
        // 2. Partial: any word >3 chars in query matches start of product name
        const words = q.split(/\s+/).filter(w => w.length > 3);
        return enrichedProducts.find(p =>
          words.some(w => norm(p.name).startsWith(norm(w)) || norm(p.name).includes(norm(w)))
        );
      };

      const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

      // ── EMPTY DATA GUARD ─────────────────────────────────────────────────────
      if (enrichedProducts.length === 0) {
        return "Data unavailable. Please upload inventory.";
      }

      // ── Pre-compute metrics ──────────────────────────────────────────────────
      const lowStock    = enrichedProducts.filter(p => p.currentStock < p.minStock);
      const excessStock = enrichedProducts.filter(p => p.status === 'Excess Stock');
      const noStock     = enrichedProducts.filter(p => p.status === 'No Stock');
      const inStock     = enrichedProducts.filter(p => p.status === 'In Stock');
      const totalUnits  = enrichedProducts.reduce((a, p) => a + p.currentStock, 0);
      const totalValue  = enrichedProducts.reduce((a, p) => a + p.currentStock * p.price, 0);
      const healthPct   = Math.round((inStock.length / enrichedProducts.length) * 100);

      const rising  = enrichedProducts.filter(p => (p.analytics?.trendValue ?? 0) > 0);
      const falling = enrichedProducts.filter(p => (p.analytics?.trendValue ?? 0) < 0);

      console.log('🤖 InventAI v3:', { q, products: enrichedProducts.length, low: lowStock.length });

      // ════════════════════════════════════════════════════════════════════════
      // MODE 1 — DEBUG  (highest priority)
      // Detects: app issues, wrong status, broken graph, 0% confidence
      // ════════════════════════════════════════════════════════════════════════
      const isDebug = det([
        'bug', 'error', 'wrong', 'broken', 'incorrect', 'not loading', 'not showing',
        'not working', 'debug', 'issue', 'fix', 'why is', 'why are', 'why does',
        'all same', 'all excess', 'excess for all', 'showing excess', 'same status',
        'graph not', 'chart not', 'blank chart', 'blank graph', 'empty chart',
        '0%', 'zero percent', 'prediction is 0', 'confidence is 0', 'no prediction',
        'status wrong', 'health wrong', 'history missing', 'no history',
      ]);

      if (isDebug) {
        // Sub-case A: all-excess / wrong health status
        if (det(['excess for all', 'all excess', 'all same', 'same status', 'showing excess', 'every product shows', 'all products show'])) {
          return (
            "🔧 Issue: All products show \"Excess Stock\"\n\n" +
            "Cause: minStock was missing or not passed to getHealthStatus() during CSV parsing. " +
            "The auto-derived fallback (stock × 0.3) was too low — making all products exceed 1.5× the threshold.\n\n" +
            "Fix ✅: getHealthStatus(currentStock, minStock) is now enforced.\n" +
            "Fallback = max(100, stock × 0.5) — strong enough to produce varied statuses.\n\n" +
            "Suggestion: Re-upload your CSV. Add a minStock column for accurate per-product thresholds."
          );
        }

        // Sub-case B: graph / chart empty
        if (det(['graph', 'chart', 'not loading', 'blank', 'empty chart', 'no chart', 'not showing graph'])) {
          // Check if a specific product is mentioned and has no history
          const hit = findProduct();
          const hasNoHistory = hit
            ? !((hit as any).history as (number|null)[])?.some((v: number|null) => v !== null)
            : false;

          return (
            "🔧 Issue: Forecast chart is blank or not rendering.\n\n" +
            (hit && hasNoHistory
              ? `Cause: "${hit.name}" has no valid historical data — all month values are null.\n`
              : "Cause: Selected product has no historical data, or the uploaded file lacked recognized month columns (Jan–Dec).\n"
            ) +
            "Fix: Ensure your CSV has:\n" +
            "  • Wide format — columns: Jan, Feb, Mar … Dec\n" +
            "  • OR Long format — columns: Month, Quantity/Sales/Demand\n\n" +
            "Suggestion: Re-upload with at least 2 non-zero monthly values to enable forecasting."
          );
        }

        // Sub-case C: 0% confidence / missing prediction
        if (det(['0%', 'zero', 'prediction is 0', 'confidence is 0', 'probability', 'no prediction', 'missing prediction'])) {
          const hit = findProduct();
          const hist = (hit as any)?.history as (number|null)[] | undefined;
          const validPoints = hist ? hist.filter((v: number|null) => v !== null).length : 0;

          return (
            "🔧 Issue: Prediction shows 0% or confidence is missing.\n\n" +
            (hit
              ? `Cause: "${hit.name}" has only ${validPoints} valid data point(s) — minimum 2 required for trend calculation.\n`
              : "Cause: Product has fewer than 2 valid historical data points — not enough to compute trend or confidence.\n"
            ) +
            "Confidence = (data_points × 0.5) + (consistency × 0.3) + (source × 0.2).\n\n" +
            "Suggestion: Upload 6+ months of history for reliable forecast probability."
          );
        }

        // Sub-case D: missing trendValue
        if (det(['trend missing', 'trend not', 'no trend', 'trendvalue', 'trend is null', 'trend is 0'])) {
          return (
            "🔧 Issue: Trend value is missing or null.\n\n" +
            "Cause: trendValue is computed from last 2 valid months. If fewer than 2 months have data, it stays null.\n\n" +
            "Fix: Ensure at least 2 consecutive months have non-null values in historical data.\n\n" +
            "Suggestion: Check your CSV for blank cells in month columns and replace with 0 if no sales occurred."
          );
        }

        // Generic debug snapshot
        const debugIssues: string[] = [];
        const noHistProduct = enrichedProducts.find(p =>
          !((p as any).history as (number|null)[])?.some((v: number|null) => v !== null)
        );
        const noMinStock = enrichedProducts.find(p => !p.minStock || p.minStock <= 0);
        const noTrend    = enrichedProducts.find(p => p.analytics?.trendValue == null);
        if (noHistProduct) debugIssues.push(`• "${noHistProduct.name}" — no historical data (graph will be blank)`);
        if (noMinStock)    debugIssues.push(`• "${noMinStock.name}" — minStock is missing (status may be wrong)`);
        if (noTrend)       debugIssues.push(`• "${noTrend.name}" — trendValue is null (prediction unstable)`);

        return (
          "🔧 Debug Scan — " + enrichedProducts.length + " products\n\n" +
          (debugIssues.length > 0
            ? "Issues found:\n" + debugIssues.join('\n')
            : "No data issues detected. System appears healthy."
          ) + "\n\n" +
          `Health Score: ${healthPct}%  |  Low: ${lowStock.length}  |  Excess: ${excessStock.length}  |  No Stock: ${noStock.length}\n\n` +
          "Suggestion: Describe the specific symptom (e.g. \"all products show excess\", \"graph is blank\") for a precise root cause."
        );
      }

      // ════════════════════════════════════════════════════════════════════════
      // MODE 2 — FORECAST / DEMAND
      // Includes: trend label, last 2 months comparison, next month expectation
      // ════════════════════════════════════════════════════════════════════════
      if (det(['forecast', 'predict', 'prediction', 'demand', 'trend', 'growth', 'sales',
               'future', 'next month', 'upcoming', 'december', 'increasing', 'decreasing',
               'stable', 'momentum', 'rising', 'falling', 'projection'])) {

        const hit = findProduct();

        if (hit) {
          const tv   = hit.analytics?.trendValue ?? null;
          const prob = hit.analytics?.probabilityScore ?? null;
          const lbl  = hit.analytics?.trendLabel ?? 'Stable';
          const hist = (hit as any).history as (number | null)[] | undefined;

          // Find last 2 valid data months
          const validMonths: { month: string; value: number }[] = [];
          if (hist) {
            for (let i = 0; i < hist.length; i++) {
              if (hist[i] !== null && hist[i] !== undefined) {
                validMonths.push({ month: MONTHS[i], value: hist[i] as number });
              }
            }
          }
          const last2 = validMonths.slice(-2);
          const lastM = last2[last2.length - 1];
          const prev2 = last2[last2.length - 2];

          // Build last-2-months comparison string
          let comparisonStr = '';
          if (last2.length >= 2 && prev2 && lastM) {
            const diff  = lastM.value - prev2.value;
            const pct   = prev2.value > 0 ? Math.abs(Math.round((diff / prev2.value) * 100)) : 0;
            const arrow = diff > 0 ? `▲ +${diff}` : diff < 0 ? `▼ ${diff}` : '→ 0';
            comparisonStr = `${prev2.month}: ${prev2.value}  →  ${lastM.month}: ${lastM.value} (${arrow} units, ${pct}% change)`;
          } else if (lastM) {
            comparisonStr = `Last data point: ${lastM.month} = ${lastM.value} units`;
          } else {
            comparisonStr = 'No historical data available.';
          }

          // Next month expectation
          let nextMonthStr = 'Unable to project — insufficient data.';
          if (tv !== null && lastM) {
            const nextVal  = Math.max(0, Math.round(lastM.value + tv * 0.8));
            const nextIdx  = MONTHS.indexOf(lastM.month);
            const nextName = nextIdx >= 0 && nextIdx < 11 ? MONTHS[nextIdx + 1] : 'Next period';
            nextMonthStr   = `${nextName}: ~${nextVal.toLocaleString()} units projected`;
          }

          const trendLine =
            tv === null ? 'Trend unavailable — not enough history.'
            : tv > 0    ? `Increasing (+${tv} units/month momentum).`
            : tv < 0    ? `Decreasing (${tv} units/month momentum).`
            :             'Stable — no significant movement.';

          return (
            `📈 Forecast: ${hit.name}\n\n` +
            `Answer: ${trendLine}\n` +
            `Last 2 months: ${comparisonStr}\n` +
            `Next month: ${nextMonthStr}\n\n` +
            `Reason: Trend is "${lbl}"${prob !== null ? `, ${prob}% forecast probability` : ''}.\n` +
            `Suggestion: ${
              tv !== null && tv > 0  ? `Demand is rising — build buffer stock before next peak.`
              : tv !== null && tv < 0 ? `Demand is falling — slow down ordering to avoid overstock.`
              :                         `Stable pattern — maintain current replenishment schedule.`
            }`
          );
        }

        // General demand overview (no specific product)
        return (
          `📈 Demand Overview — ${enrichedProducts.length} Products\n\n` +
          `Answer: ${rising.length} rising  |  ${falling.length} declining  |  ${enrichedProducts.length - rising.length - falling.length} stable\n\n` +
          `Reason: Based on month-over-month trendValue across all products.\n` +
          `Suggestion: ${
            rising.length > 0
              ? `Top rising: "${[...rising].sort((a,b) => (b.analytics?.trendValue ?? 0) - (a.analytics?.trendValue ?? 0))[0].name}". Prioritize restocking.`
              : falling.length > 0
                ? `Top at risk: "${[...falling].sort((a,b) => (a.analytics?.trendValue ?? 0) - (b.analytics?.trendValue ?? 0))[0].name}". Monitor for overstock.`
                : `All demand patterns are stable. No immediate action required.`
          }`
        );
      }

      // ════════════════════════════════════════════════════════════════════════
      // MODE 3 — INVENTORY INSIGHTS
      // ════════════════════════════════════════════════════════════════════════
      if (det(['low stock', 'shortage', 'running out', 'critical', 'below minimum',
               'excess', 'overstock', 'surplus', 'too much',
               'stock', 'inventory', 'items', 'products', 'warehouse',
               'status', 'overview', 'health', 'summary', 'how many', 'no stock', 'out of stock'])) {

        // Low stock specific
        if (det(['low stock', 'shortage', 'running out', 'critical', 'below min', 'under threshold'])) {
          if (lowStock.length === 0) {
            return (
              "📦 Low Stock Check\n\n" +
              "Answer: No low stock items — all products are above their minimum threshold. ✅\n" +
              "Reason: currentStock > minStock for every product.\n" +
              "Suggestion: Continue current replenishment cadence — inventory is healthy."
            );
          }
          const lines = lowStock.slice(0, 4).map(p => {
            const tv = p.analytics?.trendValue ?? 0;
            const risk = tv > 0 ? ' ⚠️ demand also rising' : '';
            return `• ${p.name}: ${p.currentStock} / ${p.minStock} min${risk}`;
          }).join('\n');
          return (
            `📦 Low Stock Alert — ${lowStock.length} item(s)\n\n` +
            `Answer:\n${lines}\n\n` +
            `Reason: currentStock < minStock (strict health rule).\n` +
            `Suggestion: Restock "${lowStock[0].name}" first` +
            `${(lowStock[0].analytics?.trendValue ?? 0) > 0 ? ' — rising demand makes this urgent.' : '.'}`
          );
        }

        // Excess stock specific
        if (det(['excess', 'overstock', 'surplus', 'too much stock', 'overstocked'])) {
          if (excessStock.length === 0) {
            return (
              "📦 Excess Stock Check\n\n" +
              "Answer: No excess stock detected — inventory is well-balanced. ✅\n" +
              "Reason: No product exceeds 1.5× its minStock threshold.\n" +
              "Suggestion: Maintain current ordering patterns."
            );
          }
          const lines = excessStock.slice(0, 4).map(p => {
            const tv   = p.analytics?.trendValue ?? 0;
            const risk = tv < 0 ? ' ⚠️ declining demand' : '';
            return `• ${p.name}: ${p.currentStock} units (min: ${p.minStock})${risk}`;
          }).join('\n');
          const worst = excessStock.find(p => (p.analytics?.trendValue ?? 0) < 0) ?? excessStock[0];
          return (
            `📦 Excess Stock Report — ${excessStock.length} item(s)\n\n` +
            `Answer:\n${lines}\n\n` +
            `Reason: Stock > 1.5× minStock threshold.\n` +
            `Suggestion: Reduce orders for "${worst.name}"` +
            `${(worst.analytics?.trendValue ?? 0) < 0
              ? ' — declining demand + excess = compounding holding cost.'
              : ' — high inventory ties up working capital.'}`
          );
        }

        // Named product insight
        const hit = findProduct();
        if (hit) {
          const tv   = hit.analytics?.trendValue ?? null;
          const prob = hit.analytics?.probabilityScore ?? null;
          const lbl  = hit.analytics?.trendLabel ?? 'Stable';
          return (
            `📦 Product: ${hit.name}\n\n` +
            `Answer: Status "${hit.status}" — ${hit.currentStock.toLocaleString()} units (min: ${hit.minStock}).\n` +
            `Reason: Trend is "${lbl}"${prob !== null ? `, ${prob}% forecast confidence` : ''}.\n` +
            `Suggestion: ${
              hit.status === 'No Stock'       ? `🚨 Out of stock — reorder immediately.`
              : hit.status === 'Low Stock'    ? `⚠️ Below minimum — restock "${hit.name}" now.${tv !== null && tv > 0 ? ' Demand is rising — act fast.' : ''}`
              : hit.status === 'Excess Stock'
                ? (tv !== null && tv < 0
                    ? `Pause orders — declining demand + excess stock = capital drain.`
                    : `Review order frequency — stock well above minimum.`)
              : `Stock is healthy.${tv !== null && tv > 0 ? ' Demand is growing — maintain buffer.' : ' Maintain current strategy.'}`
            }`
          );
        }

        // General overview
        return (
          `📦 Inventory Summary\n\n` +
          `Answer: ${enrichedProducts.length} products — ${healthPct}% healthy.\n` +
          `• In Stock: ${inStock.length}  |  Low: ${lowStock.length}  |  Excess: ${excessStock.length}  |  No Stock: ${noStock.length}\n` +
          `• Units: ${totalUnits.toLocaleString()}  |  Value: ${formatCurrency(totalValue)}\n\n` +
          `Reason: Real-time data from ${enrichedProducts.length} enriched products.\n` +
          `Suggestion: ${
            lowStock.length > 0      ? `🔴 "${lowStock[0].name}" is critically low — restock now.`
            : excessStock.length > 0 ? `⚠️ "${excessStock[0].name}" is overstocked — reduce ordering.`
            : noStock.length > 0     ? `🚨 "${noStock[0].name}" is out of stock — immediate action needed.`
            :                          `✅ All products are within healthy thresholds.`
          }`
        );
      }

      // ════════════════════════════════════════════════════════════════════════
      // MODE 4 — OPTIMIZER / SUGGESTIONS
      // Priority: Low Stock > Decreasing Demand > Excess Stock (top 3 only)
      // ════════════════════════════════════════════════════════════════════════
      if (det(['suggest', 'improve', 'recommend', 'advice', 'optimize', 'should i',
               'what should', 'tip', 'action', 'priority', 'next step', 'what to do', 'help me'])) {

        const actions: { priority: number; text: string }[] = [];

        // P1: Low Stock items
        lowStock.slice(0, 2).forEach(p => {
          const urgency = (p.analytics?.trendValue ?? 0) > 0 ? ' ⚡ Urgent — demand also rising.' : '';
          actions.push({
            priority: 1,
            text: `🔴 Restock "${p.name}" (${p.currentStock}/${p.minStock} min).${urgency}`
          });
        });

        // P2: Excess + Decreasing demand (capital drain)
        excessStock
          .filter(p => (p.analytics?.trendValue ?? 0) < 0)
          .slice(0, 1)
          .forEach(p => {
            actions.push({
              priority: 2,
              text: `💸 Pause orders for "${p.name}" — excess stock + falling demand (${p.analytics?.trendValue}/mo).`
            });
          });

        // P3: Rising demand (pre-order opportunity)
        const topRiser = [...rising]
          .sort((a, b) => (b.analytics?.trendValue ?? 0) - (a.analytics?.trendValue ?? 0))[0];
        if (topRiser && !lowStock.find(p => p.name === topRiser.name)) {
          actions.push({
            priority: 3,
            text: `📈 Pre-order buffer stock for "${topRiser.name}" (+${topRiser.analytics?.trendValue} units/mo momentum).`
          });
        }

        // P3 fallback: plain excess stock if no declining one
        if (actions.length < 3) {
          excessStock
            .filter(p => (p.analytics?.trendValue ?? 0) >= 0)
            .slice(0, 1)
            .forEach(p => {
              actions.push({
                priority: 3,
                text: `⚠️ Review "${p.name}" — excess stock ties up capital (${p.currentStock} units, min: ${p.minStock}).`
              });
            });
        }

        if (actions.length === 0) {
          return (
            "💡 Optimization Check\n\n" +
            "Answer: No critical actions required — inventory is well-balanced. ✅\n" +
            `Reason: ${healthPct}% of products are In Stock with stable demand.\n` +
            "Suggestion: Continue weekly monitoring to stay ahead of demand shifts."
          );
        }

        const top3 = actions
          .sort((a, b) => a.priority - b.priority)
          .slice(0, 3)
          .map((a, i) => `${i + 1}. ${a.text}`)
          .join('\n');

        return (
          `💡 Top ${Math.min(actions.length, 3)} Action Items\n\n` +
          `Answer:\n${top3}\n\n` +
          `Reason: Ranked by risk — Low Stock > Declining Demand > Excess Inventory.\n` +
          `Suggestion: Address these in order. Re-check weekly as demand shifts.`
        );
      }

      // ════════════════════════════════════════════════════════════════════════
      // MODE 5 — CHATBOT (lowest priority)
      // ════════════════════════════════════════════════════════════════════════
      if (det(['hi', 'hello', 'hey', 'yo', 'good morning', 'good evening', 'good afternoon', 'sup', 'hiya', 'howdy'])) {
        return (
          "Hey there! 👋 I'm Invent AI — your inventory intelligence assistant.\n\n" +
          "I can help with:\n" +
          "• Stock health & alerts\n" +
          "• Demand forecasts for any product\n" +
          "• App issue debugging\n" +
          "• Restocking recommendations\n\n" +
          "What would you like to explore?"
        );
      }
      if (det(['thanks', 'thank you', 'cheers', 'great', 'awesome', 'perfect', 'nice', 'well done'])) {
        return "You're welcome! 😊 Let me know if there's anything else I can help with.";
      }
      if (det(['okay', 'ok', 'got it', 'understood', 'alright', 'sounds good', 'noted'])) {
        return "Got it 👍 Let me know if you need anything else!";
      }
      if (det(['who are you', 'what are you', 'your name', 'what can you do', 'help', 'guide', 'capabilities', 'about', 'features'])) {
        return (
          "I'm Invent AI — built-in inventory intelligence assistant.\n\n" +
          "🔧 Debug — diagnose wrong status, blank charts, 0% confidence.\n" +
          "📈 Forecast — trend direction, 2-month comparison, next month projection.\n" +
          "📦 Inventory — per-product or full overview with health status.\n" +
          "💡 Optimizer — top 3 prioritized actions ranked by business risk.\n\n" +
          "Try: \"Why is the graph blank?\" or \"Forecast for [product name]\""
        );
      }

      // ── FALLBACK ───────────────────────────────────────────────────────────
      return (
        `📊 Quick Snapshot\n\n` +
        `Answer: ${enrichedProducts.length} products — ${healthPct}% healthy.\n` +
        `• Low: ${lowStock.length}  |  Excess: ${excessStock.length}  |  No Stock: ${noStock.length}  |  Value: ${formatCurrency(totalValue)}\n\n` +
        `Reason: No specific intent matched — showing current overview.\n` +
        `Suggestion: Try:\n` +
        `• "Which products are low stock?"\n` +
        `• "Forecast for [product name]"\n` +
        `• "Why does the graph not load?"\n` +
        `• "What should I restock?"`
      );

    } catch (err) {
      console.error("InventAI Error:", err);
      return "Something went wrong. Try asking about stock levels, trends, or describe any app issues.";
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;

    const userMsg: Message = { role: 'user', content: trimmed, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const response = await generateAIResponse(trimmed);
    const aiMsg: Message = { role: 'ai', content: response, timestamp: Date.now() };
    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(false);
  };

  const clearChat = () => {
    setMessages([{
      role: 'ai',
      content: 'Chat cleared. How can I help? 👋',
      timestamp: Date.now(),
    }]);
    toast.success('Chat history cleared');
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className={cn(
          "fixed bottom-8 right-8 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center z-50 transition-colors",
          "bg-emerald-700 text-white dark:bg-emerald-600 border border-white/20"
        )}
      >
        {isOpen ? <X size={24} /> : (
          <div className="relative">
            <Bot size={28} fill="white" />
            <div className="absolute top-[11px] left-[7px] w-1 h-1 bg-emerald-700 rounded-full" />
            <div className="absolute top-[11px] right-[7px] w-1 h-1 bg-emerald-700 rounded-full" />
            <div className="absolute bottom-[6px] left-[10px] w-2 h-[2px] bg-emerald-700 rounded-sm" />
          </div>
        )}
        {!isOpen && (
          <span className="absolute -top-2 -right-2 w-5 h-5 bg-secondary text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
            AI
          </span>
        )}
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-8 w-[390px] h-[540px] z-50 flex flex-col"
          >
            <Card className="flex-1 flex flex-col overflow-hidden border-primary/20 dark:border-white/10 bg-surface-container-low dark:bg-surface shadow-2xl rounded-2xl">
              {/* Header */}
              <div className="p-4 border-b border-primary/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Bot size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Invent AI</h3>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Active Agent</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={clearChat}
                  title="Clear Chat"
                  className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors text-muted-foreground hover:text-rose-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth min-h-0 bg-white/20 dark:bg-surface">
                {messages.map((msg, i) => (
                  <motion.div
                    key={msg.timestamp + i}
                    initial={{ opacity: 0, x: msg.role === 'user' ? 10 : -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-border/10",
                      msg.role === 'user' ? "bg-primary text-white" : "bg-card text-on-surface"
                    )}>
                      {msg.role === 'user' ? <UserIcon size={14} /> : <Bot size={14} />}
                    </div>
                    <div className={cn(
                      "max-w-[78%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap",
                      msg.role === 'user'
                        ? "bg-primary text-white rounded-tr-none"
                        : "bg-surface text-on-surface rounded-tl-none border border-border/30"
                    )}>
                      {msg.content}
                    </div>
                  </motion.div>
                ))}

                {isTyping && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-card flex items-center justify-center border border-border/10 text-on-surface">
                      <Bot size={14} />
                    </div>
                    <div className="bg-surface p-3 rounded-2xl rounded-tl-none border border-border/30 shadow-sm flex gap-1 items-center">
                      <motion.div animate={{ opacity: [0.4,1,0.4] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0 }}   className="w-1.5 h-1.5 bg-primary/40 rounded-full" />
                      <motion.div animate={{ opacity: [0.4,1,0.4] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} className="w-1.5 h-1.5 bg-primary/40 rounded-full" />
                      <motion.div animate={{ opacity: [0.4,1,0.4] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }} className="w-1.5 h-1.5 bg-primary/40 rounded-full" />
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>

              {/* Input Footer */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-primary/10 dark:border-white/10 bg-surface-container-low dark:bg-surface">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Ask Invent AI..."
                    disabled={isTyping}
                    className={cn(
                      "flex-1 bg-surface-container-low border border-border/50 rounded-xl px-4 py-2.5 text-sm",
                      "focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all",
                      "text-foreground placeholder:text-muted-foreground",
                      isTyping && "opacity-50 cursor-not-allowed"
                    )}
                  />
                  <Button
                    size="sm"
                    type="submit"
                    disabled={!input.trim() || isTyping}
                    className="shrink-0 h-10 w-10 rounded-xl p-0 flex items-center justify-center"
                  >
                    {isTyping ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center mt-3 font-medium opacity-60">
                  Secure local AI • InventIQ Engine v3.0
                </p>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
