"use client";

import React, { useState } from "react";
import { SupplierOffer } from "@/types/qogita";
import { Search, Filter, Copy, Check, Plus, Minus } from "lucide-react";
import { formatUsd } from "./SupplierFilterCard";

interface CatalogTableProps {
  offers: SupplierOffer[];
  totalOffers: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedBrand: string;
  onBrandChange: (brand: string) => void;
  availableBrands: string[];
  onSelectSupplier: (supplierId: string) => void;
  onSelectMov?: (mov: string) => void;
  orderQuantities: Record<string, number>;
  onUpdateQuantity: (offerQid: string, qty: number) => void;
}

export const CatalogTable: React.FC<CatalogTableProps> = ({
  offers,
  totalOffers,
  currentPage,
  totalPages,
  onPageChange,
  searchQuery,
  onSearchChange,
  selectedBrand,
  onBrandChange,
  availableBrands,
  onSelectSupplier,
  onSelectMov,
  orderQuantities,
  onUpdateQuantity,
}) => {
  const [copiedGtin, setCopiedGtin] = useState<string | null>(null);

  const handleCopy = (gtin: string) => {
    navigator.clipboard.writeText(gtin);
    setCopiedGtin(gtin);
    setTimeout(() => setCopiedGtin(null), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Search & Filter Toolbar */}
      <div className="p-4 border-b border-slate-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by UPC / GTIN, product name, or brand..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedBrand}
            onChange={(e) => onBrandChange(e.target.value)}
            className="text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="ALL">All Brands</option>
            {availableBrands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">Supplier Allocation ID</th>
              <th className="py-3 px-4">Supplier MOV (USD)</th>
              <th className="py-3 px-4">GTIN / UPC</th>
              <th className="py-3 px-4">Brand</th>
              <th className="py-3 px-4">Product Description</th>
              <th className="py-3 px-4 text-right">Supplier Cost (USD)</th>
              <th className="py-3 px-4 text-center">Stock</th>
              <th className="py-3 px-4 text-center">Simulate Order</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {offers.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500">
                  No products found matching the current filters.
                </td>
              </tr>
            ) : (
              offers.map((item) => {
                const qty = orderQuantities[item.offerQid] || 0;
                return (
                  <tr
                    key={item.offerQid}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* Supplier Allocation ID Column */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        onClick={() => onSelectSupplier(item.supplierAllocationId)}
                        title="Click to filter by this supplier"
                        className="inline-flex items-center gap-1 font-mono font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 transition-colors"
                      >
                        {item.supplierAllocationId}
                      </button>
                    </td>

                    {/* Minimum Order Amount (MOV) Column */}
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-700">
                      <button
                        type="button"
                        onClick={() => onSelectMov?.(String(Math.round(item.mov || 0)))}
                        title="Click to filter by this MOV level"
                        className="inline-flex items-center font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-200 transition-colors"
                      >
                        {formatUsd(item.mov, 0)}
                      </button>
                    </td>

                    {/* GTIN / UPC */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <span>{item.gtin}</span>
                        <button
                          onClick={() => handleCopy(item.gtin)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded text-slate-500 transition-opacity"
                          title="Copy UPC / GTIN"
                        >
                          {copiedGtin === item.gtin ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Brand */}
                    <td className="py-3 px-4 whitespace-nowrap font-semibold text-slate-800">
                      {item.brand}
                    </td>

                    {/* Product Description */}
                    <td className="py-3 px-4 max-w-xs truncate text-slate-700 font-medium" title={item.productName}>
                      {item.productName}
                      {item.category && (
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {item.category}
                        </span>
                      )}
                    </td>

                    {/* Cost by Supplier */}
                    <td
                      className="py-3 px-4 text-right whitespace-nowrap font-bold text-slate-900"
                      title={
                        item.originalCurrency && item.originalCurrency !== "USD"
                          ? `Original: ${item.originalCurrency} ${Number(item.originalPrice || 0).toFixed(2)}`
                          : undefined
                      }
                    >
                      {formatUsd(item.price)}
                    </td>

                    {/* Inventory */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full ${
                          item.inventory > 50
                            ? "bg-emerald-50 text-emerald-700"
                            : item.inventory > 0
                            ? "bg-amber-50 text-amber-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {item.inventory} units
                      </span>
                    </td>

                    {/* Simulate Order Quantity */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onUpdateQuantity(item.offerQid, Math.max(0, qty - 5))}
                          disabled={qty === 0}
                          className="w-6 h-6 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          max={item.inventory || 9999}
                          value={qty}
                          onChange={(e) =>
                            onUpdateQuantity(item.offerQid, parseInt(e.target.value, 10) || 0)
                          }
                          className="w-12 text-center text-xs font-semibold py-0.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          onClick={() => onUpdateQuantity(item.offerQid, qty + 5)}
                          className="w-6 h-6 rounded flex items-center justify-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div>
          Showing {offers.length > 0 ? (currentPage - 1) * 50 + 1 : 0} to{" "}
          {Math.min(currentPage * 50, totalOffers)} of {totalOffers.toLocaleString()} offers
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            Previous
          </button>
          <span className="px-2 font-medium text-slate-700">
            Page {currentPage} of {Math.max(1, totalPages)}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
