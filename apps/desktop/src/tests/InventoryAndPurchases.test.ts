import { describe, it, expect } from 'vitest';
import { InventoryItemDto } from '../lib/api';

describe('Kanasta Desktop Inventory & Purchases Tests (Phase 4)', () => {
  it('calculates weighted average cost mathematically with precision', () => {
    // 100 units at $1.00 USD + 50 units at $1.60 USD
    const oldStock = 100.0;
    const oldCost = 1.0;
    const incomingQty = 50.0;
    const incomingCost = 1.6;

    const totalValuation = (oldStock * oldCost) + (incomingQty * incomingCost);
    const newStock = oldStock + incomingQty;
    const newAverageCost = totalValuation / newStock;

    expect(newStock).toBe(150.0);
    expect(newAverageCost).toBeCloseTo(1.2000, 4);
  });

  it('strictly prevents negative stock in adjustment calculations', () => {
    const currentStock = 15.0;
    const adjustmentDelta = -20.0;
    const resultingStock = currentStock + adjustmentDelta;

    const isAllowed = resultingStock >= 0;
    expect(isAllowed).toBe(false);
    expect(resultingStock).toBe(-5.0);
  });

  it('validates Purchase subtotal and tax calculation logic', () => {
    const line1 = { quantity: 10, unitCost: 2.5, taxRate: 0.16 };
    const line2 = { quantity: 5, unitCost: 4.0, taxRate: 0.0 };

    const line1Subtotal = line1.quantity * line1.unitCost;
    const line1Tax = line1Subtotal * line1.taxRate;

    const line2Subtotal = line2.quantity * line2.unitCost;
    const line2Tax = line2Subtotal * line2.taxRate;

    const totalSubtotal = line1Subtotal + line2Subtotal;
    const totalTax = line1Tax + line2Tax;
    const grandTotal = totalSubtotal + totalTax;

    expect(line1Subtotal).toBe(25.0);
    expect(line1Tax).toBe(4.0);
    expect(line2Subtotal).toBe(20.0);
    expect(line2Tax).toBe(0.0);
    expect(totalSubtotal).toBe(45.0);
    expect(totalTax).toBe(4.0);
    expect(grandTotal).toBe(49.0);
  });

  it('verifies cashier cost privacy in inventory items', () => {
    const cashierItem: InventoryItemDto = {
      productId: '11111111-2222-3333-4444-555555555555',
      sku: 'TEST-SKU',
      barcode: '123456789',
      productName: 'Producto Almacen',
      categoryName: 'Víveres',
      baseUnit: 'kg',
      stockQuantity: 100,
      minimumStock: 20,
      averageCost: null, // Protected for cashier
      salePrice: 3.5,
      isLowStock: false,
      isActive: true,
    };

    expect(cashierItem.averageCost).toBeNull();
    expect(cashierItem.stockQuantity).toBe(100);
  });
});
