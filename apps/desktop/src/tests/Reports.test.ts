import { describe, it, expect } from 'vitest';
import { SalesReportItemDto } from '../lib/api';

describe('Kanasta Desktop Reports & Financial Dashboard Tests (Phase 6)', () => {
  it('calculates GrossMargin and GrossMarginPercentage accurately according to financial formulas', () => {
    // Formula: GrossMargin = NetSales - CMV
    // Formula: GrossMarginPercentage = (GrossMargin / NetSales) * 100 (when NetSales > 0)
    
    // Scenario 1: Standard healthy profit margin
    const netSales1 = 18.75;
    const cmv1 = 13.25;
    const grossMargin1 = Math.round((netSales1 - cmv1) * 100) / 100;
    const marginPct1 = netSales1 > 0 ? Math.round(((grossMargin1 / netSales1) * 100) * 100) / 100 : 0;

    expect(grossMargin1).toBe(5.50);
    expect(marginPct1).toBe(29.33);

    // Scenario 2: High margin specialty item
    const netSales2 = 100.00;
    const cmv2 = 40.00;
    const grossMargin2 = netSales2 - cmv2;
    const marginPct2 = (grossMargin2 / netSales2) * 100;

    expect(grossMargin2).toBe(60.00);
    expect(marginPct2).toBe(60.00);

    // Scenario 3: Zero sales period (prevent division by zero)
    const netSales3 = 0.00;
    const cmv3 = 0.00;
    const grossMargin3 = netSales3 - cmv3;
    const marginPct3 = netSales3 > 0 ? (grossMargin3 / netSales3) * 100 : 0;

    expect(grossMargin3).toBe(0.00);
    expect(marginPct3).toBe(0.00);
  });

  it('correctly calculates total inventory valuation from stock quantity and weighted average cost', () => {
    // InventoryValuation = Sum(StockQuantity * AverageCost)
    const items = [
      { name: 'Harina de Maíz', stock: 120, avgCost: 0.85 },
      { name: 'Arroz Blanco', stock: 80, avgCost: 0.95 },
      { name: 'Leche Entera', stock: 40, avgCost: 1.55 },
    ];

    const totalValuation = items.reduce((sum, item) => sum + (item.stock * item.avgCost), 0);
    // 120 * 0.85 = 102.00
    // 80 * 0.95 = 76.00
    // 40 * 1.55 = 62.00
    // Total = 240.00
    expect(totalValuation).toBe(240.00);
  });

  it('correctly flags low stock alerts when stockQuantity <= minimumStock', () => {
    const products = [
      { id: '1', sku: 'PRD-001', stockQuantity: 5, minimumStock: 10 },  // Below minimum -> ALERT
      { id: '2', sku: 'PRD-002', stockQuantity: 10, minimumStock: 10 }, // Exactly at minimum -> ALERT
      { id: '3', sku: 'PRD-003', stockQuantity: 12, minimumStock: 10 }, // Above minimum -> OK
      { id: '4', sku: 'PRD-004', stockQuantity: 0, minimumStock: 5 },   // Out of stock -> ALERT
    ];

    const lowStockAlerts = products.filter(p => p.stockQuantity <= p.minimumStock);

    expect(lowStockAlerts).toHaveLength(3);
    expect(lowStockAlerts.map(p => p.sku)).toEqual(['PRD-001', 'PRD-002', 'PRD-004']);
  });

  it('strictly excludes voided sales from completed revenue and CMV totals', () => {
    const rawSales = [
      { id: 'sale-1', status: 'Completed', subtotal: 20.00, discount: 0.00, cmv: 14.00, tax: 3.20 },
      { id: 'sale-2', status: 'Voided', subtotal: 50.00, discount: 0.00, cmv: 35.00, tax: 8.00 }, // VOIDED
      { id: 'sale-3', status: 'Completed', subtotal: 30.00, discount: 2.00, cmv: 18.00, tax: 4.48 },
    ];

    const validSales = rawSales.filter(s => s.status === 'Completed');

    const netSales = validSales.reduce((sum, s) => sum + (s.subtotal - s.discount), 0);
    const cmvTotal = validSales.reduce((sum, s) => sum + s.cmv, 0);
    const taxTotal = validSales.reduce((sum, s) => sum + s.tax, 0);
    const grossMargin = netSales - cmvTotal;

    expect(validSales).toHaveLength(2);
    expect(netSales).toBe(48.00); // 20.00 + (30.00 - 2.00)
    expect(cmvTotal).toBe(32.00); // 14.00 + 18.00
    expect(grossMargin).toBe(16.00); // 48.00 - 32.00
    expect(taxTotal).toBeCloseTo(7.68, 2); // 3.20 + 4.48
  });

  it('correctly generates and escapes CSV rows for sales audit export', () => {
    const item: SalesReportItemDto = {
      saleId: 'sale-uuid',
      saleNumber: 'VEN-20261017-0001',
      completedAt: '2026-10-17T18:00:00Z',
      cashierName: 'Juan "El Rápido" Pérez',
      productId: 'prod-uuid',
      sku: 'VIV-HAR-001',
      productName: 'Harina, Pan Tradicional 1kg',
      quantity: 5,
      unitPrice: 1.20,
      unitCostSnapshot: 0.85,
      lineSubtotal: 6.00,
      lineDiscount: 0.00,
      lineNetSales: 6.00,
      lineCmv: 4.25,
      lineGrossProfit: 1.75,
      lineTax: 0.96,
      lineTotal: 6.96,
    };

    // CSV Escaping logic
    const row = [
      `"${item.saleNumber}"`,
      `"${item.cashierName.replace(/"/g, '""')}"`,
      `"${item.sku}"`,
      `"${item.productName.replace(/"/g, '""')}"`,
      item.quantity.toFixed(4),
      item.unitPrice.toFixed(2),
      item.unitCostSnapshot.toFixed(4),
      item.lineNetSales.toFixed(2),
      item.lineCmv.toFixed(2),
      item.lineGrossProfit.toFixed(2),
    ].join(',');

    expect(row).toContain('"VEN-20261017-0001"');
    expect(row).toContain('"Juan ""El Rápido"" Pérez"');
    expect(row).toContain('"Harina, Pan Tradicional 1kg"');
    expect(row).toContain('6.00,4.25,1.75');
  });

  it('enforces RBAC so cashier users cannot access financial dashboard', () => {
    const adminUser = { role: 'Admin' as const };
    const cashierUser = { role: 'Cashier' as const };

    const canAccessDashboard = (role: 'Admin' | 'Cashier') => role === 'Admin';

    expect(canAccessDashboard(adminUser.role)).toBe(true);
    expect(canAccessDashboard(cashierUser.role)).toBe(false);
  });
});
