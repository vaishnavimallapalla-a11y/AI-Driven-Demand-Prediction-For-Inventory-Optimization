import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  Zap, 
  Target, 
  Upload,
  Cpu,
  ArrowUpRight,
  ChevronRight,
  Settings2,
  Trash2,
  Download,
  FileText,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useStore } from '../store/useStore';
import { toast } from 'react-hot-toast';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { collection, addDoc, serverTimestamp, writeBatch, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const PredictionsPage = () => {
  const { user, predictionRecords } = useStore();
  const [loading, setLoading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const selectedRecord = useMemo(() => {
    if (selectedProductId) {
      return predictionRecords.find(r => r.id === selectedProductId);
    }
    return predictionRecords[0] || null;
  }, [predictionRecords, selectedProductId]);

  const chartData = useMemo(() => {
    if (!selectedRecord) return [];

    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // STEP 1: Build 12-element actual array, null where no data
    const actual: (number | null)[] = MONTHS.map(m => {
      const hist = selectedRecord.historicalData.find(d => d.month === m);
      return hist && hist.value !== null && hist.value !== undefined ? hist.value : null;
    });

    // STEP 3: Find last real data index
    const lastIndex = (() => {
      for (let i = actual.length - 1; i >= 0; i--) {
        if (actual[i] !== null) return i;
      }
      return -1;
    })();

    // No valid data at all → return empty
    if (lastIndex === -1) return [];

    // STEP 4: Generate predictions via momentum formula from lastIndex+1 → 11
    const predicted: (number | null)[] = [...actual] as (number | null)[];
    for (let i = lastIndex + 1; i < 12; i++) {
      const prev = predicted[i - 1] as number;
      const prev2 = (predicted[i - 2] ?? prev) as number;
      const trend = prev - prev2;
      predicted[i] = Math.max(0, Math.round(prev + trend * 0.8));
    }

    // STEP 5: Split into two series
    // actualSeries  → values only up to lastIndex, null beyond
    // predictedSeries → null before lastIndex, then from lastIndex onward
    //   (starts AT lastIndex so the two lines share a connection point)
    return MONTHS.map((m, i) => ({
      date: m,
      actual: i <= lastIndex ? actual[i] : null,
      predicted: i >= lastIndex ? predicted[i] : null,
    }));
  }, [selectedRecord]);
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const hasValue = payload.some((p: any) => p.value !== null && p.value !== undefined);
    if (!hasValue) return null;

    return (
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: '14px',
        border: '1px solid var(--color-outline-variant)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.14)',
        fontFamily: 'Inter',
        color: 'var(--color-on-surface)',
        padding: '14px 18px',
        minWidth: '170px'
      }}>
        <p style={{ fontWeight: 800, marginBottom: '10px', fontSize: '13px', letterSpacing: '0.03em' }}>{label}</p>
        {payload.map((p: any) => {
          if (p.value === null || p.value === undefined) return null;
          const isActual = p.dataKey === 'actual';
          return (
            <div key={p.dataKey} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '20px',
              marginBottom: '6px'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: isActual ? 'var(--color-primary)' : 'var(--color-secondary)', display: 'inline-block', flexShrink: 0 }} />
                {isActual ? 'Actual' : 'Forecast'}
              </span>
              <span style={{ fontWeight: 800, fontSize: '13px', color: isActual ? 'var(--color-primary)' : 'var(--color-secondary)' }}>
                {p.value.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const calculateConfidence = (values: number[]) => {
    if (values.length < 2) return 70;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean;
    
    let confidence = 95 - (cv * 100);
    return Math.max(60, Math.min(98, Math.round(confidence)));
  };

  const calculateTrend = (values: number[]) => {
    if (values.length < 2) return 'Stable';
    const last = values[values.length - 1];
    const prev = values[values.length - 2];
    const diff = (last - prev) / (prev || 1);
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean;

    if (cv > 0.4) return 'Volatile';
    if (diff > 0.05) return 'Increasing';
    if (diff < -0.05) return 'Decreasing';
    return 'Stable';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setLoading(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      const bstr = event.target?.result;
      let data: any[] = [];

      if (file.name.endsWith('.csv')) {
        Papa.parse(bstr as string, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            processParsedData(results.data);
          }
        });
      } else {
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
        processParsedData(data);
      }
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const processParsedData = async (data: any[]) => {
    if (!user) return;
    const ERROR_MSG = "Invalid file format. Please upload valid CSV/Excel.";

    if (data.length === 0) {
      toast.error(ERROR_MSG);
      setLoading(false);
      return;
    }

    try {
      const VALID_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const MONTH_ALIASES: Record<string, string> = {
        'january': 'Jan', 'jan': 'Jan', 'jan24': 'Jan', 'jan25': 'Jan',
        'february': 'Feb', 'feb': 'Feb', 'feb24': 'Feb', 'feb25': 'Feb',
        'march': 'Mar', 'mar': 'Mar', 'mar24': 'Mar', 'mar25': 'Mar',
        'april': 'Apr', 'apr': 'Apr', 'apr24': 'Apr', 'apr25': 'Apr',
        'may': 'May', 'may24': 'May', 'may25': 'May',
        'june': 'Jun', 'jun': 'Jun', 'jun24': 'Jun', 'jun25': 'Jun',
        'july': 'Jul', 'jul': 'Jul', 'july24': 'Jul', 'july25': 'Jul',
        'august': 'Aug', 'aug': 'Aug', 'aug24': 'Aug', 'aug25': 'Aug',
        'september': 'Sep', 'sep': 'Sep', 'sep24': 'Sep', 'sep25': 'Sep',
        'october': 'Oct', 'oct': 'Oct', 'oct24': 'Oct', 'oct25': 'Oct',
        'november': 'Nov', 'nov': 'Nov', 'nov24': 'Nov', 'nov25': 'Nov',
        'december': 'Dec', 'dec': 'Dec', 'dec24': 'Dec', 'dec25': 'Dec'
      };

      const PRODUCT_ALIASES = ['productname', 'product', 'name', 'item', 'productid'];
      const MONTH_COL_ALIASES = ['month', 'months', 'date', 'period', 'time'];
      
      // Numeric Priority: sales > demand > quantity > stock > units > price
      const NUMERIC_PRIORITY = ['sales', 'demand', 'quantity', 'stock', 'units', 'price', 'amount', 'value', 'values', 'count'];

      const normalizeKey = (key: string) => String(key).trim().toLowerCase().replace(/[\s\-_]/g, '');
      const getMonthKey = (val: any): string | null => {
        if (!val) return null;
        const s = normalizeKey(String(val));
        return MONTH_ALIASES[s] || null;
      };

      // Stage 1: Normalize Headers
      const headers = Object.keys(data[0]);
      const normalizedKeys = headers.map(normalizeKey);

      // Stage 2: Detect Data Type
      const monthHeaders = headers.filter(h => getMonthKey(h));
      const hasMonthHeaders = monthHeaders.length > 0;
      const monthColIdx = normalizedKeys.findIndex(k => MONTH_COL_ALIASES.includes(k));
      const productColIdx = normalizedKeys.findIndex(k => PRODUCT_ALIASES.includes(k));

      // Stage 4: Select Best Numeric Signal (Search all columns for priority matches)
      let bestNumericIdx = -1;
      for (const priorityKey of NUMERIC_PRIORITY) {
        const foundIdx = normalizedKeys.findIndex(k => k === priorityKey || k.includes(priorityKey));
        if (foundIdx !== -1) {
          bestNumericIdx = foundIdx;
          break;
        }
      }

      // If no priority match, find the first numeric column after the product column
      if (bestNumericIdx === -1) {
        bestNumericIdx = normalizedKeys.findIndex((k, i) => i > 0 && !isNaN(parseFloat(data[0][headers[i]])));
      }

      let type: 'TIME_SERIES' | 'NORMALIZED' | 'INVENTORY' | 'GENERIC' = 'GENERIC';
      const inventoryKeys = ['stock', 'inventory', 'price', 'status'];
      const hasInventorySignal = normalizedKeys.some(k => inventoryKeys.includes(k));

      if (hasMonthHeaders) type = 'TIME_SERIES';
      else if (monthColIdx !== -1 && bestNumericIdx !== -1) type = 'NORMALIZED';
      else if (hasInventorySignal) type = 'INVENTORY';

      console.log("Detected Type:", type);
      console.log("Selected Column:", bestNumericIdx !== -1 ? headers[bestNumericIdx] : "NONE");

      // Stage 5: Process Data
      const productMap = new Map<string, { 
        displayName: string, 
        months: Record<string, number>, 
        dataSource: 'historical' | 'inventory' | 'generic',
        status?: string,
        baseValue?: number
      }>();

      data.forEach(row => {
        const rawName = productColIdx !== -1 ? row[headers[productColIdx]] : row[headers[0]];
        if (rawName === undefined || rawName === null || rawName === '') return;
        
        const normalizedName = String(rawName).trim().toLowerCase();
        if (!productMap.has(normalizedName)) {
          productMap.set(normalizedName, { 
            displayName: String(rawName).trim(), 
            months: {},
            dataSource: type === 'TIME_SERIES' || type === 'NORMALIZED' ? 'historical' : (type === 'INVENTORY' ? 'inventory' : 'generic')
          });
        }
        const product = productMap.get(normalizedName)!;

        if (type === 'TIME_SERIES') {
          headers.forEach(h => {
            const mKey = getMonthKey(h);
            const val = parseFloat(row[h]);
            if (mKey && !isNaN(val)) product.months[mKey] = (product.months[mKey] || 0) + val;
          });
        } else if (type === 'NORMALIZED') {
          const mKey = getMonthKey(row[headers[monthColIdx]]);
          const val = parseFloat(row[headers[bestNumericIdx]]);
          if (mKey && !isNaN(val)) product.months[mKey] = (product.months[mKey] || 0) + val;
        } else {
          // Inventory or Generic: Set base value and status
          const val = parseFloat(row[headers[bestNumericIdx]]);
          if (!isNaN(val)) product.baseValue = (product.baseValue || 0) + val;
          
          if (type === 'INVENTORY') {
            const statusIdx = normalizedKeys.findIndex(k => k === 'status');
            if (statusIdx !== -1) product.status = row[headers[statusIdx]];
          }
        }
      });

      const finalRecords: any[] = [];
      productMap.forEach((p) => {
        const historicalData: { month: string; value: number | null }[] = [];
        let validPointsCount = 0;
        let lastVal: number | null = null;

        if (p.dataSource === 'historical') {
          let hasStarted = false;
          let lastValidIdx = -1;
          
          // Find first and last valid months
          VALID_MONTHS.forEach((m, idx) => {
            if (p.months[m] !== undefined) {
              if (!hasStarted) hasStarted = true;
              lastValidIdx = idx;
            }
          });

          // Build explicitly from 12 months array mapping missing points as null
          VALID_MONTHS.forEach((m) => {
            const val = p.months[m] !== undefined ? p.months[m] : null;
            historicalData.push({ month: m, value: val });
            if (val !== null) {
              validPointsCount++;
              lastVal = val;
            }
          });
        }

        if (validPointsCount === 0) return;

        // Stage 7: Advanced Weighted Confidence & Prediction
        const values = historicalData.filter(d => d.value !== null).map(d => d.value as number);
        const lastValue = values[values.length - 1];
        const trendVal = values.length >= 2 ? lastValue - values[values.length - 2] : 0;
        
        // 1. Data Points Score (0.5 weight)
        const pointsScore = values.length >= 6 ? 100 : (values.length >= 3 ? 75 : 50);
        
        // 2. Consistency Score (0.3 weight)
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
        const cv = Math.sqrt(variance) / (mean || 1);
        const consistencyScore = Math.max(0, 100 * (1 - cv));
        
        // 3. Source Score (0.2 weight)
        const sourceScore = p.dataSource === 'historical' ? 100 : (p.dataSource === 'inventory' ? 80 : 60);
        
        const finalConfidence = Math.round((pointsScore * 0.5) + (consistencyScore * 0.3) + (sourceScore * 0.2));
        const finalTrend = calculateTrend(values);
        const predictedValue = Math.round(Math.max(0, lastValue + (trendVal * 0.4)));

        finalRecords.push({
          productName: p.displayName,
          historicalData,
          predictedValue,
          confidence: Math.min(98, Math.max(40, finalConfidence)),
          suggestedStock: Math.round(predictedValue * 1.2),
          trend: finalTrend,
          dataSource: p.dataSource,
          dataQuality: p.dataSource === 'historical' && values.length >= 6 ? 'high' : (values.length >= 3 ? 'medium' : 'low'),
          userId: user.id,
          createdAt: serverTimestamp()
        });
      });

      console.log("Final Output:", finalRecords);

      if (finalRecords.length === 0) throw new Error(ERROR_MSG);

      const batch = writeBatch(db);
      finalRecords.forEach(rec => {
        const docRef = doc(collection(db, 'predictions'));
        batch.set(docRef, rec);
      });

      await batch.commit();
      toast.success(`Processed ${finalRecords.length} products`);
    } catch (err: any) {
      console.error("Prediction Processing Error:", err);
      toast.error(err.message || 'Failed to process data');
    } finally {
      setLoading(false);
    }
  };

  const handleClearData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const q = query(collection(db, 'predictions'), where('userId', '==', user.id));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      setSelectedProductId(null);
      setIsClearModalOpen(false);
      toast.success('Prediction data cleared');
    } catch (err) {
      console.error(err);
      toast.error('Failed to clear data');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!selectedRecord) return;
    
    const data = selectedRecord.historicalData.map(d => ({
      Month: d.month,
      'Actual Demand': d.value,
      'Predicted Demand': ''
    }));

    // Add prediction
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const lastMonth = data[data.length - 1].Month;
    const nextMonth = months[(months.indexOf(lastMonth) + 1) % 12];
    
    data.push({
      Month: nextMonth,
      'Actual Demand': 0,
      'Predicted Demand': selectedRecord.predictedValue.toString()
    });

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Forecast_${selectedRecord.productName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    if (!selectedRecord) return;

    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Demand Forecast Report', 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Product: ${selectedRecord.productName}`, 14, 32);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 40);
    doc.text(`Confidence Level: ${selectedRecord.confidence}%`, 14, 48);
    doc.text(`Trend: ${selectedRecord.trend}`, 14, 56);

    const tableData = selectedRecord.historicalData.map(d => [d.month, d.value]);
    
    // Add prediction to table
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const lastMonth = selectedRecord.historicalData[selectedRecord.historicalData.length - 1].month;
    const nextMonth = months[(months.indexOf(lastMonth) + 1) % 12];
    tableData.push([`${nextMonth} (Predicted)`, selectedRecord.predictedValue.toString()]);

    autoTable(doc, {
      startY: 65,
      head: [['Month', 'Demand (Units)']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [0, 82, 255] }
    });

    doc.save(`Forecast_${selectedRecord.productName}.pdf`);
  };

  const getAIInsights = () => {
    if (!selectedRecord) return [];
    
    const insights = [];
    const { trend, predictedValue, historicalData } = selectedRecord;
    const lastActual = historicalData[historicalData.length - 1].value;
    const change = ((predictedValue - lastActual) / (lastActual || 1) * 100).toFixed(1);

    if (trend === 'Increasing') {
      insights.push(`Demand increasing by ${change}% — consider restocking to meet projected surge.`);
    } else if (trend === 'Decreasing') {
      insights.push(`Demand declining by ${Math.abs(parseFloat(change))}% — reduce inventory to avoid excess stock.`);
    } else if (trend === 'Volatile') {
      insights.push(`High fluctuation detected in historical patterns — maintain safety stock of ${selectedRecord.suggestedStock} units.`);
    } else {
      insights.push(`Demand remains stable. Current stock levels are sufficient.`);
    }

    if (selectedRecord.confidence < 75) {
      insights.push(`Confidence level is moderate (${selectedRecord.confidence}%). Monitor market signals closely for unexpected shifts.`);
    } else {
      insights.push(`High model confidence (${selectedRecord.confidence}%). Strategy execution can proceed with high certainty.`);
    }

    return insights;
  };

  if (predictionRecords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-8 text-center">
        <div className="w-24 h-24 bg-surface-container rounded-full flex items-center justify-center text-outline/30 relative">
          <TrendingUp size={48} />
          <div className="absolute -top-1 -right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white animate-pulse">
            <Upload size={16} />
          </div>
        </div>
        <div className="space-y-3 max-w-md">
          <h3 className="text-3xl font-headline font-bold text-on-surface">No Prediction Data</h3>
          <p className="text-outline leading-relaxed">
            Upload a CSV or Excel file containing historical sales data to generate neural-network demand forecasts.
          </p>
        </div>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <label className="cursor-pointer">
            <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} disabled={loading} />
            <div className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <><Upload size={20} /> Upload Historical Data</>}
            </div>
          </label>
          <p className="text-[10px] text-outline uppercase font-bold tracking-widest">Supports CSV, XLSX, XLS</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header Section */}
      <section className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-on-surface mb-2">Demand Forecasting</h2>
          <p className="text-outline max-w-lg">Neural-network predictions derived from your historical sales patterns.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={() => setIsClearModalOpen(true)} className="text-error hover:bg-error/10 border-error/20">
            <Trash2 size={16} />
            Clear Data
          </Button>
          <label className="cursor-pointer">
            <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} disabled={loading} />
            <Button variant="primary" size="sm" className="pointer-events-none">
              <Upload size={16} />
              Upload New
            </Button>
          </label>
        </div>
      </section>

      {/* Clear Data Confirmation Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md p-8 space-y-6">
            <div className="flex items-center gap-4 text-error">
              <div className="p-3 bg-error/10 rounded-full">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-xl font-bold">Clear All Data?</h3>
            </div>
            <p className="text-outline">This will permanently delete all uploaded prediction records. This action cannot be undone.</p>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsClearModalOpen(false)}>Cancel</Button>
              <Button variant="primary" className="flex-1 bg-error hover:bg-error/90" onClick={handleClearData} disabled={loading}>
                {loading ? <Loader2 className="animate-spin" size={18} /> : 'Clear Data'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Prediction Content Section */}
      <div className="grid grid-cols-12 gap-8">
        {/* Left Side: Controls & Insights */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <Card className="p-8 space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Settings2 className="text-primary" size={20} />
              Select Product
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-outline uppercase tracking-wider">Active Forecast</label>
                <select 
                  className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all text-sm outline-none"
                  value={selectedProductId || predictionRecords[0]?.id}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                >
                  {predictionRecords.map(rec => (
                    <option key={rec.id} value={rec.id}>{rec.productName}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-3 pt-4">
                <Button variant="outline" className="w-full" onClick={exportCSV}>
                  <Download size={16} />
                  CSV
                </Button>
                <Button variant="outline" className="w-full" onClick={exportPDF}>
                  <FileText size={16} />
                  PDF
                </Button>
              </div>
            </div>
          </Card>

          {/* AI Insights Section */}
          <Card variant="insight" className="p-8">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-secondary/10 rounded-full blur-3xl"></div>
            <h3 className="text-lg font-bold text-secondary mb-6 flex items-center gap-2">
              <Zap size={20} fill="currentColor" />
              Neural Insights
            </h3>
            <ul className="space-y-5">
              {getAIInsights().map((insight, i) => (
                <li key={i} className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                    {i === 0 ? <TrendingUp className="text-secondary" size={16} /> : <Cpu className="text-secondary" size={16} />}
                  </div>
                  <p className="text-sm font-medium leading-relaxed text-on-surface-variant">{insight}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Right Side: Outputs & Charts */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          {/* Metrics Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="flex items-center justify-between p-8">
              <div className="space-y-1">
                <p className="text-xs font-bold text-outline uppercase tracking-widest">Confidence level</p>
                <h4 className="text-4xl font-bold font-headline text-on-surface">{selectedRecord?.confidence}%</h4>
              </div>
              <div className="w-24 h-24 rounded-full bg-surface-container/30 flex items-center justify-center relative group">
                {/* SVG Backdrop for progress */}
                <svg className="w-full h-full transform -rotate-90 absolute inset-0 drop-shadow-sm">
                  {/* Track */}
                  <circle 
                    cx="48" 
                    cy="48" 
                    r="38" 
                    fill="transparent" 
                    stroke="currentColor" 
                    strokeWidth="8"
                    className="text-outline/10"
                  />
                  {/* Progress Arc (Safeguard 3) */}
                  <circle 
                    cx="48" 
                    cy="48" 
                    r="38" 
                    fill="transparent" 
                    stroke="currentColor" 
                    strokeWidth="8"
                    strokeLinecap="round"
                    style={{
                      transition: 'stroke-dashoffset 0.6s ease',
                      strokeDasharray: 2 * Math.PI * 38,
                      strokeDashoffset: (2 * Math.PI * 38) * (1 - (selectedRecord?.confidence || 0) / 100)
                    }}
                    className={cn(
                      (selectedRecord?.confidence || 0) > 85 ? "text-emerald-500" : 
                      (selectedRecord?.confidence || 0) > 70 ? "text-amber-500" : "text-rose-500"
                    )}
                  />
                </svg>
                <div className="flex flex-col items-center justify-center z-10">
                  <span className={cn(
                    "text-lg font-black font-headline tracking-tighter",
                    (selectedRecord?.confidence || 0) > 85 ? "text-emerald-600 dark:text-emerald-400" : 
                    (selectedRecord?.confidence || 0) > 70 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"
                  )}>
                    {selectedRecord?.confidence}%
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-outline leading-none">
                    {(selectedRecord?.confidence || 0) > 85 ? 'HIGH' : (selectedRecord?.confidence || 0) > 70 ? 'MED' : 'LOW'}
                  </span>
                </div>
              </div>
            </Card>
            <Card className="p-8">
              <p className="text-xs font-bold text-outline uppercase tracking-widest mb-1">Suggested stock level</p>
              <div className="flex items-baseline gap-2">
                <h4 className="text-4xl font-bold font-headline text-on-surface">{selectedRecord?.suggestedStock.toLocaleString()}</h4>
                <span className="text-lg font-medium text-outline">Units</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs font-bold text-secondary">
                {selectedRecord?.trend === 'Increasing' ? <ArrowUpRight size={14} /> : <TrendingUp className="rotate-180" size={14} />}
                {selectedRecord?.trend} Trend Detected
              </div>
            </Card>
          </div>

          {/* Main Chart */}
          <Card className="p-8">
            <div className="flex justify-between items-center mb-10">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold">{selectedRecord?.productName} Forecast</h3>
                  {selectedRecord?.dataSource !== 'historical' && (
                    <Badge variant="outline" className="bg-secondary/5 text-secondary border-secondary/20 text-[10px] py-0 px-2 font-medium">
                      {selectedRecord?.dataSource === 'inventory' ? 'Generated from inventory data' : 'Estimated from available dataset'}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-outline">Historical Data + Forecast through December</p>
              </div>
              <div className="flex gap-2">
                <Badge 
                  variant={selectedRecord?.dataQuality === 'high' ? 'success' : selectedRecord?.dataQuality === 'medium' ? 'primary' : 'error'}
                  className="px-3"
                >
                  {selectedRecord?.dataQuality.toUpperCase()} QUALITY
                </Badge>
                <Badge variant={selectedRecord?.trend === 'Increasing' ? 'success' : selectedRecord?.trend === 'Decreasing' ? 'error' : 'primary'}>
                  {selectedRecord?.trend.toUpperCase()}
                </Badge>
              </div>
            </div>
            
            {chartData.length === 0 ? (
              <div className="h-80 w-full flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-outline-variant/30 bg-surface-container-low/20">
                <TrendingUp className="text-outline/30" size={36} />
                <p className="text-sm font-bold text-outline">Data unavailable for this product</p>
                <p className="text-[11px] text-outline/60 uppercase tracking-widest font-medium">Upload historical data to see forecast</p>
              </div>
            ) : (
              <>
                {/* Legend */}
                <div className="flex items-center gap-6 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-[3px] rounded-full bg-primary inline-block" />
                    <span className="text-xs font-bold text-outline uppercase tracking-wider">Actual</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg width="32" height="3" viewBox="0 0 32 3">
                      <line x1="0" y1="1.5" x2="32" y2="1.5"
                        stroke="var(--color-secondary)" strokeWidth="2.5"
                        strokeDasharray="6 4" strokeLinecap="round" />
                    </svg>
                    <span className="text-xs font-bold text-outline uppercase tracking-wider">Forecast</span>
                  </div>
                </div>

                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorActualFc" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.28}/>
                          <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorPredFc" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-secondary)" stopOpacity={0.22}/>
                          <stop offset="95%" stopColor="var(--color-secondary)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="var(--color-outline-variant)"
                        strokeOpacity={0.5}
                      />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--color-outline)' }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--color-outline)' }}
                        width={48}
                      />
                      <Tooltip
                        content={<CustomTooltip />}
                        cursor={{ stroke: 'var(--color-outline-variant)', strokeWidth: 1.5 }}
                      />

                      {/* ACTUAL: solid line with fill, stops at lastIndex */}
                      <Area
                        type="monotone"
                        dataKey="actual"
                        name="actual"
                        stroke="var(--color-primary)"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorActualFc)"
                        connectNulls={false}
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--color-surface)' }}
                      />

                      {/* PREDICTED: dashed line with fill, starts from lastIndex */}
                      <Area
                        type="monotone"
                        dataKey="predicted"
                        name="predicted"
                        stroke="var(--color-secondary)"
                        strokeWidth={2.5}
                        strokeDasharray="8 5"
                        fillOpacity={1}
                        fill="url(#colorPredFc)"
                        connectNulls={false}
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--color-surface)' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
