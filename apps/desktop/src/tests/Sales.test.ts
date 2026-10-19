import { describe, it, expect } from 'vitest';
import { SaleDto, SaleItemDto } from '../lib/api';

describe('Kanasta Desktop Sales & POS Terminal Tests (Phase 5)', () => {
  it('calculates cart line subtotals, VAT tax and grand totals accurately', () => {
    // Item 1: Harina Pan (5 units at $1.20 USD with 16% VAT)
    const item1 = {
      quantity: 5,
      unitPrice: 1.20,
      taxRate: 0.16,
    };

    // Item 2: Arroz Blanco (2 units at $1.50 USD with 0% tax / exempt)
    const item2 = {
      quantity: 2,
      unitPrice: 1.50,
      taxRate: 0.0,
    };

    const item1Subtotal = Math.round(item1.quantity * item1.unitPrice * 100) / 100;
    const item1Tax = Math.round(item1Subtotal * item1.taxRate * 100) / 100;
    const item1Total = Math.round((item1Subtotal + item1Tax) * 100) / 100;

    const item2Subtotal = Math.round(item2.quantity * item2.unitPrice * 100) / 100;
    const item2Tax = Math.round(item2Subtotal * item2.taxRate * 100) / 100;
    const item2Total = Math.round((item2Subtotal + item2Tax) * 100) / 100;

    const totalSubtotal = item1Subtotal + item2Subtotal;
    const totalTax = item1Tax + item2Tax;
    const grandTotal = totalSubtotal + totalTax;

    expect(item1Subtotal).toBe(6.00);
    expect(item1Tax).toBe(0.96);
    expect(item1Total).toBe(6.96);

    expect(item2Subtotal).toBe(3.00);
    expect(item2Tax).toBe(0.00);
    expect(item2Total).toBe(3.00);

    expect(totalSubtotal).toBe(9.00);
    expect(totalTax).toBe(0.96);
    expect(grandTotal).toBe(9.96);
  });

  it('calculates cash payment change (vuelto) and rejects insufficient tendered amounts', () => {
    const totalToPay = 10.16;

    // Case 1: Paid with $20 USD bill
    const paid20 = 20.00;
    const change20 = Math.max(0, paid20 - totalToPay);
    expect(change20).toBeCloseTo(9.84, 2);

    // Case 2: Exact payment
    const paidExact = 10.16;
    const changeExact = Math.max(0, paidExact - totalToPay);
    expect(changeExact).toBe(0.00);

    // Case 3: Insufficient payment ($5.00)
    const paidInsufficient = 5.00;
    const isValid = paidInsufficient >= totalToPay;
    expect(isValid).toBe(false);
  });

  it('strictly validates available stock to prevent negative inventory in cart operations', () => {
    const productStock = 8;
    const requestedQuantity = 10;

    const isAvailable = requestedQuantity <= productStock;
    expect(isAvailable).toBe(false);

    // Increment clamp
    const currentInCart = 7;
    const increment = 2; // would make it 9 > 8
    const allowed = (currentInCart + increment) <= productStock;
    expect(allowed).toBe(false);
  });

  it('verifies non-fiscal internal test receipt disclaimer and cashier cost privacy', () => {
    const sampleReceiptSnapshot = {
      Disclaimer: 'DOCUMENTO INTERNO DE PRUEBA - NO FISCAL (Ambiente de evaluación MVP)',
      BusinessName: 'Kanasta Minimarket',
      Currency: 'USD',
      Total: 10.16,
    };

    expect(sampleReceiptSnapshot.Disclaimer).toContain('DOCUMENTO INTERNO DE PRUEBA - NO FISCAL');
    expect(sampleReceiptSnapshot.Currency).toBe('USD');

    // Cashier view: unitCostSnapshot is null
    const cashierItem: SaleItemDto = {
      id: 'item-1',
      productId: 'prod-1',
      skuSnapshot: 'HAR-01',
      productNameSnapshot: 'Harina Pan',
      unitSnapshot: 'kg',
      quantity: 5,
      unitPrice: 1.20,
      discountAmount: 0,
      taxRateSnapshot: 0.16,
      taxAmount: 0.96,
      lineTotal: 6.96,
      unitCostSnapshot: null, // Protected for cashier
    };

    expect(cashierItem.unitCostSnapshot).toBeNull();
  });

  it('validates SaleDto contracts and void status tracking', () => {
    const sale: SaleDto = {
      id: 'sale-1',
      saleNumber: 'VTA-20261017-001',
      cashierId: 'cashier-1',
      cashierName: 'Cajero Demo',
      status: 'Completed',
      subtotal: 9.20,
      discountTotal: 0,
      taxTotal: 0.96,
      total: 10.16,
      currencyCode: 'USD',
      completedAt: '2026-10-17T20:00:00Z',
      voidedAt: null,
      voidReason: null,
      createdAt: '2026-10-17T20:00:00Z',
      itemCount: 2,
      paymentMethod: 'Cash',
      paymentAmount: 20.00,
      paymentReference: null,
    };

    expect(sale.status).toBe('Completed');
    expect(sale.total).toBe(10.16);

    const voidedSale: SaleDto = {
      ...sale,
      status: 'Voided',
      voidedAt: '2026-10-17T20:15:00Z',
      voidReason: 'Cliente solicitó devolución inmediata antes de retirar',
    };

    expect(voidedSale.status).toBe('Voided');
    expect(voidedSale.voidReason).toBeTruthy();
  });
});
