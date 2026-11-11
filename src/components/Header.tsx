"use client";

import React from "react";
import { Download, RefreshCw, Upload, Database, Layers } from "lucide-react";

interface HeaderProps {
  onOpenSync: () => void;
  onOpenUpload: () => void;
  onExport: () => void;
  selectedSupplier: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSync,
  onOpenUpload,
  onExport,
  selectedSupplier,
}) => {
  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-100">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Qogita Supplier Allocation Portal
              </h1>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                API Live
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Filter by Supplier Allocation ID &bull; View Supplier Minimums (MOV) &bull; CSV Export
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenUpload}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Import / Enrich CSV
          </button>

          <button
            onClick={onOpenSync}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sync from Qogita API
          </button>

          <button
            onClick={onExport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-200 transition-all hover:shadow"
          >
            <Download className="w-3.5 h-3.5" />
            {selectedSupplier && selectedSupplier !== "ALL"
              ? `Export ${selectedSupplier} CSV`
              : "Export Full CSV"}
          </button>
        </div>
      </div>
    </header>
  );
};
