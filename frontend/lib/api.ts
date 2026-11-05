import { Medicine, CreateBillPayload, Bill } from './types';
import { INITIAL_MEDICINES } from './mock-data';

const CATALOG_API_BASE = process.env.NEXT_PUBLIC_CATALOG_API_URL || 'http://localhost:5001';
const BILLING_API_BASE = process.env.NEXT_PUBLIC_BILLING_API_URL || 'http://localhost:5002';

// In-memory / browser fallback storage key
const STORAGE_KEY = 'medigrid_medicines_fallback';
const BILLS_KEY = 'medigrid_bills_fallback';

function getStoredMedicines(): Medicine[] {
  if (typeof window === 'undefined') {
    return [...INITIAL_MEDICINES];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_MEDICINES));
      return [...INITIAL_MEDICINES];
    }
    return JSON.parse(raw);
  } catch {
    return [...INITIAL_MEDICINES];
  }
}

function saveStoredMedicines(medicines: Medicine[]): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(medicines));
    } catch {
      // ignore
    }
  }
}

/**
 * Search medicines by query or category
 */
export async function searchMedicines(query: string = '', category?: string): Promise<{ data: Medicine[]; source: 'api' | 'fallback' }> {
  try {
    const url = new URL(`${CATALOG_API_BASE}/api/v1/medicines/search`);
    if (query) url.searchParams.set('q', query);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      let items: Medicine[] = json.data || [];
      if (category && category !== 'All') {
        items = items.filter(
          (m) => m.category?.toLowerCase() === category.toLowerCase()
        );
      }
      return { data: items, source: 'api' };
    }
  } catch {
    // Backend offline: use fallback
  }

  // Fallback
  let items = getStoredMedicines();
  const q = query.trim().toLowerCase();
  if (q) {
    items = items.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.genericName.toLowerCase().includes(q) ||
        m.batchNumber.toLowerCase().includes(q)
    );
  }
  if (category && category !== 'All') {
    items = items.filter(
      (m) => m.category?.toLowerCase() === category.toLowerCase()
    );
  }

  return { data: items, source: 'fallback' };
}

/**
 * List all medicines optionally filtered by category
 */
export async function listMedicines(category?: string): Promise<{ data: Medicine[]; source: 'api' | 'fallback' }> {
  try {
    const url = new URL(`${CATALOG_API_BASE}/api/v1/medicines`);
    if (category && category !== 'All') {
      url.searchParams.set('category', category);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      return { data: json.data || [], source: 'api' };
    }
  } catch {
    // Backend offline: use fallback
  }

  let items = getStoredMedicines();
  if (category && category !== 'All') {
    items = items.filter(
      (m) => m.category?.toLowerCase() === category.toLowerCase()
    );
  }
  return { data: items, source: 'fallback' };
}

/**
 * Add a new medicine
 */
export async function addMedicine(payload: Omit<Medicine, 'id' | 'inStock' | 'createdAt' | 'updatedAt'>): Promise<{ data: Medicine; source: 'api' | 'fallback' }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${CATALOG_API_BASE}/api/v1/medicines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      return { data: json.data, source: 'api' };
    }
  } catch {
    // Backend offline: fallback save
  }

  const stored = getStoredMedicines();
  const newMed: Medicine = {
    ...payload,
    id: `med-${Date.now()}`,
    inStock: payload.stockQuantity > 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  stored.unshift(newMed);
  saveStoredMedicines(stored);

  return { data: newMed, source: 'fallback' };
}

/**
 * Deduct or Restock stock for a medicine
 */
export async function adjustMedicineStock(id: string, action: 'DEDUCT' | 'RESTOCK', quantity: number): Promise<{ data: Medicine; source: 'api' | 'fallback' }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${CATALOG_API_BASE}/api/v1/medicines/${id}/stock`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, quantity }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      return { data: json.data, source: 'api' };
    }
  } catch {
    // Backend offline: fallback update
  }

  const stored = getStoredMedicines();
  const med = stored.find((m) => m.id === id);
  if (!med) throw new Error(`Medicine with id '${id}' not found`);

  if (action === 'DEDUCT') {
    if (med.stockQuantity < quantity) {
      throw new Error(`Insufficient stock for '${med.name}'. Available: ${med.stockQuantity}`);
    }
    med.stockQuantity -= quantity;
  } else {
    med.stockQuantity += quantity;
  }
  med.inStock = med.stockQuantity > 0;
  med.updatedAt = new Date().toISOString();
  saveStoredMedicines(stored);

  return { data: med, source: 'fallback' };
}

/**
 * Create a POS bill and live-deduct inventory
 */
export async function createBill(payload: CreateBillPayload): Promise<{ data: Bill; source: 'api' | 'fallback' }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${BILLING_API_BASE}/api/v1/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      return { data: json.data, source: 'api' };
    }
  } catch {
    // Billing API offline: fallback local billing & stock deduction
  }

  // Fallback calculation & stock deduction
  const stored = getStoredMedicines();

  // Verify stock
  for (const item of payload.items) {
    const med = stored.find((m) => m.id === item.medicineId);
    if (med && med.stockQuantity < item.quantity) {
      throw new Error(`Insufficient stock for ${item.medicineName}. Available: ${med.stockQuantity}`);
    }
  }

  // Deduct stock in fallback
  for (const item of payload.items) {
    const med = stored.find((m) => m.id === item.medicineId);
    if (med) {
      med.stockQuantity = Math.max(0, med.stockQuantity - item.quantity);
      med.inStock = med.stockQuantity > 0;
      med.updatedAt = new Date().toISOString();
    }
  }
  saveStoredMedicines(stored);

  // Financial calculations: 5% GST
  const subtotal = payload.items.reduce(
    (sum, item) => sum + Math.round(item.unitPrice * item.quantity * 100) / 100,
    0
  );
  const discountAmount = payload.discountAmount || 0;
  const taxable = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.round(taxable * 0.05 * 100) / 100;
  const finalTotal = Math.round((taxable + taxAmount) * 100) / 100;

  const bill: Bill = {
    billId: `BILL-${Date.now()}`,
    storeId: payload.storeId || 'store-001',
    customerName: payload.customerName || 'Walk-in Customer',
    customerPhone: payload.customerPhone || '',
    paymentMethod: payload.paymentMethod,
    items: payload.items.map((it) => ({
      ...it,
      subtotal: Math.round(it.unitPrice * it.quantity * 100) / 100,
    })),
    subtotal,
    discountAmount,
    taxAmount,
    finalTotal,
    status: 'PAID',
    createdAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(BILLS_KEY);
      const bills = raw ? JSON.parse(raw) : [];
      bills.unshift(bill);
      localStorage.setItem(BILLS_KEY, JSON.stringify(bills));
    } catch {
      // ignore
    }
  }

  return { data: bill, source: 'fallback' };
}
