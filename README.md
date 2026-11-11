# Qogita Catalog & Supplier Allocation Explorer

A Next.js & MongoDB Atlas full-stack solution to extract, filter, and export the complete Qogita wholesale catalog **with Supplier Allocation IDs and Minimum Order Values (MOV / MNQ)**.

---

## 🎯 Solution Overview for Your Client

### Why Qogita's Default Catalog Downloads Are Missing Supplier Allocation IDs
When you download a standard catalog spreadsheet directly from Qogita (e.g. `10-29-26 Full Qogita Catalog`), Qogita groups products and only displays the **single lowest market price** or an aggregated listing. The export intentionally omits:
1. **The Supplier Allocation ID** (Qogita's anonymous supplier identifier / `seller` / `allocation_fid`).
2. **The Supplier's Minimum Order Value (MOV / MNQ)** (e.g., $500, $1,000, or €2,500 required per supplier).

Because Qogita's cart optimizer splits orders across multiple distinct suppliers, adding products without knowing which supplier they come from leads to checkout errors: **orders cannot be submitted if any single supplier allocation fails to reach their minimum $$ threshold**.

### How This System Solves It via the Qogita API
According to Qogita's developer portal (`https://qogita.notion.site/Qogita-Developer-Portal-d2e0a30921d646b19b9468aebe2a03dc`):
1. **Multi-Supplier Offer Extraction (`/buyers/variants/{variant_fid}/offers/`)**:
   - For every product variant, Qogita provides an `offers` array.
   - Each individual offer exposes:
     - `seller`: **The Supplier Allocation ID** (e.g., `SUP-AL-1084`).
     - `tieredPrices[0].tierPrice`: **Supplier Cost** (`amount` & `currency`).
     - `tieredPrices[0].tierMov`: **Supplier Minimum Order Value (MOV)** (`amount` & `currency`).
     - `inventory`: Available stock from that exact supplier.
2. **Supplier Allocation Search (`/variants/offers/search/{allocation_fid}/`)**:
   - Allows querying all products offered by an active cart supplier allocation to easily find qualifying add-on products to hit the MOV.
3. **Cart Allocations Tracker (`/buyers/carts/active/allocations/`)**:
   - Tracks real-time per-supplier subtotal vs MOV progress (`movProgress`).

---

## 🚀 Features Built in this App

- **Supplier Allocation ID Filter**: Select any supplier to see only their inventory, UPCs, brand, and supplier cost.
- **Minimum Order Value (MOV / MNQ) Simulator**:
  - Live progress bar showing how close your selected order is to the supplier's MOV threshold.
  - Clear visual indicator: Alert if below minimum, success status when ready to order.
- **Custom CSV Export**:
  - Exports a spreadsheet containing:
    - `Supplier Allocation ID`
    - `Supplier Minimum Order ($$)`
    - `Currency`
    - `Supplier Cost`
    - `GTIN / UPC`
    - `Brand`
    - `Product Description`
    - `Category`
    - `Available Inventory`
    - `Offer QID`
    - `Product URL`
- **CSV Enricher**: Upload any standard Qogita catalog file (e.g. `10-29-26 Full Qogita Catalog(1).csv`) and automatically map/enrich it with Supplier Allocation IDs and MOVs.
- **Dual Storage Engine**:
  - **MongoDB Atlas** for high-volume indexing and production storage.
  - **Zero-config local cache fallback** (`data/catalog.json`) so the app works immediately out of the box without any setup.

---

## 🛠️ Getting Started

### 1. Prerequisites
- Node.js 18+ (tested on Node v22)
- npm 10+

### 2. Configuration (`.env.local`)
Create or edit `.env.local`:
```env
# Qogita API Credentials
QOGITA_API_URL=https://api.qogita.com
QOGITA_EMAIL=your-buyer-email@example.com
QOGITA_PASSWORD=your-qogita-password

# MongoDB Atlas URI (Optional - app falls back to local JSON store if empty)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/qogita_catalog?retryWrites=true&w=majority
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production
```bash
npm run build
npm start
```

---

## 📡 API Endpoints

- `GET /api/products`: Filter products by `supplierAllocationId`, `brand`, `search`, with pagination.
- `GET /api/suppliers`: Get summary of all supplier allocations and their MOV thresholds.
- `GET /api/export`: Download the enriched CSV with Supplier Allocation ID and MOV.
- `POST /api/sync`: Pulls live catalog and multi-supplier variant offers from Qogita API.
- `POST /api/upload-csv`: Upload and enrich existing catalog spreadsheets.
