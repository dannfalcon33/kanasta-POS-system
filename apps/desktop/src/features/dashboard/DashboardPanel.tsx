import React, { useState, useEffect, useCallback } from 'react';
import {
  api,
  DashboardSummaryDto,
  SalesReportDto,
  UserDto,
} from '../../lib/api';
import { useLanguage } from '../../lib/i18n/LanguageContext';

interface DashboardPanelProps {
  userRole: 'Admin' | 'Cashier';
}

type PeriodFilter = 'today' | 'last7days' | 'thisMonth' | 'custom';

export const DashboardPanel: React.FC<DashboardPanelProps> = ({ userRole }) => {
  const { t } = useLanguage();
  const isAdmin = userRole === 'Admin';

  const [activeSubTab, setActiveSubTab] = useState<'metrics' | 'salesReport'>('metrics');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('today');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedCashierId, setSelectedCashierId] = useState<string>('');
  const [cashiersList, setCashiersList] = useState<UserDto[]>([]);

  // Dashboard Data State
  const [dashboardData, setDashboardData] = useState<DashboardSummaryDto | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState<boolean>(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // Sales Report Data State
  const [salesReportData, setSalesReportData] = useState<SalesReportDto | null>(null);
  const [salesReportFilterSku, setSalesReportFilterSku] = useState<string>('');
  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Initialize date range based on period filter
  const applyPeriodDates = useCallback((filter: PeriodFilter) => {
    const now = new Date();
    if (filter === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      setStartDate(start.toISOString().slice(0, 10));
      setEndDate(end.toISOString().slice(0, 10));
    } else if (filter === 'last7days') {
      const start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      setStartDate(start.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    } else if (filter === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(start.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    }
  }, []);

  useEffect(() => {
    applyPeriodDates('today');
  }, [applyPeriodDates]);

  // Load Cashiers for dropdown
  useEffect(() => {
    if (!isAdmin) return;
    const fetchUsers = async () => {
      try {
        const users = await api.getUsers();
        setCashiersList(users);
      } catch (e) {
        console.error('Error fetching cashiers list:', e);
      }
    };
    fetchUsers();
  }, [isAdmin]);

  // Load Dashboard Summary
  const loadDashboard = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setLoadingDashboard(true);
      setDashboardError(null);

      const params: { startDate?: string; endDate?: string; cashierId?: string } = {};
      if (startDate) params.startDate = new Date(startDate + 'T00:00:00Z').toISOString();
      if (endDate) params.endDate = new Date(endDate + 'T23:59:59Z').toISOString();
      if (selectedCashierId) params.cashierId = selectedCashierId;

      const data = await api.getDashboardSummary(params);
      setDashboardData(data);
    } catch (err: any) {
      setDashboardError(err.message || 'Error al obtener métricas financieras del dashboard.');
    } finally {
      setLoadingDashboard(false);
    }
  }, [isAdmin, startDate, endDate, selectedCashierId]);

  // Load Sales Report
  const loadSalesReport = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setLoadingReport(true);
      setReportError(null);

      const params: { startDate?: string; endDate?: string; cashierId?: string } = {};
      if (startDate) params.startDate = new Date(startDate + 'T00:00:00Z').toISOString();
      if (endDate) params.endDate = new Date(endDate + 'T23:59:59Z').toISOString();
      if (selectedCashierId) params.cashierId = selectedCashierId;

      const data = await api.getSalesReport(params);
      setSalesReportData(data);
    } catch (err: any) {
      setReportError(err.message || 'Error al obtener informe de ventas.');
    } finally {
      setLoadingReport(false);
    }
  }, [isAdmin, startDate, endDate, selectedCashierId]);

  useEffect(() => {
    if (activeSubTab === 'metrics') {
      loadDashboard();
    } else {
      loadSalesReport();
    }
  }, [activeSubTab, loadDashboard, loadSalesReport]);

  // Export Sales Report to CSV
  const exportToCsv = () => {
    if (!salesReportData || !salesReportData.items || salesReportData.items.length === 0) return;

    const headers = [
      'Fecha Venta',
      'N° Venta',
      'Cajero',
      'SKU',
      'Producto',
      'Cantidad',
      'Precio Venta (USD)',
      'Costo Snapshot (USD)',
      'Subtotal Línea',
      'Descuento Línea',
      'Venta Neta',
      'CMV Línea',
      'Margen Bruto USD',
      'IVA Línea',
      'Total Línea',
    ];

    const rows = salesReportData.items.map((item) => [
      `"${new Date(item.completedAt).toLocaleString()}"`,
      `"${item.saleNumber}"`,
      `"${item.cashierName.replace(/"/g, '""')}"`,
      `"${item.sku}"`,
      `"${item.productName.replace(/"/g, '""')}"`,
      item.quantity.toFixed(4),
      item.unitPrice.toFixed(2),
      item.unitCostSnapshot.toFixed(4),
      item.lineSubtotal.toFixed(2),
      item.lineDiscount.toFixed(2),
      item.lineNetSales.toFixed(2),
      item.lineCmv.toFixed(2),
      item.lineGrossProfit.toFixed(2),
      item.lineTax.toFixed(2),
      item.lineTotal.toFixed(2),
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `kanasta_informe_ventas_${startDate}_al_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isAdmin) {
    return (
      <div
        style={{
          padding: '2.5rem',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-lg)',
          color: '#f87171',
          textAlign: 'center',
          maxWidth: '700px',
          margin: '2rem auto',
        }}
      >
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>🔒 {t.dashboard.restrictedAccess}</h3>
        <p style={{ margin: 0, fontSize: '0.95rem' }}>
          {t.dashboard.restrictedAccessDesc}
        </p>
      </div>
    );
  }

  const formatUsd = (num: number | undefined | null) =>
    num !== undefined && num !== null
      ? `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '$0.00';

  const formatPct = (num: number | undefined | null) =>
    num !== undefined && num !== null ? `${num.toFixed(2)}%` : '0.00%';

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header & Controls */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem 1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              📊 {t.dashboard.title}
            </h2>
            <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {t.dashboard.subtitle}
            </p>
          </div>

          {/* Sub-tab Navigation */}
          <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--bg-primary)', padding: '0.3rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setActiveSubTab('metrics')}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: activeSubTab === 'metrics' ? 'var(--brand-green)' : 'transparent',
                color: activeSubTab === 'metrics' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: activeSubTab === 'metrics' ? 'var(--shadow-sm)' : 'none',
              }}
            >
              📈 {t.dashboard.metricsSubTab}
            </button>
            <button
              onClick={() => setActiveSubTab('salesReport')}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: activeSubTab === 'salesReport' ? 'var(--brand-green)' : 'transparent',
                color: activeSubTab === 'salesReport' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: activeSubTab === 'salesReport' ? 'var(--shadow-sm)' : 'none',
              }}
            >
              📑 {t.dashboard.salesReportSubTab}
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.75rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          {/* Quick period buttons */}
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              onClick={() => {
                setPeriodFilter('today');
                applyPeriodDates('today');
              }}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: periodFilter === 'today' ? 'var(--accent-glow)' : 'transparent',
                color: periodFilter === 'today' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                border: `1px solid ${periodFilter === 'today' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              }}
            >
              {t.dashboard.today}
            </button>
            <button
              onClick={() => {
                setPeriodFilter('last7days');
                applyPeriodDates('last7days');
              }}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: periodFilter === 'last7days' ? 'var(--accent-glow)' : 'transparent',
                color: periodFilter === 'last7days' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                border: `1px solid ${periodFilter === 'last7days' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              }}
            >
              {t.dashboard.last7days}
            </button>
            <button
              onClick={() => {
                setPeriodFilter('thisMonth');
                applyPeriodDates('thisMonth');
              }}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: periodFilter === 'thisMonth' ? 'var(--accent-glow)' : 'transparent',
                color: periodFilter === 'thisMonth' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                border: `1px solid ${periodFilter === 'thisMonth' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              }}
            >
              {t.dashboard.thisMonth}
            </button>
          </div>

          {/* Date Pickers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.dashboard.from}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setPeriodFilter('custom');
                setStartDate(e.target.value);
              }}
              style={{
                padding: '0.35rem 0.6rem',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
              }}
            />
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.dashboard.to}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setPeriodFilter('custom');
                setEndDate(e.target.value);
              }}
              style={{
                padding: '0.35rem 0.6rem',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
              }}
            />
          </div>

          {/* Cashier filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.dashboard.cashier}</label>
            <select
              value={selectedCashierId}
              onChange={(e) => setSelectedCashierId(e.target.value)}
              style={{
                padding: '0.35rem 0.6rem',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
              }}
            >
              <option value="">{t.dashboard.allCashiers}</option>
              {cashiersList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} ({c.role})
                </option>
              ))}
            </select>
          </div>

          {/* Refresh button */}
          <button
            onClick={() => {
              if (activeSubTab === 'metrics') loadDashboard();
              else loadSalesReport();
            }}
            disabled={loadingDashboard || loadingReport}
            style={{
              padding: '0.45rem 1rem',
              backgroundColor: 'var(--brand-green)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: 'var(--shadow-brand)',
            }}
          >
            {loadingDashboard || loadingReport ? `⏳ ${t.dashboard.refreshing}` : `🔄 ${t.dashboard.refresh}`}
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: Metrics & Breakdown */}
      {activeSubTab === 'metrics' && (
        <>
          {dashboardError && (
            <div
              style={{
                padding: '1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: '#f87171',
                fontSize: '0.9rem',
              }}
            >
              ⚠️ {dashboardError}
            </div>
          )}

          {/* KPI Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1rem',
            }}
          >
            {/* Ventas Netas */}
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                💳 {t.dashboard.netSales}
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--brand-green)' }}>
                {formatUsd(dashboardData?.netSales)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {t.dashboard.netSalesDesc}
              </div>
            </div>

            {/* Costo de Mercancía Vendida (CMV) */}
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                📉 {t.dashboard.cogs}
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f59e0b' }}>
                {formatUsd(dashboardData?.costOfGoodsSold)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {t.dashboard.cogsDesc}
              </div>
            </div>

            {/* Margen Bruto */}
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  📈 {t.dashboard.grossMarginEst}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '9999px',
                    fontWeight: 700,
                    backgroundColor:
                      (dashboardData?.grossMarginPercentage ?? 0) >= 20
                        ? 'rgba(34, 197, 94, 0.2)'
                        : (dashboardData?.grossMarginPercentage ?? 0) >= 10
                        ? 'rgba(245, 158, 11, 0.2)'
                        : 'rgba(239, 68, 68, 0.2)',
                    color:
                      (dashboardData?.grossMarginPercentage ?? 0) >= 20
                        ? '#4ade80'
                        : (dashboardData?.grossMarginPercentage ?? 0) >= 10
                        ? '#fbbf24'
                        : '#f87171',
                  }}
                >
                  {formatPct(dashboardData?.grossMarginPercentage)}
                </span>
              </div>
              <div
                style={{
                  fontSize: '1.8rem',
                  fontWeight: 700,
                  color: (dashboardData?.grossMargin ?? 0) >= 0 ? '#4ade80' : '#f87171',
                }}
              >
                {formatUsd(dashboardData?.grossMargin)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {t.dashboard.grossMarginDesc}
              </div>
            </div>

            {/* Impuestos Recaudados */}
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                🏛️ {t.dashboard.taxesCollected}
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#a78bfa' }}>
                {formatUsd(dashboardData?.taxTotal)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {t.dashboard.taxesCollectedDesc}
              </div>
            </div>

            {/* Inventario Valorizado */}
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                📦 {t.dashboard.inventoryValued}
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#e2e8f0' }}>
                {formatUsd(dashboardData?.inventoryValuation)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {t.dashboard.inventoryValuedDesc}
              </div>
            </div>

            {/* Operaciones de Caja */}
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                🧾 {t.dashboard.salesAvgTicket}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {dashboardData?.totalSalesCount ?? 0}
                </span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  ({formatUsd(dashboardData?.averageTicket)} / ticket)
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {dashboardData?.totalVoidedSalesCount ?? 0} {t.dashboard.salesAvgTicketDesc}
              </div>
            </div>
          </div>

          {/* Grids: Top Products & Payment Breakdown */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {/* Top Selling Products */}
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🏆 {t.dashboard.topProductsTitle}
              </h3>

              {(!dashboardData?.topSellingProducts || dashboardData.topSellingProducts.length === 0) ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
                  {t.dashboard.noSalesPeriod}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {dashboardData.topSellingProducts.map((p, idx) => (
                    <div
                      key={p.productId || idx}
                      style={{
                        padding: '0.6rem 0.8rem',
                        backgroundColor: 'var(--bg-primary)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : '#78350f',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {p.productName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            SKU: {p.sku} | {t.dashboard.margin} {formatPct(p.grossMarginPercentage)}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--brand-green)' }}>
                          {formatUsd(p.revenue)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {p.unitsSold.toFixed(2)} {t.dashboard.units}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Methods Breakdown */}
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                💳 {t.dashboard.paymentBreakdown}
              </h3>

              {(!dashboardData?.salesByPaymentMethod || dashboardData.salesByPaymentMethod.length === 0) ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
                  {t.dashboard.noTransactions}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {dashboardData.salesByPaymentMethod.map((pm, idx) => {
                    const methodLabels: Record<string, string> = {
                      Cash: `💵 ${t.dashboard.cashUsd}`,
                      Card: `💳 ${t.dashboard.cardPoint}`,
                      BankTransfer: `🏦 ${t.dashboard.transferPagoMovil}`,
                      Other: `🔄 ${t.dashboard.otherMethod}`,
                    };
                    const label = methodLabels[pm.paymentMethod] || pm.paymentMethod;

                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {formatUsd(pm.totalAmount)}{' '}
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              ({pm.percentage.toFixed(1)}%)
                            </span>
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div
                          style={{
                            width: '100%',
                            height: '8px',
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            borderRadius: '4px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, Math.max(0, pm.percentage))}%`,
                              height: '100%',
                              backgroundColor:
                                pm.paymentMethod === 'Cash'
                                  ? '#22c55e'
                                  : pm.paymentMethod === 'Card'
                                  ? '#3b82f6'
                                  : pm.paymentMethod === 'BankTransfer'
                                  ? '#8b5cf6'
                                  : '#f59e0b',
                              borderRadius: '4px',
                              transition: 'width 0.4s ease-in-out',
                            }}
                          />
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                          {pm.transactionCount} {t.dashboard.transactions}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Grids: Cashier Breakdown & Low Stock Alerts */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {/* Cashier Breakdown */}
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                👤 {t.dashboard.cashierPerformance}
              </h3>

              {(!dashboardData?.salesByCashier || dashboardData.salesByCashier.length === 0) ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
                  {t.dashboard.noCashierActivity}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {dashboardData.salesByCashier.map((cb) => (
                    <div
                      key={cb.cashierId}
                      style={{
                        padding: '0.7rem 0.9rem',
                        backgroundColor: 'var(--bg-primary)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {cb.cashierName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {cb.salesCount} {t.dashboard.registeredSales}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                          {formatUsd(cb.totalSales)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {t.dashboard.average} {formatUsd(cb.averageTicket)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Low Stock Alerts */}
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  ⚠️ {t.dashboard.lowStockAlerts}
                </h3>
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '9999px',
                    fontWeight: 700,
                    backgroundColor:
                      (dashboardData?.lowStockAlertsCount ?? 0) > 0
                        ? 'rgba(239, 68, 68, 0.2)'
                        : 'rgba(34, 197, 94, 0.2)',
                    color: (dashboardData?.lowStockAlertsCount ?? 0) > 0 ? '#f87171' : '#4ade80',
                  }}
                >
                  {dashboardData?.lowStockAlertsCount ?? 0} {t.dashboard.productsCount}
                </span>
              </div>

              {(!dashboardData?.lowStockAlerts || dashboardData.lowStockAlerts.length === 0) ? (
                <div style={{ color: '#4ade80', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
                  ✅ {t.dashboard.allStockGood}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '280px', overflowY: 'auto' }}>
                  {dashboardData.lowStockAlerts.map((item) => (
                    <div
                      key={item.productId}
                      style={{
                        padding: '0.6rem 0.8rem',
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {item.productName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          SKU: {item.sku} | Cat: {item.categoryName}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f87171' }}>
                          {t.dashboard.stock} {item.stockQuantity.toFixed(2)} / {t.dashboard.min} {item.minimumStock.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {t.dashboard.avgCost} {formatUsd(item.averageCost)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* SUB-TAB 2: Itemized Sales Audit Report */}
      {activeSubTab === 'salesReport' && (
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {reportError && (
            <div
              style={{
                padding: '0.8rem 1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: '#f87171',
                fontSize: '0.85rem',
              }}
            >
              ⚠️ {reportError}
            </div>
          )}

          {/* Sub-header with search & CSV export */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="text"
                placeholder={t.dashboard.filterBySku}
                value={salesReportFilterSku}
                onChange={(e) => setSalesReportFilterSku(e.target.value)}
                style={{
                  padding: '0.45rem 0.8rem',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  width: '280px',
                }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {salesReportData?.totalLines ?? 0} {t.dashboard.auditedLines}
              </span>
            </div>

            <button
              onClick={exportToCsv}
              disabled={!salesReportData || !salesReportData.items || salesReportData.items.length === 0}
              style={{
                padding: '0.45rem 1rem',
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              📥 {t.dashboard.exportCsvBtn}
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '0.6rem 0.5rem' }}>{t.dashboard.colDate}</th>
                  <th style={{ padding: '0.6rem 0.5rem' }}>{t.dashboard.colSaleNumber}</th>
                  <th style={{ padding: '0.6rem 0.5rem' }}>{t.dashboard.colCashier}</th>
                  <th style={{ padding: '0.6rem 0.5rem' }}>{t.dashboard.colSku}</th>
                  <th style={{ padding: '0.6rem 0.5rem' }}>{t.dashboard.colProduct}</th>
                  <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{t.dashboard.colQty}</th>
                  <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{t.dashboard.colPrice}</th>
                  <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{t.dashboard.colCostSnapshot}</th>
                  <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{t.dashboard.colNetSale}</th>
                  <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{t.dashboard.colCmv}</th>
                  <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{t.dashboard.colMargin}</th>
                  <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{t.dashboard.colVat}</th>
                  <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{t.dashboard.colTotal}</th>
                </tr>
              </thead>
              <tbody>
                {loadingReport ? (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      {t.dashboard.loadingReportMsg}
                    </td>
                  </tr>
                ) : !salesReportData || salesReportData.items.length === 0 ? (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      {t.dashboard.noReportData}
                    </td>
                  </tr>
                ) : (
                  salesReportData.items
                    .filter(
                      (item) =>
                        !salesReportFilterSku.trim() ||
                        item.sku.toLowerCase().includes(salesReportFilterSku.toLowerCase()) ||
                        item.productName.toLowerCase().includes(salesReportFilterSku.toLowerCase())
                    )
                    .map((item, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
                        }}
                      >
                        <td style={{ padding: '0.55rem 0.5rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(item.completedAt).toLocaleDateString()}{' '}
                          {new Date(item.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '0.55rem 0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {item.saleNumber}
                        </td>
                        <td style={{ padding: '0.55rem 0.5rem', color: 'var(--text-secondary)' }}>
                          {item.cashierName}
                        </td>
                        <td style={{ padding: '0.55rem 0.5rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          {item.sku}
                        </td>
                        <td style={{ padding: '0.55rem 0.5rem', color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.productName}
                        </td>
                        <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                          {item.quantity.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>
                          {formatUsd(item.unitPrice)}
                        </td>
                        <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', color: 'var(--text-muted)' }}>
                          {formatUsd(item.unitCostSnapshot)}
                        </td>
                        <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--brand-green)' }}>
                          {formatUsd(item.lineNetSales)}
                        </td>
                        <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', color: '#f59e0b' }}>
                          {formatUsd(item.lineCmv)}
                        </td>
                        <td
                          style={{
                            padding: '0.55rem 0.5rem',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: item.lineGrossProfit >= 0 ? '#4ade80' : '#f87171',
                          }}
                        >
                          {formatUsd(item.lineGrossProfit)}
                        </td>
                        <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', color: '#a78bfa' }}>
                          {formatUsd(item.lineTax)}
                        </td>
                        <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {formatUsd(item.lineTotal)}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
              {salesReportData && salesReportData.items.length > 0 && (
                <tfoot>
                  <tr
                    style={{
                      borderTop: '2px solid var(--border-color)',
                      fontWeight: 700,
                      backgroundColor: 'var(--bg-tertiary)',
                    }}
                  >
                    <td colSpan={8} style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                      {t.dashboard.auditTotals}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--brand-green)' }}>
                      {formatUsd(salesReportData.totalNetSales)}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: '#f59e0b' }}>
                      {formatUsd(salesReportData.totalCmv)}
                    </td>
                    <td
                      style={{
                        padding: '0.75rem 0.5rem',
                        textAlign: 'right',
                        color: salesReportData.totalGrossProfit >= 0 ? '#4ade80' : '#f87171',
                      }}
                    >
                      {formatUsd(salesReportData.totalGrossProfit)}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: '#a78bfa' }}>
                      {formatUsd(salesReportData.totalTax)}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: 'var(--text-primary)' }}>
                      {formatUsd(salesReportData.totalGrossSales)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
