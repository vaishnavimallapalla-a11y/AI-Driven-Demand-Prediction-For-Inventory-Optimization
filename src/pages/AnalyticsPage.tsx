import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { 
  TrendingUp, 
  Zap, 
  Target, 
  Activity, 
  Clock, 
  MoreVertical,
  Calendar,
  Layers,
  Cpu,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useStore } from '../store/useStore';
import { formatCurrency, formatNumber } from '../lib/utils';
import { getHealthStatus } from '../lib/stockAnalysis';
import { toast } from 'react-hot-toast';
import { SalesData } from '../types';
import { useInventoryAnalytics } from '../hooks/useInventoryAnalytics';

export const AnalyticsPage = () => {
  const { products, salesData, authReady, user } = useStore();
  const { enrichedProducts, chartData } = useInventoryAnalytics(products);
  const navigate = useNavigate();
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const accuracyData = React.useMemo(() => {
    // chartData already has { month, actual, predicted } shape
    return chartData;
  }, [chartData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length && payload.some((p: any) => p.value !== null)) {
      return (
        <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-outline-variant)', boxShadow: '0 12px 40px rgba(0,0,0,0.1)', fontFamily: 'Inter', color: 'var(--color-on-surface)', padding: '14px 16px', minWidth: '160px' }}>
          <p style={{ fontWeight: 700, marginBottom: '10px', fontSize: '13px' }}>{label}</p>
          {payload.map((p: any) => {
            if (p.value === null || p.value === undefined) return null;
            const isActual = p.dataKey === 'actual';
            return (
              <p key={p.dataKey} style={{ color: isActual ? 'var(--color-primary)' : '#f97316', fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
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

  // Generate real data-driven insights locally if AI fails or as a fallback
  const generateLocalInsights = () => {
    if (enrichedProducts.length === 0) return { opportunity: 'Upload inventory data to see insights.', risk: 'No data available.' };

    const lowStock = enrichedProducts.filter(p => getHealthStatus(p.currentStock, p.minStock) === 'Low Stock' || getHealthStatus(p.currentStock, p.minStock) === 'No Stock');
    const overStock = enrichedProducts.filter(p => getHealthStatus(p.currentStock, p.minStock) === 'Excess Stock');
    const highDemand = enrichedProducts.filter(p => p.analytics?.trendValue !== null && p.analytics?.trendValue !== undefined && p.analytics.trendValue > (p.currentStock * 0.2));

    let opportunity = '';
    let risk = '';

    if (highDemand.length > 0) {
      opportunity = `High demand surge detected for ${highDemand[0].name}. Consider increasing stock.`;
    } else if (overStock.length > 0) {
      opportunity = `Optimize capital by reducing inventory for ${overStock[0].name}, which is currently in excess.`;
    } else {
      opportunity = 'Inventory levels are stable. Monitor seasonal trends for upcoming shifts.';
    }

    if (lowStock.length > 0) {
      risk = `Critical stock level for ${lowStock[0].name} (${lowStock[0].currentStock} units). Replenishment required immediately.`;
    } else {
      risk = 'No immediate supply chain risks detected. Maintain current replenishment cycles.';
    }

    return { opportunity, risk };
  };

  useEffect(() => {
    const fetchAiInsights = async () => {
      if (enrichedProducts.length === 0 || !import.meta.env.VITE_OPENROUTER_API_KEY || import.meta.env.VITE_OPENROUTER_API_KEY === 'mock_key') {
        setAiInsights(generateLocalInsights());
        return;
      }
      
      setLoadingInsights(true);
      try {
        const inventorySummary = enrichedProducts.map(p => `${p.name} (Stock: ${p.currentStock}, Status: ${getHealthStatus(p.currentStock, p.minStock)})`).join(', ');
        
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
                "content": "You are an expert supply chain analyst. Provide 2 concise, actionable inventory insights based on the provided product data. Format as JSON with 'opportunity' and 'risk' keys."
              },
              {
                "role": "user",
                "content": `Inventory Data: ${inventorySummary}`
              }
            ],
            "response_format": { "type": "json_object" }
          })
        });

        const data = await response.json();
        if (data.choices && data.choices.length > 0 && data.choices[0].message) {
          const content = JSON.parse(data.choices[0].message.content);
          setAiInsights(content);
        } else {
          setAiInsights(generateLocalInsights());
        }
      } catch (err) {
        console.error("Failed to fetch AI insights:", err);
        setAiInsights(generateLocalInsights());
      } finally {
        setLoadingInsights(false);
      }
    };

    fetchAiInsights();
  }, [enrichedProducts]);

  const handleDownloadReport = () => {
    if (enrichedProducts.length === 0) {
      toast.error('No inventory data to export');
      return;
    }

    try {
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(20);
      doc.text('InventIQ Inventory Analytics Report', 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
      
      // Add Summary Card
      doc.setDrawColor(230);
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(14, 35, 182, 30, 3, 3, 'FD');
      
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text('Inventory Summary', 20, 45);
      
      doc.setFontSize(10);
      doc.text(`Total Products: ${enrichedProducts.length}`, 20, 55);
      doc.text(`Total Stock Value: ${formatCurrency(enrichedProducts.reduce((acc, p) => acc + (p.currentStock * p.price), 0))}`, 80, 55);
      doc.text(`Avg Confidence: ${avgConfidence !== null ? avgConfidence : 'N/A'}%`, 150, 55);

      // Add Table
      autoTable(doc, {
        startY: 75,
        head: [['Product Name', 'SKU', 'Category', 'Stock', 'Price', 'Status', 'Prediction Trend']],
        body: enrichedProducts.map(p => {
          const trendValue = p.analytics?.trendValue;
          const displayValue = trendValue !== null && trendValue !== undefined ? (trendValue > 0 ? `+${trendValue}` : trendValue) : 'Estimating...';
          return [
            p.name,
            p.sku,
            p.category,
            p.currentStock,
            formatCurrency(p.price),
            getHealthStatus(p.currentStock, p.minStock),
            displayValue
          ];
        }),
        headStyles: { fillColor: [0, 82, 255] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      });

      doc.save(`InventIQ_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF Report generated successfully');
    } catch (err) {
      toast.error('Failed to generate PDF report');
      console.error(err);
    }
  };

  const categories = Array.from(new Set(enrichedProducts.map(p => p.category)));
  const pieData = categories.map((cat, idx) => ({
    name: cat,
    value: enrichedProducts.filter(p => p.category === cat).reduce((acc, p) => acc + p.currentStock, 0),
    color: ['#003ec7', '#0052ff', '#fe6b00', '#952200', '#22c55e'][idx % 5]
  }));

  const validPredictions = enrichedProducts.map(p => p.analytics?.probabilityScore).filter(score => score !== undefined && score !== null && score > 0) as number[];
  const avgConfidence = validPredictions.length > 0 
    ? (validPredictions.reduce((acc, score) => acc + score, 0) / validPredictions.length).toFixed(1)
    : null;

  // Demand Forecast KPI
  const allProbabilities = enrichedProducts.map(p => p.analytics?.probability).filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
  const demandForecast = allProbabilities.length > 0
    ? Math.round(allProbabilities.reduce((a, b) => a + b, 0) / allProbabilities.length)
    : null;

  // RULE 6: Stock Level KPI = % of products where currentStock >= minStock
  const inStockCount = enrichedProducts.filter(p => getHealthStatus(p.currentStock, p.minStock) === 'In Stock').length;
  const stockLevel = enrichedProducts.length > 0
    ? Math.round((inStockCount / enrichedProducts.length) * 100)
    : null;

  const lowStockCount = enrichedProducts.filter(p => getHealthStatus(p.currentStock, p.minStock) === 'Low Stock' || getHealthStatus(p.currentStock, p.minStock) === 'No Stock').length;
  const excessStockCount = enrichedProducts.filter(p => getHealthStatus(p.currentStock, p.minStock) === 'Excess Stock').length;
  const optimizationScore = enrichedProducts.length > 0 
    ? Math.max(0, Math.min(100, 100 - (lowStockCount * 5 + excessStockCount * 3))) 
    : 0;

  if (!authReady) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="animate-spin text-primary" size={48} />
        <p className="text-outline font-medium">Loading analytics...</p>
      </div>
    );
  }

  // RULE 10: Stop rendering if no data
  if (enrichedProducts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-6 text-center">
        <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center text-outline/30">
          <Activity size={40} />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-headline font-bold text-on-surface">No Analytics Data</h3>
          <p className="text-outline max-w-xs">Upload your inventory CSV or Excel file to generate advanced demand analytics.</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/dashboard/inventory')}>
          Go to Inventory
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header Section */}
      <section className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold font-headline tracking-tight text-on-surface">Advanced Analytics</h2>
          <p className="text-sm text-outline">Deep dive into your inventory performance and demand patterns.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={handleDownloadReport}>Download Report</Button>
        </div>
      </section>

      {/* Advanced Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <Card className="flex flex-col justify-between">
          <div className="flex justify-between items-start mb-6">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Activity className="text-primary" size={20} />
            </div>
            <Badge variant="primary">LIVE</Badge>
          </div>
          <div>
            <p className="text-xs font-bold text-outline uppercase tracking-widest mb-1">Model Confidence</p>
            <h3 className="text-4xl font-headline font-bold text-on-surface">{avgConfidence !== null ? `${avgConfidence}%` : 'Data unavailable'}</h3>
            <div className="mt-4 h-2 bg-surface-container rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${avgConfidence !== null ? avgConfidence : 0}%` }}></div>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col justify-between">
          <div className="flex justify-between items-start mb-6">
            <div className="p-2 bg-secondary/10 rounded-lg">
              <Zap className="text-secondary" size={20} />
            </div>
            <Badge variant="secondary">FORECAST</Badge>
          </div>
          <div>
            <p className="text-xs font-bold text-outline uppercase tracking-widest mb-1">Demand Forecast</p>
            <h3 className="text-4xl font-headline font-bold text-on-surface">
              {demandForecast !== null ? `${demandForecast}%` : 'Data unavailable'}
            </h3>
            <p className="text-xs text-outline mt-2 italic">Avg probability across all products</p>
          </div>
        </Card>

        <Card className="flex flex-col justify-between">
          <div className="flex justify-between items-start mb-6">
            <div className="p-2 bg-tertiary/10 rounded-lg">
              <Target className="text-tertiary" size={20} />
            </div>
            <Badge variant="tertiary">AVG STOCK</Badge>
          </div>
          <div>
            <p className="text-xs font-bold text-outline uppercase tracking-widest mb-1">Stock Level</p>
            <h3 className="text-4xl font-headline font-bold text-on-surface">
              {stockLevel !== null ? `${stockLevel}%` : 'Data unavailable'}
            </h3>
            <p className="text-xs text-outline mt-2 italic">% products meeting minimum stock</p>
          </div>
        </Card>

        <Card className="flex flex-col justify-between">
          <div className="flex justify-between items-start mb-6">
            <div className="p-2 bg-tertiary/10 rounded-lg">
              <Layers className="text-tertiary" size={20} />
            </div>
            <Badge variant="tertiary">STABLE</Badge>
          </div>
          <div>
            <p className="text-xs font-bold text-outline uppercase tracking-widest mb-1">Data Points Analyzed</p>
            <h3 className="text-4xl font-headline font-bold text-on-surface">
              {enrichedProducts.length > 0 ? formatNumber(enrichedProducts.length + (enrichedProducts[0]?.history?.length ?? 0)) : 'Data unavailable'}
            </h3>
            <p className="text-xs text-outline mt-2 italic">Real-time synchronization active</p>
          </div>
        </Card>
      </div>

      {/* Stock Visualization Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Card className="lg:col-span-12">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h4 className="font-headline text-xl font-bold text-on-surface">Stock Level Visualization</h4>
              <p className="text-xs text-outline">Real-time monitoring of current stock vs minimum thresholds</p>
            </div>
          </div>
          <div className="overflow-x-auto pb-4">
            <div style={{ minWidth: enrichedProducts.length > 10 ? `${enrichedProducts.length * 80}px` : '100%' }}>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={enrichedProducts}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--color-outline), 0.1)" />
                    <XAxis 
                      dataKey="name" 
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
                    <Tooltip 
                      cursor={{ fill: 'var(--color-surface-container-high)', fillOpacity: 0.4 }}
                      contentStyle={{ 
                        backgroundColor: 'var(--color-surface)',
                        borderRadius: '12px', 
                        border: '1px solid var(--color-outline-variant)', 
                        boxShadow: '0 12px 40px rgba(0,0,0,0.1)',
                        fontFamily: 'Inter',
                        color: 'var(--color-on-surface)'
                      }} 
                    />
                    <Bar dataKey="currentStock" radius={[4, 4, 0, 0]} barSize={40}>
                      {enrichedProducts.map((entry, index) => {
                        const status = getHealthStatus(entry.currentStock, entry.minStock);
                        const fill = status === 'Low Stock' || status === 'No Stock' ? '#f43f5e' : status === 'Excess Stock' ? '#fbbf24' : 'var(--color-primary)';
                        return <Cell key={`cell-${index}`} fill={fill} />;
                      })}
                    </Bar>
                    <Bar dataKey="minStock" fill="var(--color-surface-container-high)" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary"></div>
              <span className="text-xs font-medium text-outline">In Stock</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-error"></div>
              <span className="text-xs font-medium text-outline">Low Stock</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span className="text-xs font-medium text-outline">Excess Stock</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-200"></div>
              <span className="text-xs font-medium text-outline">Min Threshold</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Forecast vs Actual */}
        <Card className="lg:col-span-8">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h4 className="font-headline text-xl font-bold text-on-surface">Forecast Accuracy Analysis</h4>
              <p className="text-xs text-outline">Comparing AI projections with real-world sales</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="text-[10px] h-8">MONTHLY</Button>
            </div>
          </div>
          <div className="h-80 w-full flex items-center justify-center bg-surface-container-low/30 rounded-xl border border-dashed border-outline-variant/20">
            {accuracyData.some(d => d.actual !== null) ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={accuracyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eceef0" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#737688' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--color-outline)' }}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--color-outline-variant)', strokeWidth: 2 }} />
                  {/* Actual — solid blue/primary line */}
                  <Line 
                    type="monotone" 
                    dataKey="actual" 
                    name="Actual"
                    stroke="var(--color-primary)" 
                    strokeWidth={3}
                    dot={{ r: 3, fill: 'var(--color-primary)', strokeWidth: 2, stroke: 'var(--color-surface)' }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    connectNulls={false}
                  />
                  {/* Predicted — dashed orange line */}
                  <Line 
                    type="monotone" 
                    dataKey="predicted" 
                    name="Predicted"
                    stroke="#f97316"
                    strokeWidth={3}
                    strokeDasharray="8 5"
                    dot={{ r: 3, fill: '#f97316', strokeWidth: 2, stroke: 'var(--color-surface)' }}
                    activeDot={{ r: 5, strokeWidth: 0, fill: '#f97316' }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center space-y-2">
                <Target className="mx-auto text-outline/30" size={32} />
                <p className="text-sm text-outline font-medium">No historical accuracy data available.</p>
                <p className="text-[10px] text-outline uppercase">Import CSV/Excel in Inventory to see accuracy</p>
              </div>
            )}
          </div>
          {/* Legend */}
          <div className="flex justify-center gap-8 mt-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-[3px] rounded-full bg-primary"></div>
              <span className="text-xs font-semibold text-outline">Actual</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-[3px] rounded-full" style={{ background: 'repeating-linear-gradient(90deg, #f97316 0px, #f97316 6px, transparent 6px, transparent 10px)' }}></div>
              <span className="text-xs font-semibold text-outline">Predicted</span>
            </div>
          </div>
        </Card>

        {/* Category Distribution */}
        <Card className="lg:col-span-4">
          <h4 className="font-headline text-xl font-bold text-on-surface mb-8">Inventory Distribution</h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 mt-6">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-sm font-medium text-on-surface-variant">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-on-surface">{item.value} units</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* AI Insights Panel */}
      <Card variant="insight" className="border-primary/20 overflow-hidden relative">
        <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 relative z-10">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Cpu className="text-primary" size={24} />
              </div>
              <div>
                <h4 className="font-headline text-2xl font-bold text-on-surface">Neural Insights Engine</h4>
                <p className="text-sm text-outline">Automated strategy recommendations</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6 bg-surface-container-low border-none space-y-3 shadow-none">
                <Badge variant="success">OPPORTUNITY</Badge>
                <h5 className="font-bold text-on-surface font-headline uppercase tracking-tight">Seasonal Shift Detected</h5>
                <p className="text-xs text-on-surface-variant leading-relaxed font-medium">
                  {loadingInsights ? (
                    <Loader2 className="animate-spin text-primary" size={16} />
                  ) : (aiInsights as any)?.opportunity || 'Market data indicates an early start to the summer electronics cycle. Increase procurement for "Outdoor Audio" by 15% before June 1st.'}
                </p>
              </Card>
              <Card className="p-6 bg-surface-container-low border-none space-y-3 shadow-none">
                <Badge variant="error">RISK</Badge>
                <h5 className="font-bold text-on-surface font-headline uppercase tracking-tight">Supply Chain Volatility</h5>
                <p className="text-xs text-on-surface-variant leading-relaxed font-medium">
                  {loadingInsights ? (
                    <Loader2 className="animate-spin text-primary" size={16} />
                  ) : (aiInsights as any)?.risk || 'Potential delays in the South Sector logistics hub. Safety stock for "Quantum Series" should be increased to 25 days.'}
                </p>
              </Card>
            </div>
          </div>
          <div className="bg-gradient-to-br from-primary to-primary-container p-8 rounded-2xl text-on-primary flex flex-col justify-between shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-all duration-700"></div>
            <div className="relative z-10">
              <h5 className="font-headline text-xl font-bold mb-2 uppercase tracking-tight">Optimization Score</h5>
              <p className="text-xs opacity-90 font-medium">Your current inventory health is exceptional.</p>
            </div>
            <div className="text-center py-6 relative z-10">
              <span className="text-6xl font-black font-headline tracking-tighter">
                {enrichedProducts.length > 0 ? optimizationScore : "—"}
              </span>
              <span className="text-xl opacity-60 font-black">/100</span>
            </div>
            <Button className="bg-white text-primary hover:bg-white/90 w-full font-black text-xs uppercase tracking-widest shadow-lg relative z-10" onClick={() => navigate('/dashboard/inventory')}>Improve Score</Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
