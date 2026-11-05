'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Receipt,
  CreditCard,
  Banknote,
  QrCode,
  Printer,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ShoppingBag,
  RotateCcw,
  User,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { Medicine, Bill, PaymentMethod } from '@/lib/types';
import { listMedicines, createBill, adjustMedicineStock } from '@/lib/api';
import { formatINR, formatDate } from '@/lib/utils';

interface CartItem {
  medicine: Medicine;
  quantity: number;
}

function BillingContent() {
  const searchParams = useSearchParams();
  const quickAddId = searchParams.get('quickAdd');

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Register Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Sale execution states
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedBill, setCompletedBill] = useState<Bill | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Load catalog
  const loadCatalog = async () => {
    setLoading(true);
    try {
      const res = await listMedicines();
      setMedicines(res.data);
    } catch (err) {
      console.error('Failed to load catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  // Handle quickAdd parameter from URL
  useEffect(() => {
    if (quickAddId && medicines.length > 0) {
      const target = medicines.find((m) => m.id === quickAddId);
      if (target && target.stockQuantity > 0) {
        addToCart(target);
      }
    }
  }, [quickAddId, medicines]);

  // Cart operations
  const addToCart = (med: Medicine) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.medicine.id === med.id);
      if (existing) {
        if (existing.quantity >= med.stockQuantity) {
          alert(`Cannot add more than available stock (${med.stockQuantity}) for ${med.name}`);
          return prev;
        }
        return prev.map((item) =>
          item.medicine.id === med.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prev, { medicine: med, quantity: 1 }];
      }
    });
  };

  const updateQuantity = (medId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.medicine.id === medId) {
            const newQty = item.quantity + delta;
            if (newQty > item.medicine.stockQuantity) {
              alert(`Maximum available stock reached (${item.medicine.stockQuantity})`);
              return item;
            }
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (medId: string) => {
    setCart((prev) => prev.filter((item) => item.medicine.id !== medId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountAmount(0);
    setErrorMessage('');
  };

  // Calculations
  const subtotal = useMemo(() => {
    return (
      Math.round(
        cart.reduce(
          (sum, item) => sum + item.medicine.price * item.quantity,
          0
        ) * 100
      ) / 100
    );
  }, [cart]);

  const effectiveDiscount = Math.min(discountAmount || 0, subtotal);
  const taxableAmount = Math.max(0, subtotal - effectiveDiscount);
  const taxAmount = Math.round(taxableAmount * 0.05 * 100) / 100; // 5% GST
  const finalTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;

  // Filter medicines for catalog view
  const filteredCatalog = useMemo(() => {
    return medicines.filter((m) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.genericName.toLowerCase().includes(q) ||
        m.locationRack.toLowerCase().includes(q);

      const matchesCat =
        selectedCategory === 'All' ||
        m.category.toLowerCase() === selectedCategory.toLowerCase();

      return matchesSearch && matchesCat;
    });
  }, [medicines, searchQuery, selectedCategory]);

  // Complete Sale
  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      setErrorMessage('Please add at least one medicine to the bill.');
      return;
    }

    setErrorMessage('');
    setIsProcessing(true);

    try {
      const payload = {
        storeId: 'store-001',
        customerName: customerName.trim() || 'Walk-in Customer',
        customerPhone: customerPhone.trim() || '',
        paymentMethod,
        items: cart.map((item) => ({
          medicineId: item.medicine.id,
          medicineName: item.medicine.name,
          quantity: item.quantity,
          unitPrice: item.medicine.price,
        })),
        discountAmount: effectiveDiscount,
      };

      const res = await createBill(payload);
      setCompletedBill(res.data);

      // Also deduct in local catalog state to keep instant UI sync
      setMedicines((prev) =>
        prev.map((med) => {
          const billedItem = cart.find((c) => c.medicine.id === med.id);
          if (billedItem) {
            const newQty = Math.max(0, med.stockQuantity - billedItem.quantity);
            return {
              ...med,
              stockQuantity: newQty,
              inStock: newQty > 0,
            };
          }
          return med;
        })
      );

      // Clear the active cart
      setCart([]);
      setDiscountAmount(0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Transaction failed.';
      setErrorMessage(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span>In-Store POS & Billing Counter</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-teal-50 text-teal-700 border border-teal-200">
              Terminal: POS-01
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Split-screen cashier register with live 5% GST computation and real-time inventory deduction.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-600">
            GSTIN: 29AABCU9603R1ZM (5%)
          </span>
        </div>
      </div>

      {/* Main 60/40 Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Pane (60%): Medicine Search & Quick Add */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Scan barcode or type medicine / salt / rack..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:bg-white transition-all"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {['All', 'Antibiotics', 'Pain Relief', 'Cardiology', 'Diabetes', 'Vitamins'].map(
                (cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-all ${
                      selectedCategory === cat
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Catalog Items Grid */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {loading ? (
              <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                Loading medicine catalog...
              </div>
            ) : filteredCatalog.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                No medicines found matching &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              filteredCatalog.map((med) => {
                const isOut = med.stockQuantity === 0 || !med.inStock;
                const cartQty = cart.find((c) => c.medicine.id === med.id)?.quantity || 0;
                const remainingStock = med.stockQuantity - cartQty;

                return (
                  <div
                    key={med.id}
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                      isOut
                        ? 'bg-slate-50 border-slate-200 opacity-60'
                        : 'bg-white border-slate-200/80 hover:border-teal-300 shadow-sm'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-sm truncate">
                          {med.name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {med.locationRack}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">
                        {med.genericName}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                        <span>Batch: <strong className="font-mono text-slate-600">{med.batchNumber}</strong></span>
                        <span>
                          Stock:{' '}
                          <strong
                            className={`font-mono tabular-nums ${
                              remainingStock <= 5 ? 'text-amber-600' : 'text-slate-700'
                            }`}
                          >
                            {remainingStock} units
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <span className="text-sm font-bold font-mono tabular-nums text-slate-900 block">
                          {formatINR(med.price)}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase font-mono">per strip</span>
                      </div>

                      <button
                        disabled={isOut || remainingStock <= 0}
                        onClick={() => addToCart(med)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          isOut || remainingStock <= 0
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm shadow-teal-600/20 active:scale-95'
                        }`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane (40%): Live Invoice Register Slip */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-xl border border-slate-200 shadow-lg sticky top-20 overflow-hidden">
            {/* Cash Register Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-teal-400" />
                <div>
                  <h2 className="text-sm font-bold tracking-tight">Active Tax Invoice</h2>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Terminal POS-01 &bull; {new Date().toLocaleDateString('en-IN')}
                  </span>
                </div>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            <div className="p-4 space-y-4">
              {/* Customer Details Inputs */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                    Customer Name
                  </label>
                  <div className="relative">
                    <User className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Walk-in Customer"
                      className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:border-teal-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <Phone className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="9876543210"
                      className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono text-slate-900 focus:outline-none focus:border-teal-600"
                    />
                  </div>
                </div>
              </div>

              {/* Error banner */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Itemized Cart List */}
              <div className="border-t border-b border-slate-200 py-2 max-h-52 overflow-y-auto divide-y divide-slate-100">
                {cart.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    <ShoppingBag className="h-6 w-6 mx-auto mb-1 opacity-40" />
                    <span>No medicines added yet. Select from catalog on the left.</span>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.medicine.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {item.medicine.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {formatINR(item.medicine.price)} &times; {item.quantity}
                        </div>
                      </div>

                      {/* Quantity Spinner */}
                      <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded border border-slate-200">
                        <button
                          onClick={() => updateQuantity(item.medicine.id, -1)}
                          className="h-5 w-5 flex items-center justify-center text-slate-600 hover:text-rose-600 hover:bg-white rounded transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center font-mono text-xs font-semibold tabular-nums text-slate-800">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.medicine.id, 1)}
                          className="h-5 w-5 flex items-center justify-center text-slate-600 hover:text-teal-600 hover:bg-white rounded transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Line Item Total */}
                      <div className="w-20 text-right font-mono font-bold text-xs tabular-nums text-slate-900">
                        {formatINR(item.medicine.price * item.quantity)}
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => removeFromCart(item.medicine.id)}
                        className="text-slate-400 hover:text-rose-500 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Payment Method Selector Pills */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                      paymentMethod === 'CASH'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Banknote className="h-3.5 w-3.5" />
                    <span>Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('UPI')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                      paymentMethod === 'UPI'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    <span>UPI</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CARD')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                      paymentMethod === 'CARD'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>Card</span>
                  </button>
                </div>
              </div>

              {/* Financial Calculation Breakdown */}
              <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center">
                  <span>Subtotal ({cart.reduce((c, i) => c + i.quantity, 0)} items):</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {formatINR(subtotal)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span>Special Discount (₹):</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={discountAmount || ''}
                    onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0.00"
                    className="w-20 text-right px-1.5 py-0.5 border border-slate-200 rounded font-mono text-xs text-slate-900 focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div className="flex justify-between items-center text-teal-700">
                  <span>GST Tax (5% CGST + SGST):</span>
                  <span className="font-mono tabular-nums font-semibold">
                    +{formatINR(taxAmount)}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                    Final Net Total:
                  </span>
                  <span className="text-xl font-extrabold font-mono tabular-nums text-slate-900">
                    {formatINR(finalTotal)}
                  </span>
                </div>
              </div>

              {/* Complete Sale & Print Action Button */}
              <button
                disabled={cart.length === 0 || isProcessing}
                onClick={handleCompleteSale}
                className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-teal-600 text-white hover:bg-teal-700 shadow-md shadow-teal-600/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isProcessing ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Processing Sale & Deducting Stock...</span>
                  </>
                ) : (
                  <>
                    <Printer className="h-4 w-4" />
                    <span>Complete Sale & Print Receipt ({formatINR(finalTotal)})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Completed Bill / Invoice Receipt Modal */}
      {completedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-emerald-50 text-emerald-800">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <span className="font-bold text-sm">Sale Completed & Stock Deducted</span>
              </div>
              <button
                onClick={() => setCompletedBill(null)}
                className="text-emerald-700 hover:text-emerald-900 font-bold text-sm"
              >
                &times; Close
              </button>
            </div>

            {/* Printable Receipt Slip */}
            <div className="p-6 space-y-4 font-mono text-xs invoice-printable">
              <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
                <h3 className="text-base font-extrabold uppercase tracking-wider text-slate-900">
                  MediGrid Pharmacy Network
                </h3>
                <p className="text-[11px] text-slate-500">
                  Central Dispensary &bull; License #KA-BLR-2024-893
                </p>
                <p className="text-[11px] text-slate-500">
                  GSTIN: 29AABCU9603R1ZM
                </p>
                <div className="pt-2 text-xs font-bold text-slate-800">
                  TAX INVOICE #{completedBill.billId}
                </div>
                <div className="text-[10px] text-slate-400">
                  {formatDate(completedBill.createdAt)}
                </div>
              </div>

              {/* Customer Info */}
              <div className="text-[11px] text-slate-600 space-y-0.5 pb-2 border-b border-dashed border-slate-300">
                <div>Customer: <strong className="text-slate-900">{completedBill.customerName}</strong></div>
                {completedBill.customerPhone && (
                  <div>Phone: <span className="text-slate-900">{completedBill.customerPhone}</span></div>
                )}
                <div>Payment Method: <span className="font-semibold text-teal-700">{completedBill.paymentMethod}</span></div>
                <div>Status: <span className="text-emerald-700 font-semibold">{completedBill.status}</span></div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-300 text-[10px] text-slate-500 uppercase">
                    <th className="py-1">Item</th>
                    <th className="py-1 text-center">Qty</th>
                    <th className="py-1 text-right">Price</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {completedBill.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-1.5 font-sans font-medium text-slate-800">
                        {it.medicineName}
                      </td>
                      <td className="py-1.5 text-center tabular-nums">{it.quantity}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatINR(it.unitPrice)}</td>
                      <td className="py-1.5 text-right font-bold tabular-nums">
                        {formatINR(it.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="space-y-1 pt-3 border-t border-dashed border-slate-300 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="tabular-nums font-semibold">{formatINR(completedBill.subtotal)}</span>
                </div>
                {completedBill.discountAmount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Discount:</span>
                    <span className="tabular-nums font-semibold">-{formatINR(completedBill.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-teal-700">
                  <span>GST (5%):</span>
                  <span className="tabular-nums font-semibold">+{formatINR(completedBill.taxAmount)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-300 text-sm font-bold text-slate-900">
                  <span>NET AMOUNT PAID:</span>
                  <span className="tabular-nums">{formatINR(completedBill.finalTotal)}</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-400 pt-4 border-t border-dashed border-slate-300">
                Thank you for choosing MediGrid!
                <br />
                Computer generated invoice &bull; No signature required.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 no-print">
              <button
                type="button"
                onClick={() => setCompletedBill(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-white"
              >
                Close & Next Customer
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 flex items-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                <span>Print Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading Billing Counter...</div>}>
      <BillingContent />
    </Suspense>
  );
}
