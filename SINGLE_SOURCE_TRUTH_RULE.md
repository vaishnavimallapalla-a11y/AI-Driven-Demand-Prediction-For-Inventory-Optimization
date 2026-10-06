# 🔒 STRICT ENFORCEMENT: SINGLE SOURCE OF TRUTH

## ⚠️ CRITICAL RULE

**There must be ONLY ONE data source for products: `enrichedProducts`**

Any usage of raw `products` is a **BUG**.

---

## ✅ CORRECT PATTERNS

### Pattern 1: Using enrichedProducts in React Components
```typescript
import { useInventoryAnalytics } from '../hooks/useInventoryAnalytics';

export const MyComponent = () => {
  const { products } = useStore();
  const { enrichedProducts } = useInventoryAnalytics(products);
  
  // ✅ CORRECT
  return (
    <div>
      {enrichedProducts.map(p => (
        <div key={p.id}>{p.name}: {p.currentStock}</div>
      ))}
    </div>
  );
};
```

### Pattern 2: Filtering enrichedProducts
```typescript
// ✅ CORRECT
const lowStock = enrichedProducts.filter(p => 
  p.currentStock <= p.minStock
);

const inStock = enrichedProducts.filter(p => 
  getHealthStatus(p.currentStock) === 'In Stock'
);
```

### Pattern 3: Calculating Metrics
```typescript
// ✅ CORRECT
const totalStock = enrichedProducts.reduce((sum, p) => 
  sum + p.currentStock, 0
);

const avgStock = totalStock / enrichedProducts.length;

const topProducts = enrichedProducts
  .sort((a, b) => b.currentStock - a.currentStock)
  .slice(0, 5);
```

### Pattern 4: Accessing Analytics
```typescript
// ✅ CORRECT - enrichedProducts includes analytics
enrichedProducts.map(p => ({
  name: p.name,
  stock: p.currentStock,
  trend: p.analytics?.trendLabel,
  probability: p.analytics?.probabilityScore,
  percentFromAvg: p.analytics?.percentFromAvg
}));
```

---

## ❌ ANTI-PATTERNS (DO NOT USE)

### Anti-Pattern 1: Using raw products
```typescript
// ❌ WRONG
const { products } = useStore();

products.map(p => (
  <div>{p.name}: {p.currentStock}</div>
));

// Why? 
// - Bypasses enrichment (history generation, analytics)
// - Shows stale/invalid data
// - Inconsistent with other components
// - No hard validation
```

### Anti-Pattern 2: Filter on raw products
```typescript
// ❌ WRONG
const lowStock = products.filter(p => p.currentStock <= p.minStock);

// Why?
// - No enrichment applied
// - Analytics not available
// - Missing validation
```

### Anti-Pattern 3: Fallback to 0
```typescript
// ❌ WRONG
{product.currentStock || 0}

// Why?
// - Masks invalid data
// - Shows 0 instead of error
// - Hides problems from developers

// ✅ CORRECT
{product.currentStock ?? 'Data unavailable'}
```

### Anti-Pattern 4: Direct field access without enrichment
```typescript
// ❌ WRONG
const status = products[0].currentStock > products[0].minStock 
  ? 'In Stock' 
  : 'Low Stock';

// Why?
// - Raw products may have invalid stock
// - getHealthStatus already exists
// - Use enrichedProducts for consistency

// ✅ CORRECT
const status = getHealthStatus(enrichedProducts[0].currentStock);
```

---

## 🔍 AUDIT: Where RAW PRODUCTS is OK

**Only in these specific cases:**

### 1. Store Operations (useStore.ts)
```typescript
// ✅ OK - Managing raw data from Firestore
const [products, setProducts] = useState<Product[]>([]);

setProducts(newProducts); // Direct state update
```

### 2. Write Operations
```typescript
// ✅ OK - Creating/updating raw objects
await addDoc(collection(db, 'inventory'), {
  name, sku, currentStock, minStock, price
});

// After write, enrichment happens automatically
```

