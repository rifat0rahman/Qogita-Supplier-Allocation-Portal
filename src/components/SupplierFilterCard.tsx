"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { SupplierSummary } from "@/types/qogita";
import { Building2, AlertTriangle, CheckCircle2, Search, ChevronDown, X, Check } from "lucide-react";

interface SupplierFilterCardProps {
  suppliers: SupplierSummary[];
  selectedSupplier: string;
  onSelectSupplier: (supplierId: string) => void;
  orderTotal: number;
}

const MAX_VISIBLE_RESULTS = 200;

export const formatUsd = (value: number, fractionDigits = 2) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number(value) || 0);

export const SupplierFilterCard: React.FC<SupplierFilterCardProps> = ({
  suppliers,
  selectedSupplier,
  onSelectSupplier,
  orderTotal,
}) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close the dropdown when clicking outside of it
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredSuppliers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.supplierAllocationId.toLowerCase().includes(q) ||
        s.brands?.some((b) => b?.toLowerCase().includes(q))
    );
  }, [suppliers, query]);

  const handleSelect = (id: string) => {
    onSelectSupplier(id);
    setQuery("");
    setIsOpen(false);
  };

  const current = suppliers.find(
    (s) => s.supplierAllocationId === selectedSupplier
  );

  const mov = current ? Number(current.mov) || 0 : 0;
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
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {suppliers.length.toLocaleString()} allocations
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Search any Supplier Allocation ID (or brand) to isolate products and check order readiness against their Minimum Order Value (MOV). All amounts shown in USD.
          </p>
        </div>

        {/* Searchable Supplier Picker */}
        <div ref={containerRef} className="relative w-full md:w-96">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                id="supplier-search"
                type="text"
                autoComplete="off"
                role="combobox"
                aria-expanded={isOpen}
                aria-controls="supplier-listbox"
                placeholder={
                  selectedSupplier === "ALL"
                    ? "Search Supplier Allocation ID..."
                    : selectedSupplier
                }
                value={query}
                onFocus={() => setIsOpen(true)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIsOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setIsOpen(false);
                  if (e.key === "Enter") {
                    const q = query.trim();
                    const exact = suppliers.find(
                      (s) => s.supplierAllocationId.toLowerCase() === q.toLowerCase()
                    );
                    if (exact) handleSelect(exact.supplierAllocationId);
                    else if (filteredSuppliers.length === 1)
                      handleSelect(filteredSuppliers[0].supplierAllocationId);
                  }
                }}
                className={`w-full pl-9 pr-8 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                  selectedSupplier !== "ALL" ? "placeholder-slate-800 font-mono" : "placeholder-slate-400"
                }`}
              />
              <button
                type="button"
                onClick={() => {
                  setIsOpen((o) => !o);
                  inputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Toggle supplier list"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            {selectedSupplier !== "ALL" && (
              <button
                type="button"
                onClick={() => handleSelect("ALL")}
                className="flex items-center gap-1 px-2.5 py-2 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 whitespace-nowrap"
                title="Clear supplier filter"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>

          {isOpen && (
            <ul
              id="supplier-listbox"
              role="listbox"
              className="absolute z-20 mt-1 w-full max-h-80 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg py-1 text-xs"
            >
              <li
                role="option"
                aria-selected={selectedSupplier === "ALL"}
                onClick={() => handleSelect("ALL")}
                className="px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between font-medium text-slate-700"
              >
                All Suppliers (Full Catalog)
                {selectedSupplier === "ALL" && <Check className="w-3.5 h-3.5 text-indigo-600" />}
              </li>
              {filteredSuppliers.slice(0, MAX_VISIBLE_RESULTS).map((s) => {
                const isSelected = selectedSupplier === s.supplierAllocationId;
                return (
                  <li
                    key={s.supplierAllocationId}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(s.supplierAllocationId)}
                    className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected ? "bg-indigo-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="font-mono font-semibold text-slate-800 truncate">
                      {s.supplierAllocationId}
                    </span>
                    <span className="flex items-center gap-2 text-[11px] text-slate-500 whitespace-nowrap">
                      <span>MOV {formatUsd(s.mov, 0)}</span>
                      <span className="text-slate-300">•</span>
                      <span>{s.productCount} items</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                    </span>
                  </li>
                );
              })}
              {filteredSuppliers.length === 0 && (
                <li className="px-3 py-3 text-slate-500 text-center">
                  No Supplier Allocation ID matches &quot;{query}&quot;
                </li>
              )}
              {filteredSuppliers.length > MAX_VISIBLE_RESULTS && (
                <li className="px-3 py-2 text-[11px] text-slate-400 text-center border-t border-slate-100">
                  Showing first {MAX_VISIBLE_RESULTS} of {filteredSuppliers.length.toLocaleString()} — keep typing to narrow down
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* When a specific supplier is selected, display their MOV Target Card & Cart Simulator */}
      {current && selectedSupplier !== "ALL" && (
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Supplier Minimum Order Value (MOV / MNQ)
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {formatUsd(mov)}
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
              {formatUsd(orderTotal)}
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
                  : `Need ${formatUsd(remainingAmount)} more to place order with this supplier.`}
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
