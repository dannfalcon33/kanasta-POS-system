const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  role: 'Admin' | 'Cashier';
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: UserDto;
}

export interface AdminStatusResponse {
  hasAdmin: boolean;
}

export interface UserSessionDto {
  id: string;
  userId: string;
  terminalName: string | null;
  startedAt: string;
  endedAt: string | null;
  loginSuccess: boolean;
  failureReasonCode: string | null;
}

export interface CategoryDto {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
  productCount: number;
}

export interface TaxRateDto {
  id: string;
  name: string;
  rate: number;
  jurisdictionCode: string | null;
  isActive: boolean;
}

export interface ProductDto {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  baseUnit: string;
  salePrice: number;
  averageCost: number | null;
  stockQuantity: number;
  minimumStock: number | null;
  taxRateId: string | null;
  taxRateName: string | null;
  taxRate: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface SupplierDto {
  id: string;
  name: string;
  taxIdentifier: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
  purchaseCount: number;
}

export interface PurchaseItemDto {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  baseUnit: string;
  quantity: number;
  unitCost: number;
  taxRateSnapshot: number;
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
}

export interface PurchaseDto {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  supplierName: string;
  createdById: string;
  createdByName: string;
  status: 'Draft' | 'Received' | 'Cancelled';
  purchasedAt: string;
  receivedAt: string | null;
  subtotal: number;
  taxTotal: number;
  total: number;
  notes: string | null;
  items: PurchaseItemDto[];
  createdAt: string;
  updatedAt: string | null;
}

export interface PurchaseSummaryDto {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  supplierName: string;
  createdByName: string;
  status: string;
  purchasedAt: string;
  receivedAt: string | null;
  total: number;
  itemCount: number;
  createdAt: string;
}

export interface InventoryItemDto {
  productId: string;
  sku: string;
  barcode: string | null;
  productName: string;
  categoryName: string;
  baseUnit: string;
  stockQuantity: number;
  minimumStock: number | null;
  averageCost: number | null;
  salePrice: number;
  isLowStock: boolean;
  isActive: boolean;
}

export interface StockMovementDto {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  movementType: string;
  quantityDelta: number;
  quantityAfter: number;
  unitCostSnapshot: number | null;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
}

export interface SaleDto {
  id: string;
  saleNumber: string;
  cashierId: string;
  cashierName: string;
  status: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  currencyCode: string;
  completedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  itemCount: number;
  paymentMethod: string;
  paymentAmount: number;
  paymentReference: string | null;
}

export interface SaleItemDto {
  id: string;
  productId: string;
  skuSnapshot: string;
  productNameSnapshot: string;
  unitSnapshot: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRateSnapshot: number;
  taxAmount: number;
  lineTotal: number;
  unitCostSnapshot: number | null;
}

export interface PaymentDto {
  id: string;
  paymentMethod: string;
  amount: number;
  reference: string | null;
  paidAt: string;
  receivedByName: string;
}

export interface ReceiptDto {
  id: string;
  documentNumber: string;
  documentType: string;
  businessSnapshot: string;
  issuedAt: string;
  documentStatus: string;
}

export interface SaleDetailDto {
  id: string;
  saleNumber: string;
  cashierId: string;
  cashierName: string;
  status: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  currencyCode: string;
  completedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  items: SaleItemDto[];
  payment: PaymentDto | null;
  receipt: ReceiptDto | null;
}

export interface CreateSaleItemRequest {
  productId: string;
  quantity: number;
}

export interface CreateSaleRequest {
  items: CreateSaleItemRequest[];
  paymentMethod: number; // 1: Cash, 2: Card, 3: BankTransfer, 4: Other
  paymentAmount: number;
  paymentReference?: string | null;
  discountTotal?: number;
}

// --- Fase 6: Reportes y Dashboard DTOs ---
export interface TopProductDto {
  productId: string;
  productName: string;
  sku: string;
  unitsSold: number;
  revenue: number;
  costOfGoodsSold: number;
  grossMargin: number;
  grossMarginPercentage: number;
}

export interface PaymentMethodBreakdownDto {
  paymentMethod: string;
  totalAmount: number;
  transactionCount: number;
  percentage: number;
}

export interface CashierBreakdownDto {
  cashierId: string;
  cashierName: string;
  netSales: number;
  totalSales: number;
  averageTicket: number;
  salesCount: number;
}

export interface DailySalesDto {
  date: string;
  netSales: number;
  costOfGoodsSold: number;
  grossMargin: number;
  salesCount: number;
}

export interface LowStockAlertDto {
  productId: string;
  productName: string;
  sku: string;
  categoryName: string;
  stockQuantity: number;
  minimumStock: number;
  averageCost: number;
  baseUnit: string;
}

export interface DashboardSummaryDto {
  grossSales: number;
  netSales: number;
  taxTotal: number;
  costOfGoodsSold: number;
  grossMargin: number;
  grossMarginPercentage: number;
  inventoryValuation: number;
  lowStockAlertsCount: number;
  totalSalesCount: number;
  totalVoidedSalesCount: number;
  averageTicket: number;
  currencyCode: string;
  topSellingProducts: TopProductDto[];
  salesByPaymentMethod: PaymentMethodBreakdownDto[];
  salesByCashier: CashierBreakdownDto[];
  dailySalesTrend: DailySalesDto[];
  lowStockAlerts: LowStockAlertDto[];
}

export interface SalesReportItemDto {
  saleId: string;
  saleNumber: string;
  completedAt: string;
  cashierName: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  unitCostSnapshot: number;
  lineSubtotal: number;
  lineDiscount: number;
  lineNetSales: number;
  lineCmv: number;
  lineGrossProfit: number;
  lineTax: number;
  lineTotal: number;
}

export interface SalesReportDto {
  items: SalesReportItemDto[];
  totalLines: number;
  totalGrossSales: number;
  totalNetSales: number;
  totalCmv: number;
  totalGrossProfit: number;
  totalTax: number;
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('kanasta_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  async checkAdminStatus(): Promise<AdminStatusResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/status`);
    if (!res.ok) throw new Error('No se pudo verificar el estado del administrador.');
    return res.json();
  },