### 3. In aggregateProductData() function
```typescript
// ✅ OK - Creating raw product objects
return {
  product: {
    name,
    sku,
    currentStock,  // Raw value
    history,
    prediction
  },
  sales: salesData
};

// These get enriched by the hook
```

---

## 🧪 DETECTION: How to Find Anti-Patterns

### Search for violations:
```bash
# Search for raw products usage
grep -r "products\.map" src/
grep -r "products\.filter" src/
grep -r "products\.reduce" src/
grep -r "products\.sort" src/

# Should ONLY appear in:
# 1. useStore.ts (state management)
# 2. aggregateProductData (CSV parsing)
# 3. Comments/documentation
```

### Browser DevTools:
```javascript
// Paste in console to check
const checkEnrichedUsage = () => {
  const violations = [
    'products.map',
    'products.filter', 
    'products.reduce',
    'products.sort'
  ];
  
  const code = document.documentElement.innerText;
  
  violations.forEach(pattern => {
    if (code.includes(pattern)) {
      console.warn(`⚠️ VIOLATION FOUND: ${pattern}`);
    }
  });
};
```

---

## ✅ CODE REVIEW CHECKLIST

When reviewing code, ensure:

- [ ] All product displays use `enrichedProducts`
- [ ] No raw `products` except in store/write operations
- [ ] Hook is imported: `useInventoryAnalytics`
- [ ] Destructuring correct: `const { enrichedProducts } = useInventoryAnalytics(products);`
- [ ] No `|| 0` fallback for stock values
- [ ] Analytics used when available: `product.analytics?.trendLabel`
- [ ] Validation present if checking stock: `if (p.currentStock > p.minStock)`
- [ ] Debug logging present for complex operations
- [ ] No infinite loops from enrichment hook

---

## 📋 APPROVED FILE MODIFICATIONS

Only these files should modify product data:

| File | Purpose | Data Flow |
|------|---------|-----------|
| useStore.ts | State management | Raw products |
| InventoryPage.tsx | CSV parsing | Raw → Enriched |
| useInventoryAnalytics.ts | Enrichment | Adds analytics |
| All components | Display | Enriched only |

---

## 🚨 RED FLAGS

Stop and fix if you see:

1. ❌ `products` used in render/display function
2. ❌ `enrichedProducts` not imported from hook
3. ❌ Stock values showing as 0 (except truly invalid)
4. ❌ Hook called without storing result
5. ❌ Direct field access without null checks
6. ❌ No validation of currentStock
7. ❌ Fallback `|| 0` for stock displays
8. ❌ Page shows different data than console logs

---

## 🔧 FIXING A VIOLATION

If you find a violation:

```typescript
// ❌ VIOLATION FOUND
const MyComponent = () => {
  const { products } = useStore();
  return products.map(p => <div>{p.currentStock}</div>);
};

// ✅ FIX IT
const MyComponent = () => {
  const { products } = useStore();
  const { enrichedProducts } = useInventoryAnalytics(products);
  return enrichedProducts.map(p => <div>{p.currentStock}</div>);
};
```

**Step by step:**
1. Import hook: `import { useInventoryAnalytics } from '../hooks/useInventoryAnalytics';`
2. Call hook: `const { enrichedProducts } = useInventoryAnalytics(products);`
3. Replace all `products` with `enrichedProducts`
4. Test in browser
5. Check console logs

---

## 📞 ASKING FOR HELP

If you find invalid data:

1. **Check console first** - Look for:
   - `🔍 PRODUCT OBJECT VALIDATION`
   - `❌ INVALID PRODUCTS DETECTED`
   - `🚨 HARD VALIDATION` messages

2. **Upload CSV again** - May be data issue

3. **Search for violations** - Find misuse of `products`

4. **Verify hook called** - All components need enrichment

---

## ✨ BENEFITS OF THIS RULE

✅ **One source of truth** - No inconsistencies
✅ **Automatic enrichment** - Developers don't miss it
✅ **Built-in validation** - Bad data detected early
✅ **Better debugging** - Console tells story
✅ **Scalable** - Easy to add new features
✅ **Type safe** - TypeScript helps enforce

---

**This rule is MANDATORY**
Violations will cause data inconsistencies.
