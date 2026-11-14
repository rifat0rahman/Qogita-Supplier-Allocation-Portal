"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { SupplierSummary } from "@/types/qogita";
import {
  Building2,
  AlertTriangle,
  CheckCircle2,
  Search,
  ChevronDown,
  X,
  Check,
  DollarSign,
} from "lucide-react";

interface SupplierFilterCardProps {
  suppliers: SupplierSummary[];
  selectedSupplier: string;
  onSelectSupplier: (supplierId: string) => void;
  selectedMov: string;
  onSelectMov: (mov: string) => void;
  orderTotal: number;
}

const MAX_VISIBLE_RESULTS = 200;
const STANDARD_MOV_LEVELS = [500, 1500, 5000, 10000, 15000];

export const formatUsd = (value: number, fractionDigits = 2) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number(value) || 0);

function supplierHasMov(s: SupplierSummary, targetMov: number): boolean {
  if (s.movs && s.movs.length > 0) {
    return s.movs.some((m) => Math.round(m) === Math.round(targetMov));
  }
  return Math.round(Number(s.mov) || 0) === Math.round(targetMov);
}

export const SupplierFilterCard: React.FC<SupplierFilterCardProps> = ({
  suppliers,
  selectedSupplier,
  onSelectSupplier,
  selectedMov,
  onSelectMov,
  orderTotal,
}) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close the dropdown when clicking outside of it
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Compute all available MOV levels across suppliers + standard Qogita tiers
  const movLevelsWithCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const std of STANDARD_MOV_LEVELS) {
      counts.set(std, 0);
    }
    for (const s of suppliers) {
      const list =
        s.movs && s.movs.length > 0 ? s.movs : [Math.round(Number(s.mov) || 0)];
      for (const rawMov of list) {
        const m = Math.round(Number(rawMov) || 0);
        if (m > 0) {
          counts.set(m, (counts.get(m) || 0) + 1);
        }
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([movValue, supplierCount]) => ({ movValue, supplierCount }));
  }, [suppliers]);

  // Filter suppliers by selected MOV level AND search query
  const movFilteredSuppliers = useMemo(() => {
    if (!selectedMov || selectedMov === "ALL") return suppliers;
    const targetMov = Number(selectedMov);
    if (!targetMov || isNaN(targetMov)) return suppliers;
    return suppliers.filter((s) => supplierHasMov(s, targetMov));
  }, [suppliers, selectedMov]);

  const filteredSuppliers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return movFilteredSuppliers;
    return movFilteredSuppliers.filter(
      (s) =>
        s.supplierAllocationId.toLowerCase().includes(q) ||
        s.brands?.some((b) => b?.toLowerCase().includes(q))
    );
  }, [movFilteredSuppliers, query]);

  const handleSelectSupplier = (id: string) => {
    onSelectSupplier(id);
    setQuery("");
    setIsOpen(false);
  };

  const current = suppliers.find(
    (s) => s.supplierAllocationId === selectedSupplier
  );

  const activeMovNumber =
    selectedMov !== "ALL"
      ? Number(selectedMov) || 0
      : current
      ? Number(current.mov) || 0
      : 0;

  const progressPercent =
    activeMovNumber > 0
      ? Math.min(100, Math.round((orderTotal / activeMovNumber) * 100))
      : 100;
  const isMovMet = orderTotal >= activeMovNumber;
  const remainingAmount = Math.max(0, activeMovNumber - orderTotal);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Filter by Supplier Allocation ID &amp; MOV
            </h2>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {selectedMov === "ALL"
                ? `${suppliers.length.toLocaleString()} allocations`
                : `${movFilteredSuppliers.length.toLocaleString()} of ${suppliers.length.toLocaleString()} allocations`}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Filter by any Supplier Allocation ID, their Minimum Order Value (MOV) tier ($500, $1,500, $5,000, etc.), or both together. All amounts in USD.
          </p>
        </div>

        {/* Controls: Supplier Allocation Search + MOV Dropdown */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
          {/* Searchable Supplier Picker */}
          <div ref={containerRef} className="relative flex-1 sm:w-80">
            <div className="flex items-center gap-1.5">
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
                      const exact = movFilteredSuppliers.find(
                        (s) =>
                          s.supplierAllocationId.toLowerCase() ===
                          q.toLowerCase()
                      );
                      if (exact) handleSelectSupplier(exact.supplierAllocationId);
                      else if (filteredSuppliers.length === 1)
                        handleSelectSupplier(
                          filteredSuppliers[0].supplierAllocationId
                        );
                    }
                  }}
                  className={`w-full pl-9 pr-8 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                    selectedSupplier !== "ALL"
                      ? "placeholder-slate-900 font-mono bg-indigo-50/50 border-indigo-300"
                      : "placeholder-slate-400"
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
                  onClick={() => handleSelectSupplier("ALL")}
                  className="flex items-center gap-1 px-2.5 py-2 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 whitespace-nowrap"
                  title="Clear supplier filter"
                >
                  <X className="w-3.5 h-3.5" />
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
                  onClick={() => handleSelectSupplier("ALL")}
                  className="px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between font-medium text-slate-700"
                >
                  <span>
                    All Suppliers{" "}
                    {selectedMov !== "ALL"
                      ? `(with ${formatUsd(Number(selectedMov), 0)} MOV)`
                      : "(Full Catalog)"}
                  </span>
                  {selectedSupplier === "ALL" && (
                    <Check className="w-3.5 h-3.5 text-indigo-600" />
                  )}
                </li>
                {filteredSuppliers.slice(0, MAX_VISIBLE_RESULTS).map((s) => {
                  const isSelected =
                    selectedSupplier === s.supplierAllocationId;
                  const movLabel =
                    s.movs && s.movs.length > 1
                      ? s.movs.map((m) => formatUsd(m, 0)).join(" / ")
                      : formatUsd(s.mov, 0);
                  return (
                    <li
                      key={s.supplierAllocationId}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() =>
                        handleSelectSupplier(s.supplierAllocationId)
                      }
                      className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected ? "bg-indigo-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <span className="font-mono font-semibold text-slate-800 truncate">
                        {s.supplierAllocationId}
                      </span>
                      <span className="flex items-center gap-2 text-[11px] text-slate-500 whitespace-nowrap">
                        <span>MOV {movLabel}</span>
                        <span className="text-slate-300">•</span>
                        <span>{s.productCount} items</span>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-indigo-600" />
                        )}
                      </span>
                    </li>
                  );
                })}
                {filteredSuppliers.length === 0 && (
                  <li className="px-3 py-3 text-slate-500 text-center">
                    No Supplier Allocation ID matches{" "}
                    {query ? `"${query}"` : "this MOV filter"}
                  </li>
                )}
                {filteredSuppliers.length > MAX_VISIBLE_RESULTS && (
                  <li className="px-3 py-2 text-[11px] text-slate-400 text-center border-t border-slate-100">
                    Showing first {MAX_VISIBLE_RESULTS} of{" "}
                    {filteredSuppliers.length.toLocaleString()} — keep typing to
                    narrow down
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* MOV Dropdown Selector */}
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1 sm:flex-initial">
              <DollarSign className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                aria-label="Filter by Supplier MOV Level"
                value={selectedMov}
                onChange={(e) => onSelectMov(e.target.value)}
                className={`w-full sm:w-auto pl-7 pr-7 py-2 text-xs font-semibold border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                  selectedMov !== "ALL"
                    ? "bg-indigo-50/60 border-indigo-300 text-indigo-900"
                    : "bg-slate-50 border-slate-300 text-slate-800"
                }`}
              >
                <option value="ALL">All MOV Levels</option>
                {movLevelsWithCounts.map(({ movValue, supplierCount }) => (
                  <option key={movValue} value={String(movValue)}>
                    MOV: {formatUsd(movValue, 0)} ({supplierCount} suppliers)
                  </option>
                ))}
              </select>
            </div>

            {(selectedSupplier !== "ALL" || selectedMov !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  onSelectSupplier("ALL");
                  onSelectMov("ALL");
                  setQuery("");
                }}
                className="px-2.5 py-2 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 whitespace-nowrap"
                title="Reset Supplier and MOV filters"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick-Select MOV Level Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap mr-1">
          MOV Level:
        </span>
        <button
          type="button"
          onClick={() => onSelectMov("ALL")}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
            selectedMov === "ALL"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          All MOVs
        </button>

        {movLevelsWithCounts.map(({ movValue, supplierCount }) => {
          const isSelected = selectedMov === String(movValue);
          const isCurrentSupplierMov =
            current && supplierHasMov(current, movValue);
          return (
            <button
              key={movValue}
              type="button"
              onClick={() =>
                onSelectMov(isSelected ? "ALL" : String(movValue))
              }
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                isSelected
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-100"
                  : isCurrentSupplierMov
                  ? "bg-indigo-50/70 text-indigo-800 border-indigo-300 hover:bg-indigo-100/70"
                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="font-semibold">{formatUsd(movValue, 0)}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded ${
                  isSelected
                    ? "bg-indigo-700 text-indigo-100"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {supplierCount} {supplierCount === 1 ? "supplier" : "suppliers"}
              </span>
            </button>
          );
        })}
      </div>

      {/* When a specific supplier or MOV level is selected, display MOV Target Card & Cart Simulator */}
      {(selectedSupplier !== "ALL" || selectedMov !== "ALL") &&
        activeMovNumber > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                {current
                  ? `Supplier ${current.supplierAllocationId} MOV`
                  : "Selected Minimum Order Value (MOV)"}
              </div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {formatUsd(activeMovNumber)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {current
                  ? `${current.productCount} catalog products from ${current.supplierAllocationId}`
                  : `${movFilteredSuppliers.length} suppliers offer this MOV tier`}
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

            <div
              className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                isMovMet
                  ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                  : "bg-amber-50/70 border-amber-200 text-amber-900"
              }`}
            >
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
                    ? `Ready to order! You meet the ${formatUsd(
                        activeMovNumber,
                        0
                      )} minimum requirement.`
                    : `Need ${formatUsd(
                        remainingAmount
                      )} more to reach the ${formatUsd(
                        activeMovNumber,
                        0
                      )} MOV.`}
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