  async setupInitialAdmin(data: { email: string; password: string; fullName: string }): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/setup-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body?.error?.message || 'Error al configurar el administrador inicial.');
    }
    localStorage.setItem('kanasta_token', body.accessToken);
    return body;
  },

  async login(data: { email: string; password: string; terminalName?: string }): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body?.error?.message || 'Error al iniciar sesión.');
    }
    localStorage.setItem('kanasta_token', body.accessToken);
    return body;
  },

  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    } finally {
      localStorage.removeItem('kanasta_token');
    }
  },

  async getMe(): Promise<UserDto> {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Sesión inválida o expirada.');
    return res.json();
  },

  async getUsers(): Promise<UserDto[]> {
    const res = await fetch(`${API_BASE_URL}/users`, {
      headers: getAuthHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al obtener usuarios.');
    return body;
  },

  async createUser(data: { email: string; password: string; fullName: string; role: string }): Promise<UserDto> {
    const res = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al crear usuario.');
    return body;
  },

  async updateUserStatus(id: string, isActive: boolean): Promise<UserDto> {
    const res = await fetch(`${API_BASE_URL}/users/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ isActive }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al actualizar estado del usuario.');
    return body;
  },

  async getUserSessions(id: string): Promise<UserSessionDto[]> {
    const res = await fetch(`${API_BASE_URL}/users/${id}/sessions`, {
      headers: getAuthHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al obtener sesiones.');
    return body;
  },

  // --- Catálogo: Categorías ---
  async getCategories(includeInactive = false): Promise<CategoryDto[]> {
    const res = await fetch(`${API_BASE_URL}/categories?includeInactive=${includeInactive}`, {
      headers: getAuthHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al obtener categorías.');
    return body;
  },

  async createCategory(data: { name: string; description?: string }): Promise<CategoryDto> {
    const res = await fetch(`${API_BASE_URL}/categories`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al crear categoría.');
    return body;
  },

  async updateCategory(id: string, data: { name: string; description?: string }): Promise<CategoryDto> {
    const res = await fetch(`${API_BASE_URL}/categories/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al actualizar categoría.');
    return body;
  },

  async updateCategoryStatus(id: string, isActive: boolean): Promise<CategoryDto> {
    const res = await fetch(`${API_BASE_URL}/categories/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ isActive }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al actualizar estado de la categoría.');
    return body;
  },

  // --- Tasas de Impuesto ---
  async getTaxRates(activeOnly = true): Promise<TaxRateDto[]> {
    const res = await fetch(`${API_BASE_URL}/tax-rates?activeOnly=${activeOnly}`, {
      headers: getAuthHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al obtener tasas fiscales.');
    return body;
  },

  // --- Catálogo: Productos ---
  async getProducts(params?: {
    search?: string;
    categoryId?: string;
    isActive?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<PagedResult<ProductDto>> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.categoryId) query.append('categoryId', params.categoryId);
    if (params?.isActive !== undefined) query.append('isActive', String(params.isActive));
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));

    const res = await fetch(`${API_BASE_URL}/products?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al obtener productos.');
    return body;
  },

  async getProductById(id: string): Promise<ProductDto> {
    const res = await fetch(`${API_BASE_URL}/products/${id}`, {
      headers: getAuthHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al obtener producto.');
    return body;
  },

  async getProductByBarcode(barcode: string): Promise<ProductDto> {
    const res = await fetch(`${API_BASE_URL}/products/by-barcode/${encodeURIComponent(barcode)}`, {
      headers: getAuthHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al buscar por código de barras.');
    return body;
  },

  async getProductBySku(sku: string): Promise<ProductDto> {
    const res = await fetch(`${API_BASE_URL}/products/by-sku/${encodeURIComponent(sku)}`, {
      headers: getAuthHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al buscar por SKU.');
    return body;
  },

  async createProduct(data: {
    sku: string;
    barcode?: string;
    name: string;
    description?: string;
    categoryId: string;
    baseUnit: string;
    salePrice: number;
    averageCost?: number;
    minimumStock?: number;
    taxRateId?: string;
    initialStock?: number;
  }): Promise<ProductDto> {
    const res = await fetch(`${API_BASE_URL}/products`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al crear producto.');
    return body;
  },

  async updateProduct(
    id: string,
    data: {
      sku: string;
      barcode?: string;
      name: string;
      description?: string;
      categoryId: string;
      baseUnit: string;
      salePrice: number;
      averageCost?: number;
      minimumStock?: number;
      taxRateId?: string;
      stockQuantity?: number;
      stockAdjustmentReason?: string;
    }
  ): Promise<ProductDto> {
    const res = await fetch(`${API_BASE_URL}/products/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al actualizar producto.');
    return body;
  },

  async updateProductStatus(id: string, isActive: boolean): Promise<ProductDto> {
    const res = await fetch(`${API_BASE_URL}/products/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ isActive }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al actualizar estado del producto.');
    return body;
  },

  // --- Fase 4: Proveedores ---
  async getSuppliers(includeInactive = false): Promise<SupplierDto[]> {
    const res = await fetch(`${API_BASE_URL}/suppliers?includeInactive=${includeInactive}`, {
      headers: getAuthHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al obtener proveedores.');
    return body;
  },

  async createSupplier(data: {
    name: string;
    taxIdentifier?: string;
    phone?: string;
    email?: string;
    address?: string;
  }): Promise<SupplierDto> {
    const res = await fetch(`${API_BASE_URL}/suppliers`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al crear proveedor.');
    return body;
  },

  async updateSupplier(
    id: string,
    data: {
      name: string;
      taxIdentifier?: string;
      phone?: string;
      email?: string;
      address?: string;
    }
  ): Promise<SupplierDto> {
    const res = await fetch(`${API_BASE_URL}/suppliers/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al actualizar proveedor.');
    return body;
  },

  async updateSupplierStatus(id: string, isActive: boolean): Promise<SupplierDto> {
    const res = await fetch(`${API_BASE_URL}/suppliers/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ isActive }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al actualizar estado del proveedor.');
    return body;
  },

  // --- Fase 4: Compras ---
  async getPurchases(params?: {
    status?: string;
    supplierId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PagedResult<PurchaseSummaryDto>> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.supplierId) query.append('supplierId', params.supplierId);
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));

    const res = await fetch(`${API_BASE_URL}/purchases?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al obtener compras.');
    return body;
  },

  async getPurchaseById(id: string): Promise<PurchaseDto> {
    const res = await fetch(`${API_BASE_URL}/purchases/${id}`, {
      headers: getAuthHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al obtener detalle de la compra.');
    return body;
  },

  async createPurchase(data: {
    supplierId: string;
    purchaseNumber?: string;
    purchasedAt?: string;
    notes?: string;
    items: Array<{
      productId: string;
      quantity: number;
      unitCost: number;
      taxRateSnapshot?: number;
    }>;
  }): Promise<PurchaseDto> {
    const res = await fetch(`${API_BASE_URL}/purchases`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al registrar compra.');
    return body;
  },

  async receivePurchase(id: string): Promise<PurchaseDto> {
    const res = await fetch(`${API_BASE_URL}/purchases/${id}/receive`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al recibir mercancía de la compra.');
    return body;
  },

  async cancelPurchase(id: string, reason?: string): Promise<PurchaseDto> {
    const res = await fetch(`${API_BASE_URL}/purchases/${id}/cancel`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al cancelar la compra.');
    return body;
  },

  // --- Fase 4: Inventario y Movimientos ---
  async getInventory(params?: {
    search?: string;
    categoryId?: string;
    lowStockOnly?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<PagedResult<InventoryItemDto>> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.categoryId) query.append('categoryId', params.categoryId);
    if (params?.lowStockOnly !== undefined) query.append('lowStockOnly', String(params.lowStockOnly));
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));

    const res = await fetch(`${API_BASE_URL}/inventory?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al consultar inventario.');
    return body;
  },

  async getStockMovements(params?: {
    productId?: string;
    movementType?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PagedResult<StockMovementDto>> {
    const query = new URLSearchParams();
    if (params?.productId) query.append('productId', params.productId);
    if (params?.movementType) query.append('movementType', params.movementType);
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));

    const res = await fetch(`${API_BASE_URL}/inventory/movements?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al obtener movimientos de stock.');
    return body;
  },

  async createManualAdjustment(data: {
    productId: string;
    quantityDelta: number;
    reason: string;
  }): Promise<StockMovementDto> {
    const res = await fetch(`${API_BASE_URL}/inventory/adjustments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al registrar ajuste de inventario.');
    return body;
  },

  async createSale(data: CreateSaleRequest): Promise<SaleDetailDto> {
    const res = await fetch(`${API_BASE_URL}/sales`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al registrar venta.');
    return body;
  },

  async getSales(params?: {
    cashierId?: string;
    status?: number;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PagedResult<SaleDto>> {
    const query = new URLSearchParams();
    if (params?.cashierId) query.append('cashierId', params.cashierId);
    if (params?.status !== undefined) query.append('status', String(params.status));
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));

    const res = await fetch(`${API_BASE_URL}/sales?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al obtener ventas.');
    return body;
  },

  async getSaleById(id: string): Promise<SaleDetailDto> {
    const res = await fetch(`${API_BASE_URL}/sales/${id}`, {
      headers: getAuthHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al obtener detalle de la venta.');
    return body;
  },

  async voidSale(id: string, reason: string): Promise<SaleDetailDto> {
    const res = await fetch(`${API_BASE_URL}/sales/${id}/void`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al anular la venta.');
    return body;
  },

  // --- Fase 6: Reportes y Dashboard ---
  async getDashboardSummary(params?: {
    startDate?: string;
    endDate?: string;
    cashierId?: string;
  }): Promise<DashboardSummaryDto> {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.cashierId) query.append('cashierId', params.cashierId);

    const res = await fetch(`${API_BASE_URL}/reports/dashboard?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al obtener métricas del dashboard.');
    return body;
  },

  async getSalesReport(params?: {
    startDate?: string;
    endDate?: string;
    cashierId?: string;
    productId?: string;
  }): Promise<SalesReportDto> {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.cashierId) query.append('cashierId', params.cashierId);
    if (params?.productId) query.append('productId', params.productId);

    const res = await fetch(`${API_BASE_URL}/reports/sales?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Error al obtener informe detallado de ventas.');
    return body;
  },
};

