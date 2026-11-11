"use client";

import React from "react";
import { Package, Users, Tag, Boxes } from "lucide-react";

interface StatsBarProps {
  stats: {
    totalProducts: number;
    totalSuppliers: number;
    totalBrands: number;
    totalInventory: number;
  };
}

export const StatsBar: React.FC<StatsBarProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
          <Package className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xl font-bold text-slate-900">
            {stats.totalProducts.toLocaleString()}
          </div>
          <div className="text-xs font-medium text-slate-500">
            Total Catalog Offers
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xl font-bold text-slate-900">
            {stats.totalSuppliers.toLocaleString()}
          </div>
          <div className="text-xs font-medium text-slate-500">
            Unique Supplier Allocations
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
          <Tag className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xl font-bold text-slate-900">
            {stats.totalBrands.toLocaleString()}
          </div>
          <div className="text-xs font-medium text-slate-500">
            Brands Represented
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
          <Boxes className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xl font-bold text-slate-900">
            {stats.totalInventory.toLocaleString()}
          </div>
          <div className="text-xs font-medium text-slate-500">
            Total Units in Stock
          </div>
        </div>
      </div>
    </div>
  );
};
