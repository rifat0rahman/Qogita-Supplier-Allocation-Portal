"use client";

import React from "react";
import { SupplierSummary } from "@/types/qogita";
import { Building2, AlertTriangle, CheckCircle2, ShoppingBag, ArrowRight } from "lucide-react";

interface SupplierFilterCardProps {
  suppliers: SupplierSummary[];
  selectedSupplier: string;
  onSelectSupplier: (supplierId: string) => void;
  orderTotal: number;
}

export const SupplierFilterCard: React.FC<SupplierFilterCardProps> = ({
  suppliers,
  selectedSupplier,
  onSelectSupplier,
  orderTotal,
}) => {
  const current = suppliers.find(
    (s) => s.supplierAllocationId === selectedSupplier
  );

  const mov = current ? Number(current.mov) || 0 : 0;
  const currency = current ? current.currency : "EUR";
  const progressPercent = mov > 0 ? Math.min(100, Math.round((orderTotal / mov) * 100)) : 100;
  const isMovMet = orderTotal >= mov;
  const remainingAmount = Math.max(0, mov - orderTotal);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Filter by Supplier Allocation ID
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Select a Supplier Allocation ID to isolate products and check order readiness against their Minimum Order Value (MOV).
          </p>
        </div>

        {/* Supplier Dropdown */}
        <div className="flex items-center gap-2">
          <label htmlFor="supplier-select" className="text-xs font-medium text-slate-600 whitespace-nowrap">
            Active Allocation:
          </label>
          <select
            id="supplier-select"
            value={selectedSupplier}
            onChange={(e) => onSelectSupplier(e.target.value)}
            className="text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="ALL">All Suppliers (Full Catalog)</option>
            {suppliers.map((s) => (
              <option key={s.supplierAllocationId} value={s.supplierAllocationId}>
                {s.supplierAllocationId} — Min: {s.currency} {Number(s.mov || 0).toFixed(0)} ({s.productCount} items)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Supplier Pill Chips for fast switching */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
        <button
          onClick={() => onSelectSupplier("ALL")}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
            selectedSupplier === "ALL"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          All Allocations
        </button>

        {suppliers.map((s) => {
          const isSelected = selectedSupplier === s.supplierAllocationId;
          return (
            <button
              key={s.supplierAllocationId}
              onClick={() => onSelectSupplier(s.supplierAllocationId)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                isSelected
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-100"
                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="font-mono">{s.supplierAllocationId}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded ${
                  isSelected ? "bg-indigo-700 text-indigo-100" : "bg-slate-100 text-slate-500"
                }`}
              >
                MOV: {s.currency} {Number(s.mov || 0).toFixed(0)}
              </span>
            </button>
          );
        })}
      </div>

      {/* When a specific supplier is selected, display their MOV Target Card & Cart Simulator */}
      {current && selectedSupplier !== "ALL" && (
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Supplier Minimum Order Value (MOV / MNQ)
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {currency} {mov.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {current.productCount} catalog products available from this supplier
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Current Simulated Order Value
            </div>
            <div className="text-2xl font-black text-indigo-600 mt-1">
              {currency} {orderTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Add products below using the quantity selector
            </div>
          </div>

          <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
            isMovMet
              ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
              : "bg-amber-50/70 border-amber-200 text-amber-900"
          }`}>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                {isMovMet ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Minimum Order Met ({progressPercent}%)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Below Supplier Minimum ({progressPercent}%)</span>
                  </>
                )}
              </div>
              <div className="text-xs mt-1">
                {isMovMet
                  ? `Ready to order! You meet ${current.supplierAllocationId}'s minimum requirement.`
                  : `Need ${currency} ${remainingAmount.toFixed(2)} more to place order with this supplier.`}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-200/80 rounded-full h-2 mt-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  isMovMet ? "bg-emerald-500" : "bg-amber-500"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
