"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { StatsBar } from "@/components/StatsBar";
import { SupplierFilterCard } from "@/components/SupplierFilterCard";
import { CatalogTable } from "@/components/CatalogTable";
import { SyncModal } from "@/components/SyncModal";
import { UploadCsvModal } from "@/components/UploadCsvModal";
import { SupplierOffer, SupplierSummary } from "@/types/qogita";

export default function Home() {
  const [offers, setOffers] = useState<SupplierOffer[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalSuppliers: 0,
    totalBrands: 0,
    totalInventory: 0,
  });

  const [selectedSupplier, setSelectedSupplier] = useState<string>("ALL");
  const [selectedMov, setSelectedMov] = useState<string>("ALL");
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalOffers, setTotalOffers] = useState<number>(0);

  // Simulated order builder quantities per offerQid
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});

  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch suppliers list
  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch("/api/suppliers");
      const data = await res.json();
      if (data.success) {
        setSuppliers(data.suppliers);
      }
    } catch (e) {
      console.error("Error fetching suppliers:", e);
    }
  }, []);

  // Fetch products with filters
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedSupplier && selectedSupplier !== "ALL") {
        params.append("supplierAllocationId", selectedSupplier);
      }
      if (selectedMov && selectedMov !== "ALL") {
        params.append("mov", selectedMov);
      }
      if (selectedBrand && selectedBrand !== "ALL") {
        params.append("brand", selectedBrand);
      }
      if (searchQuery) {
        params.append("search", searchQuery);
      }
      params.append("page", currentPage.toString());
      params.append("limit", "50");

      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setOffers(data.results);
        setTotalOffers(data.total);
        setTotalPages(data.totalPages);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (e) {
      console.error("Error fetching products:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedSupplier, selectedMov, selectedBrand, searchQuery, currentPage]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Calculate simulated cart subtotal for the currently selected supplier
  const currentSupplierOrderTotal = offers
    .filter(
      (item) =>
        selectedSupplier === "ALL" ||
        item.supplierAllocationId === selectedSupplier
    )
    .reduce((sum, item) => {
      const qty = orderQuantities[item.offerQid] || 0;
      return sum + qty * (Number(item.price) || 0);
    }, 0);

  const handleUpdateQuantity = (offerQid: string, qty: number) => {
    setOrderQuantities((prev) => ({
      ...prev,
      [offerQid]: qty,
    }));
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (selectedSupplier && selectedSupplier !== "ALL") {
      params.append("supplierAllocationId", selectedSupplier);
    }
    if (selectedMov && selectedMov !== "ALL") {
      params.append("mov", selectedMov);
    }
    window.location.href = `/api/export?${params.toString()}`;
  };

  // Derive unique brands for filter dropdown
  const availableBrands = Array.from(
    new Set(offers.map((item) => item.brand))
  ).sort();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header
        onOpenSync={() => setIsSyncModalOpen(true)}
        onOpenUpload={() => setIsUploadModalOpen(true)}
        onExport={handleExportCsv}
        selectedSupplier={selectedSupplier}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1 w-full">
        <StatsBar stats={stats} />

        <SupplierFilterCard
          suppliers={suppliers}
          selectedSupplier={selectedSupplier}
          onSelectSupplier={(sid) => {
            setSelectedSupplier(sid);
            setCurrentPage(1);
          }}
          selectedMov={selectedMov}
          onSelectMov={(mov) => {
            setSelectedMov(mov);
            setCurrentPage(1);
          }}
          orderTotal={currentSupplierOrderTotal}
        />

        <CatalogTable
          offers={offers}
          totalOffers={totalOffers}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          searchQuery={searchQuery}
          onSearchChange={(q) => {
            setSearchQuery(q);
            setCurrentPage(1);
          }}
          selectedBrand={selectedBrand}
          onBrandChange={(b) => {
            setSelectedBrand(b);
            setCurrentPage(1);
          }}
          availableBrands={availableBrands}
          onSelectSupplier={(sid) => {
            setSelectedSupplier(sid);
            setCurrentPage(1);
          }}
          onSelectMov={(mov) => {
            setSelectedMov(mov);
            setCurrentPage(1);
          }}
          orderQuantities={orderQuantities}
          onUpdateQuantity={handleUpdateQuantity}
        />
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-400">
          Qogita B2B Supplier Allocation Explorer &bull; Built with Next.js & MongoDB Atlas
        </div>
      </footer>

      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSyncComplete={() => {
          fetchSuppliers();
          fetchProducts();
        }}
      />

      <UploadCsvModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadComplete={() => {
          fetchSuppliers();
          fetchProducts();
        }}
      />
    </div>
  );
}
