# CSV TIME-SERIES PARSER - QUICK START GUIDE

## 🎯 What Changed

Your CSV parser **NOW CORRECTLY HANDLES MONTH-BASED COLUMNS** (Jan, Feb, Mar, etc.)

```csv
Product,Jan,Feb,Mar,Apr,May,Jun
Apple Juice,1500,1600,1800,2000,2100,1900
Orange Juice,2000,2200,2100,1900,2300,2200
```

✅ **Before:** Stock = 0, Data = unavailable
✅ **After:** Stock = 1900 (last month), History = [1500, 1600, 1800, 2000, 2100, 1900]

---

## 🔥 Implementation Details

### New Functions Added

**1. `detectMonth(normalizedHeader: string)`** - Robust month detection
- Supports: "jan", "january", "JAN", "JANUARY", "jan2025"
- Returns: Normalized month ("jan", "feb", etc.) or null

**2. `aggregateProductData()` - 7-Step Process**
```
┌─────────────────────────────────────────────────────────┐
│ STEP 1: Detect month columns in CSV headers             │
├─────────────────────────────────────────────────────────┤
│ STEP 2: Extract values from month columns               │
├─────────────────────────────────────────────────────────┤
│ STEP 3: Sort chronologically (Jan → Dec)                │
├─────────────────────────────────────────────────────────┤
│ STEP 4: Set stock = last month value                    │
├─────────────────────────────────────────────────────────┤
│ STEP 5: Fallback to stock/quantity/units if no months   │
├─────────────────────────────────────────────────────────┤
│ STEP 6: Debug logging for troubleshooting               │
├─────────────────────────────────────────────────────────┤
│ STEP 7: Validate & reject if no history found           │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Supported CSV Formats

### ✅ Wide Format (RECOMMENDED)
```
Product,Jan,Feb,Mar,Apr,May,Jun,Price,Category
Apple,100,200,300,400,500,600,5.99,Fruit
Orange,150,250,350,450,550,650,4.99,Fruit
```

### ✅ Long Format
```
Product,Month,Sales
Apple,Jan,100
Apple,Feb,200
Orange,Jan,150
Orange,Feb,250
```

### ✅ Mixed Format
```
Product,Stock,Jan,Feb,Mar,April,May,June
Apple,500,100,200,300,400,500,600
```

---

## 🧪 Test Your CSV

**Sample file:** `SAMPLE_CSV_TIMESERIES.csv` (included)

1. Navigate to Inventory Page
2. Click "Upload CSV"
3. Select `SAMPLE_CSV_TIMESERIES.csv`
4. Check browser console (F12) for debug logs
5. Verify: Stock values shown (not 0), history arrays populated

**Expected:**
```
✅ 10 products imported
✅ Stock values: 1600, 2400, 950, 550, 1600, 1100, 1800, 700, 1400, 500
✅ History arrays: [1500, 1600, 1800, ...]
✅ UI shows real data (not "0")
```

---

## 🔍 Debug Logging

Open browser console (F12) → Console tab

Look for messages like:
```
📊 CSV PARSING DEBUG: {
  productName: "Apple Juice",
  headers: ['product', 'jan', 'feb', 'mar', 'apr', 'may', 'jun'],
  detectedMonths: ['jan', 'feb', 'mar', 'apr', 'may', 'jun'],
  extractedHistory: [1500, 1600, 1800, 2000, 2100, 1900],
  salesData: [{month: 'Jan', value: 1500}, ...],
  rowCount: 1
}

✅ Set stock from history: 1900
🔹 FINAL STOCK VALUES: [{name: 'Apple Juice', stock: 1900}]
```

---

## ⚠️ Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Stock = 0 | Month columns not detected | Ensure headers are: Jan, Feb, Mar (not january, february, march) |
| History = empty | No numeric values in month columns | Check values are positive integers (100, 200, 300) |
| Products skipped | No month OR fallback columns | Add Jun, July, Aug columns or Stock column |
| Wrong sorting | Months in wrong order | Months auto-sorted (Jan=1, Feb=2, ..., Dec=12) |
| Duplicate values | Using both wide & long format | Use ONE format per CSV |

---

## 📋 Column Name Recognition

### Month Columns (Auto-Detected)
✅ "JAN", "jan", "January", "january", "jan2025"
✅ "FEB", "feb", "February", "february"
✅ All 12 months supported
✅ Case-insensitive

### Data Columns (Priority Order)
1. "sales" (highest priority)
2. "demand"
3. "quantity"
4. "stock"
5. "units"
6. "price"
7. Falls back to month column value if above not found

### Metadata Columns
- "Product", "product", "productname", "name", "item", "title"
- "SKU", "sku", "productid", "id"
- "Category", "category", "type"
- "Price", "price", "cost", "value"
- "MinStock", "minstock", "minimumstock"

---

## 🚀 Usage Flow

```
1. Prepare CSV with month columns
   ↓
2. Upload via Inventory → Upload CSV
   ↓
3. System detects month columns ✅
   ↓
4. Extracts history [val1, val2, val3, ...]
   ↓
5. Sets stock = last value (not 0)
   ↓
6. Creates product with valid data
   ↓
7. UI displays real numbers 📊
```

---

## ✨ Key Features

| Feature | Status |
|---------|--------|
| Month column detection | ✅ Robust (exact match, not substring) |
| Support for Jan/January | ✅ Both formats work |
| Case-insensitive headers | ✅ "JAN" = "jan" = "January" |
| Chronological sorting | ✅ Auto-sorted Jan→Dec |
| History population | ✅ Always populated when month columns exist |
| Stock value | ✅ Set from last month (not 0) |
| Fallback mechanism | ✅ If no months, tries stock/quantity/units |
| Debug logging | ✅ Comprehensive console output |
| Data validation | ✅ Rejects empty/zero products |
| Partial year support | ✅ Works with 1-12 months |

---

## 📞 Need Help?

1. **Check browser console** for debug logs (F12 → Console)
2. **Review CSV headers** - must be recognized (Jan-Dec or equivalent)
3. **Verify numeric values** - must be positive numbers (100, 200, 300)
4. **Check sample CSV** - `SAMPLE_CSV_TIMESERIES.csv` shows correct format

---

**Version:** 2.0 (Time-Series Ready)
**Status:** ✅ Production Ready
