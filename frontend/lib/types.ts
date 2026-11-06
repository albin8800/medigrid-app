export interface Medicine {
  id: string;
  storeId?: string;
  name: string;
  genericName: string;
  category: string;
  batchNumber: string;
  expiryDate: string;
  price: number;
  stockQuantity: number;
  reorderLevel: number;
  inStock: boolean;
  locationRack: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Store {
  id: string;
  name: string;
  licenseNumber: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  coordinates?: { lat: number; lng: number };
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt?: string;
  updatedAt?: string;
}

export interface PublicSearchResult {
  storeId: string;
  storeName: string;
  storeAddress: string;
  distanceKm?: number;
  storePhone: string;
  medicineName: string;
  genericName?: string;
  price: number;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  inStock: boolean;
}

export interface BillItem {
  medicineId: string;
  medicineName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export type PaymentMethod = 'CASH' | 'UPI' | 'CARD';

export interface CreateBillPayload {
  storeId?: string;
  customerName?: string;
  customerPhone?: string;
  paymentMethod: PaymentMethod;
  items: Array<{
    medicineId: string;
    medicineName: string;
    quantity: number;
    unitPrice: number;
  }>;
  discountAmount?: number;
}

export interface Bill {
  billId: string;
  storeId: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: PaymentMethod;
  items: BillItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  finalTotal: number;
  status: 'PAID' | 'PENDING' | 'CANCELLED';
  createdAt: string;
  updatedAt?: string;
}

export interface AdminAnalytics {
  totalStores: number;
  totalRevenue: number;
  totalBills: number;
  topSellingMedicines?: Array<{
    medicineId: string;
    medicineName: string;
    quantitySold: number;
    totalRevenue: number;
  }>;
  storeBreakdown?: Array<{
    storeId: string;
    totalRevenue: number;
    billCount: number;
  }>;
}

export interface StoreSession {
  token: string;
  store: {
    id: string;
    name: string;
    email: string;
    licenseNumber?: string;
    address?: string;
    city?: string;
    phone?: string;
    coordinates?: { lat: number; lng: number };
    status: 'ACTIVE' | 'SUSPENDED';
  };
}

export interface AdminSession {
  token: string;
  admin: {
    email: string;
    role: string;
  };
}
