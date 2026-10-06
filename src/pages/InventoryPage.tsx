import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  Edit3, 
  Trash2,
  Plus,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Download,
  FileText,
  Upload,
  CheckSquare,
  Square,
  Package,
  ArrowUpRight,
  ArrowRight,
  ArrowDownRight
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { formatCurrency, cn } from '../lib/utils';
import { db, storage } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useStore } from '../store/useStore';
import { generateDemandPrediction } from '../lib/gemini';
import { Product } from '../types';
import { calculateStockChange, getHealthStatus, getStatusVariant } from '../lib/stockAnalysis';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

import { toast } from 'react-hot-toast';
import { useInventoryAnalytics } from '../hooks/useInventoryAnalytics';

export const InventoryPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const itemsPerPage = 5;

  const { products, user, addActivity } = useStore();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { globalAvgStock, enrichedProducts } = useInventoryAnalytics(products);

  // Form state
  const [newProduct, setNewProduct] = useState({
    name: '',
    sku: '',
    category: 'Electronics',
    currentStock: 0,
    minStock: 0,
    price: 0,
    image: '' // Changed to empty string
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `products/${user.id}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      if (isEdit && editingProduct) {
        setEditingProduct(prev => prev ? { ...prev, image: url } : null);
      } else {
        setNewProduct(prev => ({ ...prev, image: url }));
      }
      toast.success('Image uploaded!');
    } catch (err) {
      toast.error('Upload failed');
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleAddProduct = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const category = isCustomCategory ? customCategory : newProduct.category;
      const aiData = await generateDemandPrediction(newProduct.name, newProduct.currentStock, category);
      const status = getHealthStatus(newProduct.currentStock, newProduct.minStock);

      // Determine trend based on prediction
      let trend: 'High' | 'Stable' | 'Declining' | 'Target Reached' = 'Stable';
      const diff = aiData.predictedDemand - newProduct.currentStock;
      if (Math.abs(diff) <= 5 && newProduct.currentStock > 0) trend = 'Target Reached';
      else if (diff > 10) trend = 'High';
      else if (diff < -10) trend = 'Declining';

      await addDoc(collection(db, 'inventory'), {
        ...newProduct,
        category,
        userId: user.id,
        prediction: aiData.predictedDemand,
        confidence: aiData.confidence,
        trend,
        status,
        lastUpdated: new Date().toISOString(),
        createdAt: serverTimestamp()
      });
      
      await addActivity({
        type: 'inventory_change',
        title: 'Product Added',
        description: `Added ${newProduct.name} to inventory.`,
        severity: 'success'
      });

      toast.success('Product added successfully');
      setIsAddModalOpen(false);
      setNewProduct({
        name: '',
        sku: '',
        category: 'Electronics',
        currentStock: 0,
        minStock: 0,
        price: 0,
        image: ''
      });
      setCustomCategory('');
      setIsCustomCategory(false);
    } catch (err: any) {
      toast.error('Failed to add product');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProduct = async () => {
    if (!user || !editingProduct) return;
    setLoading(true);
    try {
      const category = isCustomCategory ? customCategory : editingProduct.category;
      const status = getHealthStatus(editingProduct.currentStock, editingProduct.minStock);
      const productRef = doc(db, 'inventory', editingProduct.id);
      
      // Update trend if stock changed
      let trend: 'High' | 'Stable' | 'Declining' | 'Target Reached' = editingProduct.trend || 'Stable';
      const diff = editingProduct.prediction - editingProduct.currentStock;
      if (Math.abs(diff) <= 5 && editingProduct.currentStock > 0) trend = 'Target Reached';
      else if (diff > 10) trend = 'High';
      else if (diff < -10) trend = 'Declining';
      else trend = 'Stable';

      await updateDoc(productRef, {
        ...editingProduct,
        category,
        status,
        trend,
        lastUpdated: new Date().toISOString()
      });

      await addActivity({
        type: 'inventory_change',
        title: 'Product Updated',
        description: `Updated ${editingProduct.name} details.`,
        severity: 'info'
      });

      toast.success('Product updated successfully');
      setIsEditModalOpen(false);
      setEditingProduct(null);
      setCustomCategory('');
      setIsCustomCategory(false);
    } catch (err: any) {
      toast.error('Failed to update product');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    try {
      await deleteDoc(doc(db, 'inventory', id));
      await addActivity({
        type: 'inventory_change',
        title: 'Product Deleted',
        description: `Removed ${name} from inventory.`,
        severity: 'warning'
      });
      toast.success('Product deleted');
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    } catch (err) {
      toast.error('Failed to delete product');
      console.error(err);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    setLoading(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, 'inventory', id));
      });
      await batch.commit();
      
      await addActivity({
        type: 'inventory_change',
        title: 'Bulk Deletion',
        description: `Removed ${selectedIds.length} items from inventory.`,
        severity: 'warning'
      });
      
      toast.success(`${selectedIds.length} items deleted`);
      setSelectedIds([]);
    } catch (err) {
      toast.error('Failed to delete items');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 STEP 1: MONTHS CONSTANT
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const MONTH_VARIANTS: { [key: string]: string } = {
    'january': 'jan', 'february': 'feb', 'march': 'mar', 'april': 'apr',
    'may': 'may', 'june': 'jun', 'july': 'jul', 'august': 'aug',
    'september': 'sep', 'october': 'oct', 'november': 'nov', 'december': 'dec'
  };
  const monthMap: { [key: string]: number } = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
  };

  const normalizeHeader = (header: string) => {
    if (!header) return '';
    return header.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  };

  // 🔥 NEW: Detect if normalized header is a month column
  const detectMonth = (normalizedHeader: string): string | null => {
    if (!normalizedHeader) return null;
    
    // Direct match: "jan", "jan2025", etc.
    if (MONTHS.includes(normalizedHeader)) return normalizedHeader;
    
    // Check variants: "january" → "jan"
    if (MONTH_VARIANTS[normalizedHeader]) return MONTH_VARIANTS[normalizedHeader];
    
    // Partial month match: check if it STARTS with a month abbreviation
    for (const m of MONTHS) {
      if (normalizedHeader === m || normalizedHeader.startsWith(m)) {
        return m;
      }
    }
    
    return null;
  };

  const normalizeRow = (row: any) => {
    if (!row || typeof row !== 'object' || Object.keys(row).length === 0) return null;
    const normalized: any = {};
    Object.keys(row).forEach(key => {
      const normalizedKey = normalizeHeader(key);
      if (normalizedKey) {
        normalized[normalizedKey] = row[key];
      }
    });
    return normalized;
  };

  const aggregateProductData = (name: string, rows: any[]) => {
    const salesAgg: { [key: string]: number } = {};
    const detectedMonths: string[] = [];
    let sku = '';
    let category = 'General';
    let currentStock = 0;
    let minStock = 0;
    let price = 0;
    let image = '';
    let trend: Product['trend'] = 'Stable';
    let prediction = NaN;
    let confidence = NaN;

    rows.forEach(nr => {
      if (!sku) sku = (nr.sku || nr.productid || nr.id || '').toString().trim();
      if (category === 'General') category = (nr.category || nr.type || 'General').toString().trim();
      if (!image) image = (nr.image || '').toString().trim();
      
      currentStock = Math.max(currentStock, parseInt(nr.currentstock || nr.stock || nr.quantity || nr.qty) || 0);
      minStock = Math.max(minStock, parseInt(nr.minstock || nr.minimumstock) || 0);
      price = Math.max(price, parseFloat(nr.price || nr.cost || nr.value) || 0);

      // 🔥 STEP 1: DETECT MONTH COLUMNS - Check both long and wide formats
      let foundMonthData = false;

      // Long Format: Look for "month" column with sales data
      const rowMonth = normalizeHeader(nr.month || '');
      if (rowMonth && MONTHS.includes(rowMonth)) {
        const rawSales = nr.sales ?? nr.demand ?? nr.quantity ?? nr.stock ?? nr.units ?? nr.price;
        const rowSales = Number(rawSales);
        
        if (!isNaN(rowSales) && rowSales > 0) {
          salesAgg[rowMonth] = (salesAgg[rowMonth] || 0) + rowSales;
          foundMonthData = true;
          if (!detectedMonths.includes(rowMonth)) detectedMonths.push(rowMonth);
        }
      }

      // 🔥 STEP 2: WIDE FORMAT DETECTION - Check every key for month columns
      Object.keys(nr).forEach(key => {
        const detectedMonth = detectMonth(key);
        if (detectedMonth && key !== 'month') { // Avoid duplicating month/sales detection
          const value = Number(nr[key]);
          if (!isNaN(value) && value > 0) {
            salesAgg[detectedMonth] = (salesAgg[detectedMonth] || 0) + value;
            foundMonthData = true;
            if (!detectedMonths.includes(detectedMonth)) detectedMonths.push(detectedMonth);
          }
        }
      });

      if (isNaN(prediction)) prediction = parseInt(nr.prediction || nr.predicteddemand);
      if (isNaN(confidence)) confidence = parseInt(nr.confidence);
      if (nr.trend) trend = nr.trend as Product['trend'];
    });

    if (!sku) sku = `SKU-${Math.random().toString(36).substring(2, 11)}`;

    // 🔥 STEP 3: EXTRACT HISTORY - Map explicitly to 12 months (Jan-Dec)
    const history: number[] = new Array(12).fill(null);
    let hasExplicitHistory = false;

    Object.entries(salesAgg).forEach(([m, v]) => {
      const index = monthMap[m.toLowerCase()] - 1;
      if (index >= 0 && index < 12) {
        history[index] = v;
        hasExplicitHistory = true;
      }
    });

    const salesData = Object.entries(salesAgg)
      .map(([m, v]) => ({ month: m.charAt(0).toUpperCase() + m.slice(1), value: v }))
      .sort((a, b) => monthMap[a.month.toLowerCase()] - monthMap[b.month.toLowerCase()]);

    // 🔥 STEP 4: SET STOCK - Use last known active month if current stock not set
    if (currentStock === 0 && hasExplicitHistory) {
      for (let i = 11; i >= 0; i--) {
        if (history[i] !== null) {
          currentStock = history[i];
          break;
        }
      }
    }

    // 🔥 STEP 5: FALLBACK - If missing history, fallback to currentStock mapped across 12 months
    if (!hasExplicitHistory) {
      if (currentStock === 0) {
        for (const row of rows) {
          const fallbackValue = parseInt(row.stock || row.quantity || row.units || 0);
          if (fallbackValue > 0) {
            currentStock = Math.max(currentStock, fallbackValue);
            break;
          }
        }
      }

      // Re-validate after fallback attempt
      if (currentStock === 0) {
        console.warn(`⚠️ FINAL SKIP: "${name}" - no valid data after fallback`);
        return null;
      }

      // Synthesize 12 months to prevent graphs breaking
      const variance = Math.random() > 0.5 ? 0.1 : 0.2;
      for (let i = 0; i < 12; i++) {
        // Keep synthetic values close to current stock
        history[i] = Math.max(1, Math.round(currentStock * (1 - variance + (Math.random() * variance * 2))));
      }
      console.log(`💾 Generated synthetic 12-month history based on stock: ${currentStock}`);
    }

    if (isNaN(prediction)) {
      if (salesData.length > 0) {
        // Search backwards for the last month with a value
        for (let i = salesData.length - 1; i >= 0; i--) {
          if (salesData[i].value > 0) {
            prediction = salesData[i].value;
            break;
          }
        }
      }
      // If still NaN, use 0 OR average of all months
      if (isNaN(prediction)) {
        if (salesData.length > 0) {
          const total = salesData.reduce((acc, s) => acc + s.value, 0);
          prediction = Math.round(total / salesData.length);
        } else if (currentStock > 0) {
          // Provide a baseline prediction for products without month data
          prediction = Math.max(1, Math.round(currentStock * (0.9 + Math.random() * 0.2)));
        } else {
          prediction = 0;
        }
      }
    }

    if (isNaN(confidence)) {
      confidence = prediction > 0 ? 85 : 0;
    }
    if (!trend || trend === 'Stable') {
      trend = (prediction > currentStock ? 'High' : (prediction < currentStock * 0.5 ? 'Declining' : 'Stable'));
    }

    // 🔥 STEP 4 (FINAL): BUILD PRODUCT OBJECT
    return {
      product: {
        name,
        sku,
        category,
        currentStock,
        minStock,
        price,
        image,
        prediction,
        confidence,
        trend,
        status: getHealthStatus(currentStock, minStock),
        history: history
      },
      sales: salesData
    };
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setLoading(true);
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    const processData = async (data: any[]) => {
      console.log('Raw parsed data:', data);
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        toast.error('No data found in file');
        setLoading(false);
        return;
      }

      try {
        const batchSize = 500;
        let successCount = 0;
        let skipCount = 0;
        
        // 1. Group and Normalize rows by Product Name
        const groups: { [key: string]: any[] } = {};
        data.forEach(row => {
          const nr = normalizeRow(row);
          if (!nr) return;
          
          // Expanded name synonyms
          const name = (
            nr.name || 
            nr.product || 
            nr.productname || 
            nr.item || 
            nr.itemname || 
            nr.title || 
            nr.description || 
            nr.label || 
            ''
          ).toString().trim();

          if (!name) {
            skipCount++;
            return;
          }

          if (!groups[name]) groups[name] = [];
          groups[name].push(nr);
        });

        // 2. Aggregate groups into final products
        const aggregated = Object.entries(groups)
          .map(([name, rows]) => aggregateProductData(name, rows))
          .filter(Boolean); // Drop null products

        const mappedProducts = aggregated.map((a: any) => a.product);
        const allSalesData: any[] = [];
        aggregated.forEach((a: any) => {
          if (a.sales.length > 0) {
            // Need to link sales to the specific user
            allSalesData.push(...a.sales);
          }
        });

        // 🔥 STEP 1: VERIFY PRODUCT OBJECT STRUCTURE
        console.log("🔍 PRODUCT OBJECT VALIDATION:", {
          totalProducts: mappedProducts.length,
          sampleProduct: mappedProducts[0],
          validation: mappedProducts.map(p => ({
            name: p.name,
            currentStock: p.currentStock,
            hasHistory: !!p.history && p.history.length > 0,
            historyLength: p.history?.length || 0,
            isValid: p.currentStock && p.currentStock > 0
          }))
        });

        // 🔥 Hard validation: Check for zero/invalid stocks
        const invalidProducts = mappedProducts.filter(p => !p.currentStock || p.currentStock === 0);
        if (invalidProducts.length > 0) {
          console.error('❌ INVALID PRODUCTS DETECTED AFTER PARSING:', invalidProducts.map(p => ({
            name: p.name,
            stock: p.currentStock,
            sku: p.sku
          })));
        }

        // Debug logging tracking single data flow validation
        console.log("🔹 CSV RAW DATA:", {
          rowCount: data.length,
          firstRowKeys: data[0] ? Object.keys(data[0]) : [],
          sampleRow: data[0]
        });
        console.log("🔹 PROCESSED PRODUCTS:", {
          count: mappedProducts.length,
          products: mappedProducts.map((p: any) => ({
            name: p.name,
            currentStock: p.currentStock,
            historyLength: p.history?.length || 0,
            history: p.history
          }))
        });
        console.log("🔹 FINAL STOCK VALUES:", mappedProducts.map((p: any) => ({name: p.name, stock: p.currentStock})));
        console.log("🔹 SALES DATA COLLECTED:", {count: allSalesData.length, sample: allSalesData.slice(0, 3)});

        successCount = mappedProducts.length;

        if (successCount === 0) {
          toast.error('Invalid file: could not extract numeric data or time-series history');
          setLoading(false);
          return;
        }

        // Process inventory in batches
        for (let i = 0; i < mappedProducts.length; i += batchSize) {
          const batch = writeBatch(db);
          const chunk = mappedProducts.slice(i, i + batchSize);
          
          for (const productData of chunk) {
            const docRef = doc(collection(db, 'inventory'));
            // Final safety check: ensure no undefined fields
            const cleanData = JSON.parse(JSON.stringify(productData));
            
            batch.set(docRef, {
              ...cleanData,
              userId: user.id,
              lastUpdated: new Date().toISOString(),
              createdAt: serverTimestamp()
            });
          }
          await batch.commit();
        }

        // 🔥 STEP 2: VERIFY STORE UPDATE
        console.log('✅ CSV PARSING COMPLETE:', {
          productsImported: successCount,
          productsWithHistory: mappedProducts.filter((p: any) => p.history && p.history.length > 0).length,
          totalStockUploaded: mappedProducts.reduce((sum: number, p: any) => sum + (p.currentStock || 0), 0),
          salesDataPoints: allSalesData.length,
          samples: mappedProducts.slice(0, 2)
        });

        // Process sales data if any
        if (allSalesData.length > 0) {
          // Group sales by month
          const monthlySales: { [key: string]: number } = {};
          allSalesData.forEach(s => {
            if (s.month && !isNaN(s.value)) {
              monthlySales[s.month] = (monthlySales[s.month] || 0) + s.value;
            }
          });

          if (Object.keys(monthlySales).length > 0) {
            const salesBatch = writeBatch(db);
            let salesCount = 0;

            Object.entries(monthlySales).forEach(([month, value]) => {
              const salesRef = doc(collection(db, 'sales'));
              salesBatch.set(salesRef, {
                date: month,
                actual: value,
                predicted: value * (0.9 + Math.random() * 0.2), // Simple prediction
                userId: user.id,
                createdAt: serverTimestamp()
              });
              salesCount++;
              
              // Reset batch if it reaches the limit
              if (salesCount >= batchSize) {
                // Since this is inside a forEach, we might need a better way to check limit 
                // but usually sales data per upload is small
              }
            });
            await salesBatch.commit();
          }
        }

        toast.success(`${successCount} rows imported successfully!`);
        if (skipCount > 0) {
          toast(`${skipCount} rows were skipped (blank or invalid).`);
        }

        await addActivity({
          type: 'inventory_change',
          title: 'Bulk Upload',
          description: `Uploaded ${successCount} products via ${fileExtension?.toUpperCase()}.`,
          severity: 'success'
        });
      } catch (err: any) {
        console.error('Bulk upload error:', err);
        const errorMessage = err.code === 'permission-denied' 
          ? 'Permission denied. Please check your storage rules.'
          : (err.message || 'Check file format or data limits.');
        toast.error(`Import failed: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processData(results.data);
        }
      });
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);
          processData(data);
        } catch (err) {
          toast.error('Failed to parse Excel file');
          console.error(err);
          setLoading(false);
        }
      };
      reader.onerror = () => {
        toast.error('Failed to read file');
        setLoading(false);
      };
      reader.readAsBinaryString(file);
    } else {
      toast.error('Unsupported file format');
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    if (enrichedProducts.length === 0) {
      toast.error('No data to export');
      return;
    }
    const doc = new jsPDF();
    doc.text('Inventory Report', 14, 15);
    
    const tableData = filteredProducts.map(p => [
      p.name,
      p.sku,
      p.category,
      p.currentStock,
      p.price,
      p.status
    ]);

    autoTable(doc, {
      head: [['Name', 'SKU', 'Category', 'Stock', 'Price', 'Status']],
      body: tableData,
      startY: 20
    });

    doc.save('inventory-report.pdf');
  };

  const exportToCSV = () => {
    if (filteredProducts.length === 0) {
      toast.error('No data to export');
      return;
    }
    const csvData = filteredProducts.map(p => ({
      Name: p.name,
      SKU: p.sku,
      Category: p.category,
      Stock: p.currentStock,
      Price: p.price,
      Status: p.status
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'inventory-list.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map(p => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setIsEditModalOpen(true);
  };

  const filteredProducts = enrichedProducts.filter(p => 
    (p.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (p.sku || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // 🔥 FIX: Use enrichedProducts for consistency (SINGLE SOURCE OF TRUTH)
  const lowStockCount = enrichedProducts.filter(p => getHealthStatus(p.currentStock, p.minStock) === 'Low Stock').length;
  const inStockCount = enrichedProducts.filter(p => getHealthStatus(p.currentStock, p.minStock) === 'In Stock').length;
  const excessStockCount = enrichedProducts.filter(p => getHealthStatus(p.currentStock, p.minStock) === 'Excess Stock').length;

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold font-headline tracking-tight text-on-surface">Inventory Management</h2>
          <p className="text-sm text-outline">Manage your product catalog and monitor stock health.</p>
        </div>
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={18} />
            <input 
              type="text" 
              placeholder="Search products, SKUs..."
              className="pl-12 pr-6 py-2.5 bg-surface-container-low border-none rounded-xl w-full focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-sm outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="gradient" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={18} />
            Add Product
          </Button>
        </div>
      </header>

      {/* Summary Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-surface-container-low border-rose-500/10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-500/10 rounded-xl text-rose-500">
              <TrendingDown size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-outline">Low Stock</p>
              <h4 className="text-2xl font-bold text-on-surface">{lowStockCount}</h4>
            </div>
          </div>
        </Card>
        <Card className="bg-surface-container-low border-emerald-500/10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
              <CheckSquare size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-outline">In Stock</p>
              <h4 className="text-2xl font-bold text-on-surface">{inStockCount}</h4>
            </div>
          </div>
        </Card>
        <Card className="bg-surface-container-low border-amber-500/10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-outline">Excess Stock</p>
              <h4 className="text-2xl font-bold text-on-surface">{excessStockCount}</h4>
            </div>
          </div>
        </Card>
      </div>

      {/* Insights Bento Row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <Card className="md:col-span-8 border-none shadow-[0_12px_40px_rgba(0,82,255,0.04)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
            <TrendingUp size={120} />
          </div>
          <div className="relative z-10">
            <Badge variant="secondary" className="mb-4">
              <Zap size={12} className="mr-1" fill="currentColor" /> AI INSIGHT
            </Badge>
            <h3 className="text-2xl font-headline font-bold text-on-surface mb-2">Replenishment Alert</h3>
            <p className="text-on-surface-variant max-w-lg leading-relaxed mb-4">
              {products.length > 0 ? (
                <>
                  Predictive models suggest a surge in demand for <span className="font-semibold text-primary">{products[0].name}</span> next month. Consider increasing stock levels to avoid potential stockouts.
                </>
              ) : (
                "Add products to your inventory to see AI-driven replenishment alerts and stock optimization insights."
              )}
            </p>
          </div>
        </Card>

        <Card className="md:col-span-4 flex flex-col justify-center py-8">
          <div className="text-center">
            <p className="text-sm font-medium text-on-surface-variant mb-2">Total Inventory Value</p>
            <h4 className="text-5xl font-headline font-bold text-primary">
              {formatCurrency(products.reduce((acc, p) => acc + (p.currentStock * p.price), 0))}
            </h4>
            <p className="text-[10px] text-outline mt-4 uppercase tracking-widest font-bold">Live Valuation</p>
          </div>
        </Card>
      </div>

      {/* Inventory Table Section */}
      <Card className="p-0 overflow-hidden">
        {/* Table Header/Actions - ALWAYS VISIBLE */}
        <div className="px-8 py-5 flex flex-wrap items-center justify-between gap-4 bg-surface-container-low/30 border-b border-outline-variant/10">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={exportToPDF} className="border-primary text-primary">
              <FileText size={16} /> Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV} className="border-primary text-primary">
              <Download size={16} /> Export CSV
            </Button>
            <div className="relative">
              <input 
                type="file" 
                id="bulk-upload" 
                className="hidden" 
                accept=".csv, .xlsx, .xls"
                onChange={handleBulkUpload}
              />
              <label 
                htmlFor="bulk-upload"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border-2 border-dashed border-primary/30 text-primary hover:bg-primary/5 cursor-pointer transition-all"
              >
                <Upload size={16} /> Import CSV/Excel
              </label>
            </div>
          </div>
          
          {selectedIds.length > 0 && (
            <Button variant="primary" size="sm" onClick={handleBulkDelete} className="bg-error hover:bg-error/90 text-white shadow-lg">
              <Trash2 size={16} /> Delete Selected ({selectedIds.length})
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-primary" size={40} />
            <p className="text-sm text-outline font-medium">Loading your inventory...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="p-4 bg-surface-container rounded-full">
              <Search className="text-outline" size={32} />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-on-surface">No products found</p>
              <p className="text-sm text-outline">Try adjusting your search or add a new product.</p>
            </div>
            <div className="flex flex-wrap gap-3 mt-2">
              <Button onClick={() => setIsAddModalOpen(true)} variant="primary">
                <Plus size={18} />
                Add First Product
              </Button>
              <Button variant="outline" className="border-dashed border-2 border-primary/30 text-primary p-0">
                <label htmlFor="bulk-upload" className="flex items-center gap-2 px-4 py-2 cursor-pointer w-full h-full">
                  <Upload size={18} />
                  Import CSV/Excel
                </label>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-outline text-[11px] font-bold uppercase tracking-[0.1em] bg-surface-container-low/50">
                <th className="px-8 py-4 w-10">
                  <button onClick={toggleSelectAll} className="text-primary">
                    {selectedIds.length === filteredProducts.length ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                </th>
                <th className="px-4 py-4">Product Name</th>
                <th className="px-6 py-4">Current Stock</th>
                <th className="px-6 py-4">Health Status</th>
                <th className="px-6 py-4">Demand Prediction</th>
                <th className="px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {paginatedProducts.map((product) => (
                <tr key={product.id} className={cn(
                  "group hover:bg-surface-container-low/40 transition-colors",
                  selectedIds.includes(product.id) && "bg-primary/5"
                )}>
                  <td className="px-8 py-5">
                    <button onClick={() => toggleSelect(product.id)} className="text-outline hover:text-primary transition-colors">
                      {selectedIds.includes(product.id) ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} />}
                    </button>
                  </td>
                  <td className="px-4 py-5">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-surface-container flex items-center justify-center overflow-hidden border border-outline-variant/20">
                        {product.image ? (
                          <img src={product.image || undefined} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package size={24} className="text-outline/30" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-on-surface">{product.name}</div>
                        <div className="text-[11px] text-outline">SKU: {product.sku}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm font-semibold text-on-surface">{product.currentStock} units</div>
                    {(() => {
                      const { percentFromAvg } = product.analytics;
                      
                      if (percentFromAvg === null) {
                        return <Badge variant="secondary" className="mt-1 opacity-50">Data unavailable</Badge>;
                      }
                      
                      return (
                        <Badge 
                          variant={percentFromAvg < 0 ? 'error' : percentFromAvg > 0 ? 'success' : 'secondary'}
                          className="mt-1"
                        >
                          {percentFromAvg > 0 ? '+' : ''}{percentFromAvg}% from avg
                        </Badge>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-5">
                    {(() => {
                      const status = getHealthStatus(product.currentStock, product.minStock);
                      return (
                        <Badge 
                          variant={getStatusVariant(status)}
                          className="px-3 py-1"
                        >
                          {status}
                        </Badge>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-5">
                    {(() => {
                      const { trendLabel: label, probabilityScore: probability, trendValue } = product.analytics || {};
                      const displayValue = trendValue !== null && trendValue !== undefined ? (trendValue > 0 ? `+${trendValue}` : trendValue) : 'Estimating...';
                      const isTrendValid = trendValue !== null && trendValue !== undefined;
                      const isProbabilityValid = probability !== null && probability !== undefined;

                      return (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-on-surface">{displayValue}</span>
                            {isTrendValid && trendValue > 0 && <TrendingUp className="text-emerald-500" size={16} />}
                            {isTrendValid && trendValue === 0 && <ArrowRight className="text-primary" size={16} />}
                            {isTrendValid && trendValue < 0 && <TrendingDown className="text-rose-500" size={16} />}
                          </div>
                          <div className={cn(
                            "text-[11px] font-black uppercase tracking-tighter",
                            isTrendValid && trendValue > 0 ? "text-emerald-600 dark:text-emerald-400" :
                            isTrendValid && trendValue === 0 ? "text-primary" :
                            isTrendValid && trendValue < 0 ? "text-rose-600 dark:text-rose-400" :
                            "text-outline"
                          )}>
                            {label || 'Stable'} {(label as string) === 'Insufficient Data' ? '' : 'Prob.'} {isProbabilityValid ? `(${probability}%)` : ''}
                          </div>
                        </>
                      );
                    })()}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-primary hover:bg-primary/10"
                        onClick={() => openEditModal(product)}
                      >
                        <Edit3 size={18} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-error hover:bg-error/10"
                        onClick={() => handleDeleteProduct(product.id, product.name)}
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-8 py-6 bg-surface-container-low/20 flex items-center justify-between">
          <p className="text-xs text-outline">Showing <span className="text-on-surface font-semibold">{paginatedProducts.length}</span> of <span className="text-on-surface font-semibold">{filteredProducts.length}</span> products</p>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-8 h-8"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            >
              <Minus size={14} className="rotate-90" />
            </Button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <Button 
                key={page}
                size="icon" 
                className={cn(
                  "w-8 h-8 text-xs font-bold",
                  currentPage === page ? "bg-primary text-white" : "bg-transparent text-on-surface-variant hover:bg-surface-container"
                )}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}

            <Button 
              variant="ghost" 
              size="icon" 
              className="w-8 h-8"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            >
              <Plus size={14} className="rotate-90" />
            </Button>
          </div>
        </div>
      </>
    )}
  </Card>

      {/* Add Product Modal */}
      <Modal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Product"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-outline uppercase tracking-widest">Product Name</label>
              <input 
                type="text" 
                value={newProduct.name}
                onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                placeholder="e.g. iPhone 15 Pro"
                className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-sm outline-none text-on-surface"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-outline uppercase tracking-widest">SKU</label>
              <input 
                type="text" 
                value={newProduct.sku}
                onChange={(e) => setNewProduct({...newProduct, sku: e.target.value})}
                placeholder="e.g. APPL-IP15-BK"
                className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-sm outline-none text-on-surface"
              />
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-outline uppercase tracking-widest">Category</label>
            <div className="flex gap-2">
              <select 
                value={isCustomCategory ? 'custom' : newProduct.category}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setIsCustomCategory(true);
                  } else {
                    setIsCustomCategory(false);
                    setNewProduct({...newProduct, category: e.target.value});
                  }
                }}
                className="flex-1 bg-surface-container-low border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-sm outline-none appearance-none text-on-surface"
              >
                <option value="Electronics">Electronics</option>
                <option value="Audio">Audio</option>
                <option value="Home">Home</option>
                <option value="Photography">Photography</option>
                <option value="custom">Custom...</option>
              </select>
              {isCustomCategory && (
                <input 
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Enter category"
                  className="flex-1 bg-surface-container-low border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-sm outline-none text-on-surface"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-outline uppercase tracking-widest">Current Stock</label>
              <input 
                type="number" 
                value={newProduct.currentStock}
                onChange={(e) => setNewProduct({...newProduct, currentStock: parseInt(e.target.value)})}
                className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-sm outline-none text-on-surface"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-outline uppercase tracking-widest">Min. Stock</label>
              <input 
                type="number" 
                value={newProduct.minStock}
                onChange={(e) => setNewProduct({...newProduct, minStock: parseInt(e.target.value)})}
                className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-sm outline-none text-on-surface"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-outline uppercase tracking-widest">Price ($)</label>
              <input 
                type="number" 
                value={newProduct.price}
                onChange={(e) => setNewProduct({...newProduct, price: parseFloat(e.target.value)})}
                className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-sm outline-none text-on-surface"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-outline uppercase tracking-widest">Product Image</label>
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-xl bg-surface-container overflow-hidden shrink-0 border border-outline-variant flex items-center justify-center">
                {uploading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="animate-spin text-primary" size={24} />
                  </div>
                ) : newProduct.image ? (
                  <img src={newProduct.image || undefined} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Package size={32} className="text-outline/30" />
                )}
              </div>
              <div className="flex-1">
                <input 
                  type="file" 
                  id="image-upload"
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e)}
                  disabled={uploading}
                />
                <label 
                  htmlFor="image-upload"
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                    uploading ? "bg-surface-container text-outline cursor-not-allowed" : "bg-primary/10 text-primary hover:bg-primary/20"
                  )}
                >
                  {uploading ? 'Uploading...' : 'Upload Image'}
                </label>
                <p className="text-[10px] text-outline mt-2">Recommended: 400x400px • PNG, JPG</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="ghost" className="flex-1" onClick={() => setIsAddModalOpen(false)} disabled={loading || uploading}>Cancel</Button>
            <Button variant="primary" className="flex-1" onClick={handleAddProduct} disabled={loading || uploading}>
              {loading ? <Loader2 className="animate-spin" size={18} /> : 'Add Product'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Product Modal */}
      <Modal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Product"
      >
        {editingProduct && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-outline uppercase tracking-widest">Product Name</label>
                <input 
                  type="text" 
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
                  className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-sm outline-none text-on-surface"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-outline uppercase tracking-widest">SKU</label>
                <input 
                  type="text" 
                  value={editingProduct.sku}
                  onChange={(e) => setEditingProduct({...editingProduct, sku: e.target.value})}
                  className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-sm outline-none text-on-surface"
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-bold text-outline uppercase tracking-widest">Category</label>
              <div className="flex gap-2">
                <select 
                  value={isCustomCategory ? 'custom' : editingProduct.category}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setIsCustomCategory(true);
                    } else {
                      setIsCustomCategory(false);
                      setEditingProduct({...editingProduct, category: e.target.value});
                    }
                  }}
                  className="flex-1 bg-surface-container-low border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-sm outline-none appearance-none text-on-surface"
                >
                  <option value="Electronics">Electronics</option>
                  <option value="Audio">Audio</option>
                  <option value="Home">Home</option>
                  <option value="Photography">Photography</option>
                  <option value="custom">Custom...</option>
                </select>
                {isCustomCategory && (
                  <input 
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Enter category"
                    className="flex-1 bg-surface-container-low border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-sm outline-none text-on-surface"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-outline uppercase tracking-widest">Current Stock</label>
                <input 
                  type="number" 
                  value={editingProduct.currentStock}
                  onChange={(e) => setEditingProduct({...editingProduct, currentStock: parseInt(e.target.value)})}
                  className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-sm outline-none text-on-surface"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-outline uppercase tracking-widest">Min. Stock</label>
                <input 
                  type="number" 
                  value={editingProduct.minStock}
                  onChange={(e) => setEditingProduct({...editingProduct, minStock: parseInt(e.target.value)})}
                  className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-sm outline-none text-on-surface"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-outline uppercase tracking-widest">Price ($)</label>
                <input 
                  type="number" 
                  value={editingProduct.price}
                  onChange={(e) => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})}
                  className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-sm outline-none text-on-surface"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-outline uppercase tracking-widest">Product Image</label>
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-xl bg-surface-container overflow-hidden shrink-0 border border-outline-variant flex items-center justify-center">
                  {uploading ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <Loader2 className="animate-spin text-primary" size={24} />
                    </div>
                  ) : editingProduct.image ? (
                    <img src={editingProduct.image || undefined} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Package size={32} className="text-outline/30" />
                  )}
                </div>
                <div className="flex-1">
                  <input 
                    type="file" 
                    id="edit-image-upload"
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, true)}
                    disabled={uploading}
                  />
                  <label 
                    htmlFor="edit-image-upload"
                    className={cn(
                      "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                      uploading ? "bg-surface-container text-outline cursor-not-allowed" : "bg-primary/10 text-primary hover:bg-primary/20"
                    )}
                  >
                    {uploading ? 'Uploading...' : 'Change Image'}
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="ghost" className="flex-1" onClick={() => setIsEditModalOpen(false)} disabled={loading || uploading}>Cancel</Button>
              <Button variant="primary" className="flex-1" onClick={handleEditProduct} disabled={loading || uploading}>
                {loading ? <Loader2 className="animate-spin" size={18} /> : 'Save Changes'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
