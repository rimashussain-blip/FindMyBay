-- Inventory: products catalog + stock movements log.
-- See the Product + StockMovement models in schema.prisma.

CREATE TYPE "ProductCategory" AS ENUM (
    'soap', 'wax', 'towel', 'consumable', 'equipment', 'other'
);

CREATE TYPE "StockMovementReason" AS ENUM (
    'restock', 'adjustment', 'used_in_wash', 'shrinkage', 'initial_stock'
);

CREATE TABLE "products" (
    "id"                  TEXT PRIMARY KEY,
    "vendor_id"           TEXT NOT NULL,
    "name"                TEXT NOT NULL,
    "sku"                 TEXT,
    "category"            "ProductCategory" NOT NULL DEFAULT 'other',
    "unit"                TEXT NOT NULL DEFAULT 'pcs',
    "cost_aed"            INTEGER,
    "stock_qty"           INTEGER NOT NULL DEFAULT 0,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 0,
    "location"            TEXT,
    "deleted_at"          TIMESTAMP(3),
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_vendor_id_fkey"
        FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- SKU is unique per-vendor when set (NULL allowed, NULLs don't collide
-- under standard SQL semantics so the partial UNIQUE constraint here is
-- safe). Two vendors can use the same SKU; one vendor can't.
CREATE UNIQUE INDEX "products_vendor_id_sku_idx" ON "products"("vendor_id", "sku");
CREATE INDEX "products_vendor_id_deleted_at_idx" ON "products"("vendor_id", "deleted_at");

CREATE TABLE "stock_movements" (
    "id"             TEXT PRIMARY KEY,
    "product_id"     TEXT NOT NULL,
    "vendor_id"      TEXT NOT NULL,
    "delta"          INTEGER NOT NULL,
    "resulting_qty"  INTEGER NOT NULL,
    "reason"         "StockMovementReason" NOT NULL,
    "note"           TEXT,
    "booking_id"     TEXT,
    "created_by_id"  TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_product_id_fkey"
        FOREIGN KEY ("product_id") REFERENCES "products"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_movements_vendor_id_fkey"
        FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "stock_movements_vendor_id_created_at_idx" ON "stock_movements"("vendor_id", "created_at");
CREATE INDEX "stock_movements_product_id_created_at_idx" ON "stock_movements"("product_id", "created_at");
