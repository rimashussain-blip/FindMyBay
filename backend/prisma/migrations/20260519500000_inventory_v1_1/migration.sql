-- Inventory v1.1: service↔product linking + suppliers + purchase orders.
-- See ServiceProduct, Supplier, PurchaseOrder, PurchaseOrderItem in schema.prisma.

-- 1. Vendor.lastPoSeq for sequential PO references.
ALTER TABLE "vendors"
    ADD COLUMN "last_po_seq" INTEGER NOT NULL DEFAULT 0;

-- 2. ServiceProduct join: which products a service consumes per wash.
CREATE TABLE "service_products" (
    "id"            TEXT PRIMARY KEY,
    "service_id"    TEXT NOT NULL,
    "product_id"    TEXT NOT NULL,
    "qty_per_wash"  INTEGER NOT NULL DEFAULT 1,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_products_service_id_fkey"
        FOREIGN KEY ("service_id") REFERENCES "services"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "service_products_product_id_fkey"
        FOREIGN KEY ("product_id") REFERENCES "products"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "service_products_service_id_product_id_idx"
    ON "service_products"("service_id", "product_id");
CREATE INDEX "service_products_service_id_idx" ON "service_products"("service_id");
CREATE INDEX "service_products_product_id_idx" ON "service_products"("product_id");

-- 3. Suppliers.
CREATE TABLE "suppliers" (
    "id"           TEXT PRIMARY KEY,
    "vendor_id"    TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "contact_name" TEXT,
    "phone"        TEXT,
    "email"        TEXT,
    "notes"        TEXT,
    "deleted_at"   TIMESTAMP(3),
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_vendor_id_fkey"
        FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "suppliers_vendor_id_deleted_at_idx" ON "suppliers"("vendor_id", "deleted_at");

-- 4. Purchase orders.
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('draft', 'submitted', 'received', 'cancelled');

CREATE TABLE "purchase_orders" (
    "id"             TEXT PRIMARY KEY,
    "vendor_id"      TEXT NOT NULL,
    "supplier_id"    TEXT NOT NULL,
    "reference"      TEXT NOT NULL UNIQUE,
    "status"         "PurchaseOrderStatus" NOT NULL DEFAULT 'draft',
    "expected_at"    TIMESTAMP(3),
    "received_at"    TIMESTAMP(3),
    "total_aed"      INTEGER NOT NULL DEFAULT 0,
    "notes"          TEXT,
    "created_by_id"  TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_orders_vendor_id_fkey"
        FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "purchase_orders_supplier_id_fkey"
        FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "purchase_orders_vendor_id_status_idx" ON "purchase_orders"("vendor_id", "status");
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");

-- 5. PO line items.
CREATE TABLE "purchase_order_items" (
    "id"                TEXT PRIMARY KEY,
    "purchase_order_id" TEXT NOT NULL,
    "product_id"        TEXT NOT NULL,
    "qty"               INTEGER NOT NULL,
    "unit_cost_aed"     INTEGER NOT NULL DEFAULT 0,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_items_purchase_order_id_fkey"
        FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "purchase_order_items_product_id_fkey"
        FOREIGN KEY ("product_id") REFERENCES "products"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "purchase_order_items_purchase_order_id_product_id_idx"
    ON "purchase_order_items"("purchase_order_id", "product_id");
CREATE INDEX "purchase_order_items_purchase_order_id_idx"
    ON "purchase_order_items"("purchase_order_id");
CREATE INDEX "purchase_order_items_product_id_idx"
    ON "purchase_order_items"("product_id");
