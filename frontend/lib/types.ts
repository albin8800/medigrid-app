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
