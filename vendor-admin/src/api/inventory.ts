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

// ── Service recipes (auto-deduct linking) ───────────────────────────────

export interface RecipeItem {
  productId: string;
  productName: string;
  unit: string;
  category: ProductCategory;
  stockQty: number;
  qtyPerWash: number;
}

export async function getServiceRecipe(
  serviceId: string,
): Promise<{ serviceId: string; items: RecipeItem[] }> {
  const { data } = await api.get(`/admin/services/${serviceId}/products`);
  return data;
}

export async function putServiceRecipe(
  serviceId: string,
  items: Array<{ productId: string; qtyPerWash: number }>,
): Promise<{ serviceId: string; count: number }> {
  const { data } = await api.put(`/admin/services/${serviceId}/products`, { items });
  return data;
}

// ── Suppliers ───────────────────────────────────────────────────────────

export interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
}

export interface SupplierBody {
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export async function listSuppliers(): Promise<{ items: Supplier[] }> {
  const { data } = await api.get('/admin/inventory/suppliers');
  return data;
}
export async function createSupplier(body: SupplierBody): Promise<Supplier> {
  const { data } = await api.post('/admin/inventory/suppliers', body);
  return data;
}
export async function updateSupplier(id: string, body: Partial<SupplierBody>): Promise<Supplier> {
  const { data } = await api.patch(`/admin/inventory/suppliers/${id}`, body);
  return data;
}
export async function deleteSupplier(id: string): Promise<void> {
  await api.delete(`/admin/inventory/suppliers/${id}`);
}

// ── Purchase orders ─────────────────────────────────────────────────────

export type PoStatus = 'draft' | 'submitted' | 'received' | 'cancelled';

export interface PoItem {
  id: string;
  productId: string;
  productName: string;
  unit: string;
  qty: number;
  unitCostAed: number;
  lineTotalAed: number;
}

export interface PurchaseOrder {
  id: string;
  reference: string;
  status: PoStatus;
  expectedAt: string | null;
  receivedAt: string | null;
  totalAed: number;
  notes: string | null;
  createdAt: string;
  supplier: { id: string; name: string };
  items: PoItem[];
}

export interface CreatePoBody {
  supplierId: string;
  expectedAt?: string | null;
  notes?: string | null;
  items: Array<{ productId: string; qty: number; unitCostAed: number }>;
}

export async function listPurchaseOrders(status?: PoStatus): Promise<{ items: PurchaseOrder[] }> {
  const { data } = await api.get('/admin/inventory/purchase-orders', {
    params: status ? { status } : {},
  });
  return data;
}

export async function createPurchaseOrder(body: CreatePoBody): Promise<PurchaseOrder> {
  const { data } = await api.post('/admin/inventory/purchase-orders', body);
  return data;
}

export async function updatePurchaseOrder(
  id: string,
  body: Partial<CreatePoBody>,
): Promise<PurchaseOrder> {
  const { data } = await api.patch(`/admin/inventory/purchase-orders/${id}`, body);
  return data;
}

export async function submitPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const { data } = await api.post(`/admin/inventory/purchase-orders/${id}/submit`);
  return data;
}
export async function receivePurchaseOrder(id: string): Promise<PurchaseOrder> {
  const { data } = await api.post(`/admin/inventory/purchase-orders/${id}/receive`);
  return data;
}
export async function cancelPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const { data } = await api.post(`/admin/inventory/purchase-orders/${id}/cancel`);
  return data;
}
