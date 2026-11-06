'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ReceiptText,
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  CheckCircle2,
  AlertCircle,
  Package,
  Building2,
  ChevronLeft,
  CreditCard,
  Banknote,
  QrCode,
  X,
  FileCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { listStoreMedicines, createBill, adjustMedicineStock, matchesMedicineSearch } from '@/lib/api';
import { Medicine, Bill, PaymentMethod } from '@/lib/types';
import { formatINR, cn } from '@/lib/utils';

interface CartItem {
  medicineId: string;
  medicineName: string;
  unitPrice: number;
  quantity: number;
  availableStock: number;
  batchNumber: string;
}

export default function StorePOSPage() {
  const router = useRouter();
  const { storeSession, isInitialized } = useAuth();

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogSearch, setCatalogSearch] = useState('');

  // Register slip state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('Walk-in Patient');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Billing state
  const [processingSale, setProcessingSale] = useState(false);
  const [posError, setPosError] = useState<string | null>(null);
  const [completedBill, setCompletedBill] = useState<Bill | null>(null);

  useEffect(() => {
    if (!isInitialized) return;
    if (!storeSession?.store?.id) {
      router.replace('/store/login');
      return;
    }

    loadCatalog();
  }, [storeSession, isInitialized]);

  const loadCatalog = async () => {
    if (!storeSession?.store?.id) return;
    setLoading(true);
    try {
      const res = await listStoreMedicines(storeSession.store.id);
      setMedicines(res.data);
    } catch (err) {
      console.error('Failed to load store medicines for POS:', err);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (med: Medicine) => {
    setPosError(null);
    if (med.stockQuantity <= 0 || !med.inStock) {
      setPosError(`Cannot add '${med.name}' — out of stock.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.medicineId === med.id);
      if (existing) {
        if (existing.quantity >= med.stockQuantity) {
          setPosError(`Max available stock (${med.stockQuantity}) already in register for '${med.name}'.`);
          return prev;
        }
        return prev.map((item) =>
          item.medicineId === med.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          medicineId: med.id,
          medicineName: med.name,
          unitPrice: med.price,
          quantity: 1,
          availableStock: med.stockQuantity,
          batchNumber: med.batchNumber,
        },
      ];
    });
  };

  const updateQuantity = (medicineId: string, delta: number) => {
    setPosError(null);
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.medicineId === medicineId) {
            const newQty = item.quantity + delta;
            if (newQty > item.availableStock) {
              setPosError(`Exceeds store inventory limit (${item.availableStock}) for ${item.medicineName}.`);
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (medicineId: string) => {
    setCart((prev) => prev.filter((item) => item.medicineId !== medicineId));
  };

  const clearRegister = () => {
    setCart([]);
    setCustomerName('Walk-in Patient');
    setCustomerPhone('');
    setDiscountAmount(0);
    setPosError(null);
  };

  // Calculations: 5% GST
  const subtotal = cart.reduce(
    (acc, item) => acc + Math.round(item.unitPrice * item.quantity * 100) / 100,
    0
  );
  const taxable = Math.max(0, subtotal - discountAmount);
  const gstAmount = Math.round(taxable * 0.05 * 100) / 100;
  const grandTotal = Math.round((taxable + gstAmount) * 100) / 100;

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      setPosError('Register is empty. Add items from the catalog.');
      return;
    }
    if (!storeSession?.store?.id) return;

    setPosError(null);
    setProcessingSale(true);

    try {
      const res = await createBill({
        storeId: storeSession.store.id,
        customerName: customerName.trim() || 'Walk-in Patient',
        customerPhone: customerPhone.trim() || undefined,
        paymentMethod,
        discountAmount: discountAmount || 0,
        items: cart.map((item) => ({
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });

      // 1. Instantly update live UI state so inventory quantities drop immediately on screen
      const currentCart = [...cart];
      setMedicines((prev) =>
        prev.map((m) => {
          const sold = currentCart.find((c) => c.medicineId === m.id);
          if (sold) {
            const newQty = Math.max(0, m.stockQuantity - sold.quantity);
            return { ...m, stockQuantity: newQty, inStock: newQty > 0 };
          }
          return m;
        })
      );

      // 2. Ensure both API backend and local fallback storage reflect stock deduction
      for (const item of currentCart) {
        try {
          await adjustMedicineStock(item.medicineId, 'DEDUCT', item.quantity, storeSession.store.id);
        } catch {
          // Handled if order-service already deducted
        }
      }

      setCompletedBill(res.data);
      loadCatalog();
      clearRegister();
    } catch (err: any) {
      setPosError(err.message || 'Billing transaction failed.');
    } finally {
      setProcessingSale(false);
    }
  };

  if (!isInitialized || !storeSession?.store) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-sm text-slate-500 animate-pulse">Loading POS counter...</div>
      </div>
    );
  }

  const store = storeSession.store;

  const filteredMedicines = medicines.filter((m) => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      matchesMedicineSearch(m.name, m.genericName, q) ||
      m.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/store/dashboard"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>
          <span className="text-slate-300">/</span>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>In-Store POS Counter</span>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              5% GST
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Register Active:</span>
          <strong className="text-slate-800">{store.name}</strong>
          <span className="font-mono">({store.id})</span>
          {store.licenseNumber && (
            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
              Lic: {store.licenseNumber}
            </span>
          )}
          {store.city && (
            <span className="text-slate-600 font-medium">
              &bull; {store.city}
            </span>
          )}
        </div>
      </div>

      {posError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{posError}</span>
        </div>
      )}

      {/* Split Screen POS Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Screen: Store Medicine Catalog (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-teal-600" />
              <h2 className="text-sm font-bold text-slate-900">
                Store Catalog Quick Picker
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {medicines.length} in store
            </span>
          </div>

          {/* Catalog Search */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Search store inventory to add to ticket..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Catalog List */}
          <div className="max-h-[520px] overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Loading store items...
              </div>
            ) : filteredMedicines.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No medicines found in catalog.
              </div>
            ) : (
              filteredMedicines.map((med) => {
                const inCart = cart.find((c) => c.medicineId === med.id);
                const isOutOfStock = med.stockQuantity <= 0 || !med.inStock;

                return (
                  <div
                    key={med.id}
                    className="p-3 rounded-xl border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60 transition flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                          {med.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                          {med.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {med.genericName}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                        <span>Rack: {med.locationRack}</span>
                        <span>Stock: <strong className={med.stockQuantity <= 10 ? 'text-amber-600' : 'text-slate-700'}>{med.stockQuantity}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="font-mono tabular-nums font-bold text-sm text-slate-900">
                          {formatINR(med.price)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => addToCart(med)}
                        disabled={isOutOfStock}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-semibold transition active:scale-[0.98]',
                          isOutOfStock
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : inCart
                            ? 'bg-teal-700 text-white shadow-2xs'
                            : 'bg-teal-600 hover:bg-teal-700 text-white shadow-2xs'
                        )}
                      >
                        {isOutOfStock ? 'Sold Out' : inCart ? `Add (${inCart.quantity})` : '+ Add'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Screen: Live Cash Register Slip (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">
                Cash Register Slip
              </h2>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearRegister}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium"
              >
                Clear Slip
              </button>
            )}
          </div>

          {/* Customer Details */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Walk-in Patient"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Phone (Optional)
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+91-9876543210"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Cart Items List */}
          <div className="min-h-[160px] max-h-[220px] overflow-y-auto space-y-2 py-1 border-y border-slate-100">
            {cart.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Register slip is currently empty.
                <br />
                Select medicines from the left to begin bill.
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.medicineId}
                  className="flex items-center justify-between text-xs py-1"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="font-semibold text-slate-900 truncate">
                      {item.medicineName}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {formatINR(item.unitPrice)} each
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.medicineId, -1)}
                      className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center font-mono font-bold">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.medicineId, 1)}
                      className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <div className="w-16 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatINR(item.unitPrice * item.quantity)}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.medicineId)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Financial Breakdown: Subtotal, 5% GST, Discount, Grand Total */}
          <div className="space-y-1.5 text-xs text-slate-600 pt-1">
            <div className="flex items-center justify-between">
              <span>Subtotal:</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                {formatINR(subtotal)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span>GST (5% Tax):</span>
                <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 rounded">CGST 2.5% + SGST 2.5%</span>
              </span>
              <span className="font-mono tabular-nums font-semibold text-blue-700">
                +{formatINR(gstAmount)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>Discount (₹):</span>
              <input
                type="number"
                min="0"
                value={discountAmount || ''}
                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-20 px-2 py-0.5 text-right bg-slate-50 border border-slate-200 rounded text-xs font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-base font-bold text-slate-900">
              <span>Final Total:</span>
              <span className="font-mono tabular-nums text-lg text-emerald-700">
                {formatINR(grandTotal)}
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-600">
              Payment Tender
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition',
                  paymentMethod === 'CASH'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                )}
              >
                <Banknote className="h-3.5 w-3.5 text-emerald-600" />
                <span>Cash</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('UPI')}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition',
                  paymentMethod === 'UPI'
                    ? 'bg-teal-50 text-teal-800 border-teal-300 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                )}
              >
                <QrCode className="h-3.5 w-3.5 text-teal-600" />
                <span>UPI / QR</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('CARD')}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition',
                  paymentMethod === 'CARD'
                    ? 'bg-blue-50 text-blue-800 border-blue-300 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                )}
              >
                <CreditCard className="h-3.5 w-3.5 text-blue-600" />
                <span>Card</span>
              </button>
            </div>
          </div>

          {/* Checkout Action Button */}
          <button
            type="button"
            onClick={handleCompleteSale}
            disabled={processingSale || cart.length === 0}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-sm transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="h-4 w-4" />
            <span>
              {processingSale ? 'Completing Sale & Deducting Stock...' : 'Complete Sale & Print Receipt'}
            </span>
          </button>
        </div>
      </div>

      {/* Official Tax Invoice / Receipt Modal */}
      {completedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-dashed border-slate-300">
              <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-emerald-600" />
                <span className="font-bold text-sm text-slate-900 uppercase">
                  Cash Register Receipt
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCompletedBill(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-center space-y-1 text-xs">
              <div className="font-bold text-sm text-slate-900">{store.name}</div>
              {(store.address || store.city) && (
                <div className="text-[11px] text-slate-500">
                  {[store.address || '', store.city || ''].filter(Boolean).join(', ')}
                </div>
              )}
              {store.phone && (
                <div className="text-[11px] text-slate-500">Phone: {store.phone}</div>
              )}
              <div className="text-[11px] text-slate-400">
                License: {store.licenseNumber || 'Not Specified'}
              </div>
            </div>

            <div className="border-t border-dashed border-slate-300 pt-2 text-[11px] text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>Bill ID:</span>
                <span className="font-bold text-slate-900">{completedBill.billId}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{new Date(completedBill.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span>{completedBill.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment Mode:</span>
                <span className="font-bold">{completedBill.paymentMethod}</span>
              </div>
            </div>

            {/* Receipt Table */}
            <div className="border-t border-dashed border-slate-300 pt-2 text-[11px]">
              <div className="flex justify-between font-bold text-slate-700 pb-1 border-b border-slate-200">
                <span>Item</span>
                <span>Qty x Rate</span>
                <span>Total</span>
              </div>
              <div className="py-2 space-y-1 text-slate-800">
                {completedBill.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="truncate max-w-[160px]">{it.medicineName}</span>
                    <span className="text-slate-500">{it.quantity} x {it.unitPrice.toFixed(2)}</span>
                    <span className="tabular-nums font-semibold">{it.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="border-t border-dashed border-slate-300 pt-2 text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="tabular-nums">{completedBill.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>5% GST (Tax):</span>
                <span className="tabular-nums">{completedBill.taxAmount.toFixed(2)}</span>
              </div>
              {completedBill.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount:</span>
                  <span className="tabular-nums">-{completedBill.discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-slate-300 pt-1 flex justify-between font-bold text-sm text-slate-900">
                <span>PAID AMOUNT:</span>
                <span className="tabular-nums text-emerald-700">{formatINR(completedBill.finalTotal)}</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-sans flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Stock Reduced:</strong> Register sale completed and inventory quantities decremented in real time.
              </span>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCompletedBill(null);
                  loadCatalog();
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-sans font-medium text-slate-700 hover:bg-slate-100 transition shadow-2xs"
              >
                ✓ Close Slip (No Print)
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                  setCompletedBill(null);
                  loadCatalog();
                }}
                className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-sans font-semibold flex items-center gap-1.5 transition shadow-2xs"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print & Close Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
