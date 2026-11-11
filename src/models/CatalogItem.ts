import mongoose, { Schema, Document, Model } from "mongoose";
import { SupplierOffer } from "@/types/qogita";

export interface ICatalogItemDoc extends Omit<SupplierOffer, "id">, Document {}

const CatalogItemSchema = new Schema<ICatalogItemDoc>(
  {
    offerQid: { type: String, required: true, unique: true, index: true },
    supplierAllocationId: { type: String, required: true, index: true },
    supplierAlias: { type: String, index: true },
    gtin: { type: String, required: true, index: true },
    productName: { type: String, required: true, text: true },
    brand: { type: String, required: true, index: true },
    category: { type: String, index: true },
    price: { type: Number, required: true },
    currency: { type: String, default: "EUR" },
    inventory: { type: Number, required: true },
    mov: { type: Number, required: true },
    movCurrency: { type: String, default: "EUR" },
    isWellPriced: { type: Boolean, default: false },
    estimatedDeliveryTime: { type: String },
    productUrl: { type: String },
    imageUrl: { type: String },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

CatalogItemSchema.index({ supplierAllocationId: 1, gtin: 1 });
CatalogItemSchema.index({ brand: 1, price: 1 });

export const CatalogItem: Model<ICatalogItemDoc> =
  mongoose.models.CatalogItem ||
  mongoose.model<ICatalogItemDoc>("CatalogItem", CatalogItemSchema);
