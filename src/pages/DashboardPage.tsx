import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import { 
  TrendingUp, 
  Package, 
  DollarSign, 
  Target, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownRight,
  Lightbulb,
  MoreVertical,
  Calendar,
  Loader2
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useStore } from '../store/useStore';
import { formatCurrency, formatNumber, cn } from '../lib/utils';
import { getHealthStatus } from '../lib/stockAnalysis';
import { SalesData } from '../types';
import { useInventoryAnalytics } from '../hooks/useInventoryAnalytics';

export const DashboardPage = () => {
  const { products, activities, authReady, user } = useStore();
  const { enrichedProducts, chartData } = useInventoryAnalytics(products);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length && payload.some((p: any) => p.value !== null && p.value !== undefined)) {
      return (
        <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-outline-variant)', boxShadow: '0 12px 40px rgba(0,0,0,0.1)', fontFamily: 'Inter', color: 'var(--color-on-surface)', padding: '14px 16px', minWidth: '160px' }}>
          <p style={{ fontWeight: 700, marginBottom: '10px', fontSize: '13px' }}>{label}</p>
          {payload.map((p: any) => {
            if (p.value === null || p.value === undefined) return null;
            const isActual = p.dataKey === 'actual';
            return (
              <p key={p.dataKey} style={{ color: isActual ? 'var(--color-primary)' : 'var(--color-secondary)', fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                <span>{isActual ? 'Actual' : 'Predicted'}</span>
                <span style={{ fontWeight: 800 }}>{p.value.toLocaleString()}</span>
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  // Generate real data-driven insight locally as fallback
  const generateLocalInsight = () => {
    if (enrichedProducts.length === 0) return 'Upload inventory data to see AI-driven insights.';
    
    const lowStock = enrichedProducts.filter(p => getHealthStatus(p.currentStock, p.minStock) === 'Low Stock' || getHealthStatus(p.currentStock, p.minStock) === 'No Stock');
    const highDemand = enrichedProducts.filter(p => (p.analytics?.trendValue !== null && p.analytics?.trendValue !== undefined && p.analytics.trendValue > (p.currentStock * 0.2)));
    
    if (lowStock.length > 0) {
      return `Critical: ${lowStock[0].name} is ${getHealthStatus(lowStock[0].currentStock, lowStock[0].minStock).toLowerCase()}. Replenish immediately to avoid stockout.`;
    }
    if (highDemand.length > 0) {
      return `Demand Surge: ${highDemand[0].name} demand is projected to increase based on recent trends.`;
    }
    return 'Inventory levels are currently optimized across all categories.';
  };

  useEffect(() => {
    const fetchAiInsight = async () => {
      if (enrichedProducts.length === 0 || !import.meta.env.VITE_OPENROUTER_API_KEY || import.meta.env.VITE_OPENROUTER_API_KEY === 'mock_key') {
        setAiInsight(generateLocalInsight());
        return;
      }
      
      setLoadingInsight(true);
      try {
        const inventorySummary = enrichedProducts.map(p => `${p.name} (Stock: ${p.currentStock})`).join(', ');
        
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
            "HTTP-Referer": window.location.origin,
            "X-Title": "InvestIQ",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            "model": "google/gemini-2.0-flash-exp:free",
            "messages": [
              {
                "role": "system",
                "content": "You are a supply chain AI. Provide a single, powerful, one-sentence inventory insight based on the data. Be specific."
              },
              {
                "role": "user",
                "content": `Inventory Data: ${inventorySummary}`
              }
            ]
          })
        });

        const data = await response.json();
        if (data.choices && data.choices.length > 0 && data.choices[0].message) {
          setAiInsight(data.choices[0].message.content);
        } else {
          console.error("Invalid AI response format:", data);
        }
      } catch (err) {
        console.error("Failed to fetch AI insight:", err);
      } finally {
        setLoadingInsight(false);
      }
    };

    fetchAiInsight();
  }, [enrichedProducts]);

  const totalStock = enrichedProducts.reduce((acc, p) => acc + p.currentStock, 0);
  const lowStockCount = enrichedProducts.filter(p => getHealthStatus(p.currentStock, p.minStock) === 'Low Stock').length;
  const totalValue = enrichedProducts.reduce((acc, p) => acc + (p.currentStock * p.price), 0);

  // RULE 5: Demand Forecast = average probability score across all products
  const validProbs = enrichedProducts
    .map(p => p.analytics?.probability)
    .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
  const demandForecast = validProbs.length > 0
    ? Math.round(validProbs.reduce((a, b) => a + b, 0) / validProbs.length)
    : null;

  // RULE 6: Stock Levels = % products with stock >= minStock
  const inStockCount = enrichedProducts.filter(p => getHealthStatus(p.currentStock, p.minStock) === 'In Stock').length;
  const stockLevelPct = enrichedProducts.length > 0
    ? Math.round((inStockCount / enrichedProducts.length) * 100)
    : null;
  
  const validConfidences = enrichedProducts.map(p => p.analytics?.probabilityScore).filter(score => score !== null && score !== undefined && score > 0) as number[];
  const avgConfidence = validConfidences.length > 0
    ? Math.round(validConfidences.reduce((a, b) => a + b, 0) / validConfidences.length)
    : null;

  if (!authReady) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="animate-spin text-primary" size={48} />
        <p className="text-outline font-medium">Loading your dashboard...</p>
      </div>
    );
  }
  if (enrichedProducts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-6 text-center">
        <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center text-outline/30">
          <TrendingUp size={40} />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-headline font-bold text-on-surface">Welcome to InvestIQ</h3>
          <p className="text-outline max-w-xs">Start by uploading your inventory data to unlock AI-powered demand forecasting and analytics.</p>
        </div>
        <Button variant="primary" onClick={() => window.location.href = '/dashboard/inventory'}>
          Upload Inventory
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Hero Header Section */}
      <section className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div className="space-y-1">
          <span className="text-secondary font-bold tracking-widest text-[10px] uppercase">Operational Overview</span>
          <h2 className="font-headline text-4xl font-bold tracking-tight text-on-surface">Precision Dashboard</h2>
        </div>
      </section>

      {/* KPI Cards Bento Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="space-y-4 hover:translate-y-[-4px] transition-all duration-300 border-none bg-surface-container-low shadow-sm">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <DollarSign className="text-emerald-500" size={20} />
            </div>
            <span className="text-emerald-600 dark:text-emerald-400 font-black text-[10px] uppercase tracking-wider flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              <ArrowUpRight size={12} />
              +12.4%
            </span>
          </div>
          <div>
            <p className="text-[10px] text-outline font-black uppercase tracking-widest leading-none mb-1">Annual Revenue</p>
            <h3 className="font-headline text-3xl font-bold text-on-surface">{formatCurrency(totalValue)}</h3>
          </div>
          <div className="h-1 bg-surface-container rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 w-[75%] rounded-full"></div>
          </div>
        </Card>

        <Card className="space-y-4 hover:translate-y-[-4px] transition-all duration-300 border-none bg-surface-container-low shadow-sm">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <TrendingUp className="text-amber-500" size={20} />
            </div>
            <Badge variant="secondary">OPTIMIZED</Badge>
          </div>
          <div>
            <p className="text-[10px] text-outline font-black uppercase tracking-widest leading-none mb-1">Demand Forecast</p>
            <h3 className="font-headline text-3xl font-bold text-on-surface">
              {demandForecast !== null ? `${demandForecast}%` : 'Data unavailable'}
            </h3>
          </div>
          <p className="text-[10px] text-outline font-bold italic">Avg probability across all products</p>
        </Card>

        <Card className="space-y-4 hover:translate-y-[-4px] transition-all duration-300 border-none bg-surface-container-low shadow-sm border-l-4 border-l-primary">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Package className="text-emerald-500" size={20} />
            </div>
            <span className="text-emerald-600 dark:text-emerald-400 font-black text-[10px] uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full">Healthy</span>
          </div>
          <div>
            <p className="text-[10px] text-outline font-black uppercase tracking-widest leading-none mb-1">Stock Levels</p>
            <h3 className="font-headline text-3xl font-bold text-on-surface">
              {stockLevelPct !== null ? `${stockLevelPct}%` : 'Data unavailable'}
            </h3>
          </div>
          <div className="flex -space-x-2">
            {enrichedProducts.slice(0, 3).map((p) => (
              <img 
                key={p.id}
                className="w-6 h-6 rounded-full border-2 border-surface shadow-sm object-cover" 
                src={p.image || undefined} 
                alt={p.name} 
              />
            ))}
            {enrichedProducts.length > 3 && (
              <div className="w-6 h-6 rounded-full border-2 border-surface bg-surface-container-high flex items-center justify-center text-[8px] font-black">{enrichedProducts.length - 3}+</div>
            )}
          </div>
        </Card>

        <Card className="space-y-4 hover:translate-y-[-4px] transition-all duration-300 border-none bg-surface-container-low shadow-sm">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-tertiary/10 rounded-lg">
              <Target className="text-tertiary" size={20} />
            </div>
            <span className="text-tertiary font-black text-[10px] uppercase tracking-wider bg-tertiary/10 px-2 py-0.5 rounded-full">94%</span>
          </div>
          <div>
            <p className="text-[10px] text-outline font-black uppercase tracking-widest leading-none mb-1">Prediction Accuracy</p>
            <h3 className="font-headline text-3xl font-bold text-on-surface">{avgConfidence !== null && avgConfidence !== undefined ? `${avgConfidence}%` : 'Data unavailable'}</h3>
          </div>
          <div className="h-1 bg-surface-container rounded-full overflow-hidden">
            <div className="h-full bg-tertiary rounded-full" style={{ width: `${avgConfidence || 0}%` }}></div>
          </div>
        </Card>
      </section>

      {/* Main Analytics Canvas */}
      <section className="flex flex-col gap-8 w-full">
        {/* Demand Trend Chart */}
        <Card className="w-full space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-headline text-xl font-bold text-on-surface">Demand Kinetic Trend</h4>
              <p className="text-xs text-outline">Real-time market movement analysis</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="text-[10px] h-8">MONTHLY</Button>
            </div>
          </div>
          
          <div className="h-80 w-full flex items-center justify-center bg-surface-container-low/30 rounded-xl border border-dashed border-outline-variant/20">
            {chartData.some(d => d.actual !== null) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-secondary)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="var(--color-secondary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-variant)" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--color-outline)' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--color-outline)' }}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--color-outline-variant)', strokeWidth: 1 }} />
                  <Area 
                    type="monotone" 
                    dataKey="actual"
                    name="Actual"
                    stroke="var(--color-primary)" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorActual)" 
                    connectNulls={false}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="predicted"
                    name="Predicted"
                    stroke="var(--color-secondary)" 
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    fillOpacity={1} 
                    fill="url(#colorPredicted)" 
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center space-y-2">
                <Calendar className="mx-auto text-outline/30" size={32} />
                <p className="text-sm text-outline font-medium">No sales data available for trend analysis.</p>
                <p className="text-[10px] text-outline uppercase">Import CSV/Excel in Inventory to see trends</p>
              </div>
            )}
          </div>
        </Card>

        {/* Recent Activity Panel */}
        <Card className="w-full flex flex-col">
          <h4 className="font-headline text-xl font-bold text-on-surface mb-6">Recent Intelligence</h4>
          <div className="flex-1 space-y-6">
            {activities.length === 0 ? (
              <p className="text-xs text-outline italic">No recent activities.</p>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="flex gap-4">
                  <div className={cn(
                    "mt-1 w-2 h-2 rounded-full shrink-0",
                    activity.severity === 'warning' ? "bg-amber-500" : 
                    activity.severity === 'success' ? "bg-emerald-500" : 
                    activity.severity === 'error' ? "bg-rose-500" : "bg-primary"
                  )}></div>
                  <div>
                    <p className="text-sm font-black text-on-surface leading-tight uppercase tracking-tight">{activity.title}</p>
                    <p className="text-[11px] text-outline mt-1 font-bold">{activity.description}</p>
                    <span className="text-[10px] text-outline font-medium mt-2 block">
                      {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>

      {/* Product Comparison & Insights */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product Performance Bar Chart */}
        <Card className="h-full">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h4 className="font-headline text-xl font-bold text-on-surface">Product Comparison</h4>
              <p className="text-sm text-outline">Manage your InventIQ account and profile.</p>
            </div>
            <button className="text-outline hover:text-on-surface transition-colors">
              <MoreVertical size={20} />
            </button>
          </div>
          <div className="space-y-6">
            {(() => {
              const topProducts = [...enrichedProducts]
                .sort((a, b) => (b.analytics?.probabilityScore || 0) - (a.analytics?.probabilityScore || 0))
                .slice(0, 5);
                
              if (topProducts.length === 0) {
                return <p className="text-xs text-outline italic">No products to compare.</p>;
              }
              
              return topProducts.map((product, idx) => (
                <div key={product.id} className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-on-surface">
                    <span>{product.name}</span>
                    <span>{product.analytics?.probabilityScore !== null && product.analytics?.probabilityScore !== undefined ? `${product.analytics.probabilityScore}%` : 'Data unavailable'}</span>
                  </div>
                  <div className="h-3 bg-surface-container-low rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        idx === 0 ? "bg-primary" : idx === 1 ? "bg-primary-container" : "bg-primary-fixed"
                      )}
                      style={{ width: `${product.analytics?.probabilityScore || 0}%` }}
                    ></div>
                  </div>
                </div>
              ));
            })()}
          </div>
        </Card>

        {/* Insight Glass Component */}
        <Card variant="insight" className="h-full">
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-secondary/5 rounded-full blur-3xl"></div>
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center">
                <Lightbulb className="text-secondary" size={20} fill="currentColor" />
              </div>
              <h4 className="font-headline text-xl font-bold text-on-surface">AI Smart Insight</h4>
            </div>
            <p className="text-on-surface-variant leading-relaxed font-medium">
              {loadingInsight ? (
                <Loader2 className="animate-spin text-secondary" size={20} />
              ) : aiInsight ? (
                aiInsight
              ) : enrichedProducts.length > 0 ? (
                <>
                  Based on current market trends, we predict a <span className="text-secondary font-bold">surge</span> in inventory requirements for <span className="text-secondary font-bold">"{enrichedProducts[0].name}"</span> over the next 14 days. 
                </>
              ) : (
                "Start adding products to your inventory to receive AI-driven demand insights and optimization strategies."
              )}
            </p>
            <div className="pt-4 flex gap-4">
              <Button variant="ghost" size="sm" onClick={() => setAiInsight(null)}>Dismiss</Button>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};
