// Vendor admin — Inventory API client.
// Mirrors backend/src/admin/inventory.ts.

import { api } from './client';

export type ProductCategory =
  | 'soap'
  | 'wax'
  | 'towel'
  | 'consumable'
  | 'equipment'
  | 'other';

export type StockMovementReason =
  | 'restock'
  | 'adjustment'
  | 'used_in_wash'
  | 'shrinkage'
  | 'initial_stock';

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  category: ProductCategory;
  unit: string;
  costAed: number | null;
  stockQty: number;
  lowStockThreshold: number;
  location: string | null;
  isLowStock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  delta: number;
  resultingQty: number;
  reason: StockMovementReason;
  note: string | null;
  bookingId: string | null;
  createdAt: string;
  product: { name: string; unit: string; category: ProductCategory };
}

export interface MovementListResponse {
  page: number;
  pageSize: number;
  total: number;
  items: StockMovement[];
}

export interface CreateProductBody {
  name: string;
  sku?: string | null;
  category: ProductCategory;
  unit: string;
  costAed?: number | null;
  lowStockThreshold: number;
  location?: string | null;
  initialQty: number;
}

export type UpdateProductBody = Partial<Omit<CreateProductBody, 'initialQty'>>;

export interface AdjustBody {
  delta: number;
  reason: 'restock' | 'adjustment' | 'shrinkage';
  note?: string;
}

export async function listProducts(): Promise<{ items: Product[] }> {
  const { data } = await api.get('/admin/inventory/products');
  return data;
}

export async function createProduct(body: CreateProductBody): Promise<Product> {
  const { data } = await api.post('/admin/inventory/products', body);
  return data;
}

export async function updateProduct(id: string, body: UpdateProductBody): Promise<Product> {
  const { data } = await api.patch(`/admin/inventory/products/${id}`, body);
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  await api.delete(`/admin/inventory/products/${id}`);
}

export async function adjustStock(
  id: string,
  body: AdjustBody,
): Promise<{ product: Product; movement: StockMovement }> {
  const { data } = await api.post(`/admin/inventory/products/${id}/adjust`, body);
  return data;
}

export async function listMovements(opts: {
  productId?: string;
  reason?: StockMovementReason;
  page?: number;
  pageSize?: number;
}): Promise<MovementListResponse> {
  const { data } = await api.get('/admin/inventory/movements', { params: opts });
  return data;
}

export async function listLowStock(): Promise<{
  items: Array<{
    id: string;
    name: string;
    category: ProductCategory;
    unit: string;
    stockQty: number;
    lowStockThreshold: number;
  }>;
}> {
  const { data } = await api.get('/admin/inventory/low-stock');
  return data;
}
