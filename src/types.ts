export interface Product {
  id: string;
  userId: string;
  name: string;
  sku: string;
  category: string;
  currentStock: number;
  minStock: number;
  price: number;
  status: 'In Stock' | 'Low Stock' | 'Excess Stock' | 'No Stock';
  prediction: number;
  confidence: number;
  trend?: 'High' | 'Stable' | 'Declining' | 'Target Reached';
  history?: number[];
  lastUpdated: string;
  image: string;
  createdAt: any;
  analytics?: {
    percentFromAvg: number | null;
    probabilityScore: number | null;
    probability: number | null;         // alias for probabilityScore
    trendLabel: string;
    trendValue: number | null;
    direction: string;
    health: 'No Stock' | 'Low Stock' | 'In Stock' | 'Excess Stock';
  };
}

export interface SalesData {
  id: string;
  date: string;
  actual: number;
  predicted: number;
  userId: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  type: 'stock_alert' | 'forecast_update' | 'market_report' | 'inventory_change';
  title: string;
  description: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'success';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  createdAt: string;
}

export interface PredictionRecord {
  id: string;
  userId: string;
  productName: string;
  historicalData: { month: string; value: number | null }[];
  predictedValue: number;
  confidence: number;
  suggestedStock: number;
  trend: 'Increasing' | 'Decreasing' | 'Stable' | 'Volatile' | 'Insufficient Data';
  dataSource: 'historical' | 'inventory' | 'generic';
  dataQuality: 'high' | 'medium' | 'low';
  createdAt: any;
}
