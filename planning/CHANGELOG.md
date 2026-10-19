# Kanasta --- Historial de Cambios (Changelog)

Todas las modificaciones notables a este proyecto serán documentadas en este archivo según el avance por fases.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Fase 7: Endurecimiento y empaquetado] - 2026-10-17

### Añadido
- **Endurecimiento de Seguridad en `Kanasta.Api`:**
  - `SecurityHeadersMiddleware`:
    - `X-Content-Type-Options: nosniff`: Prevención de detección y suplantación de tipos MIME.
    - `X-Frame-Options: DENY`: Mitigación integral contra ataques de clickjacking.
    - `X-XSS-Protection: 1; mode=block`: Activación de filtros XSS en navegadores web y webviews.
    - `Referrer-Policy: strict-origin-when-cross-origin`: Protección de información de origen en peticiones salientes.
    - `Content-Security-Policy`: Política adaptada para el cliente de escritorio y POS, autorizando conexiones seguras a `localhost` y webviews de Tauri (`tauri://localhost`, `https://tauri.localhost`).
    - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`: Restricción estricta de APIs de hardware sensibles.
  - **Blindaje de Excepciones (Exception Shielding):**
    - `ExceptionHandlingMiddleware` enriquecido con `traceId` único (`context.TraceIdentifier`) para auditoría y correlación en logs de servidor, garantizando que ninguna excepción interna (errores de base de datos, fallas de conexión o stack traces) sea expuesta al cliente.
  - **Protección contra Fuerza Bruta (Rate Limiting):**
    - Configuración de `Microsoft.AspNetCore.RateLimiting` en `Program.cs` con política `AuthLimiter` (15 peticiones por ventana de 30 segundos) aplicada en `AuthController` con `[EnableRateLimiting("AuthLimiter")]`.
  - **Ampliación de Orígenes CORS Autorizados:**
    - Adición de `https://tauri.localhost` y `tauri://localhost` para compatibilidad completa con el protocolo seguro de Tauri 2 en Windows 10/11.
- **Empaquetado Nativo de Escritorio con Tauri 2 en `apps/desktop`:**
  - `src-tauri/tauri.conf.json`: Configuración nativa completa con identificador `com.kanasta.pos`, version `1.0.0`, dimensiones de ventana ajustadas a terminal POS (1280x800, mínimo 1024x700, centrada y redimensionable), CSP estricto y objetivos de empaquetado para Windows (`msi` y `nsis`).
  - `src-tauri/Cargo.toml`: Manifiesto de dependencias nativas con `tauri = "2.0"`, `tauri-build = "2.0"` y plugins oficiales.
  - `src-tauri/src/main.rs`: Punto de entrada nativo de Windows configurado con `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` para omitir la ventana negra de consola en ejecuciones de producción.
  - `src-tauri/src/lib.rs`: Inicializador nativo de la ventana de escritorio.
  - `src-tauri/icons/icon.svg`: Icono vectorial moderno de alta resolución para la aplicación de escritorio.
  - `scripts/package-windows.ps1`: Script PowerShell de automatización de compilación y empaquetado para Windows, que verifica el toolchain de Rust/Cargo, compila los activos de producción (`npm run build`) y genera tanto el paquete nativo como una distribución portable de contingencia en `dist-release/` con launcher `Iniciar-KanastaPOS.bat`.
  - Scripts en `package.json`: `"tauri": "tauri"`, `"tauri:dev": "tauri dev"`, `"tauri:build": "tauri build"`, `"package:windows": "powershell -ExecutionPolicy Bypass -File ./scripts/package-windows.ps1"`.
- **Copias de Seguridad y Restauración en `database/`:**
  - `database/scripts/backup-postgres.ps1` y `backup-postgres.sh`: Automatización de respaldos con `pg_dump -F c`, validación de integridad y purga automática por política de retención (7 días).
  - `database/scripts/restore-postgres.ps1` y `restore-postgres.sh`: Restauración interactiva con solicitud obligatoria de confirmación (`SI`) y flag `-Force` para pipelines desatendidos.
  - `database/scripts/backup-sqlite.ps1` y `restore-sqlite.ps1`: Respaldo y restauración consistentes para despliegues locales de estación única con preservación de WAL y SHM.
  - `database/BACKUP_AND_RESTORE.md`: Manual operativo con política de retención (7-4-12), RPO (< 15 min), RTO (< 45 min), programación con Task Scheduler de Windows y crontab de Linux, y protocolo de verificación periódica de integridad.
- **Checklist Final Pre-Producción en `docs/`:**
  - `docs/PRE_PRODUCTION_CHECKLIST.md`: Matriz de cumplimiento exhaustiva de los 12 criterios globales de aceptación (Sección 13) y los 10 puntos de riesgo pre-producción (Sección 14 de `KANASTA_PROJECT_SPEC.md`), incluyendo declaración no fiscal de comprobantes de prueba para Venezuela (Anexo A), confirmación de moneda USD, stock no negativo, y firma de aprobación para release.
- **Pruebas Automatizadas:**
  - 4 nuevas pruebas en `services/api/Kanasta.Tests/SecurityHardeningTests.cs`:
    - Verificación de cabeceras HTTP de seguridad (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Content-Security-Policy`, `Permissions-Policy`).
    - Blindaje de excepciones: verificación de que errores 500 no expongan stack traces, contraseñas o detalles internos de la base de datos, retornando mensaje seguro y `traceId`.
    - Retorno de código de error correcto para excepciones de negocio (`BusinessRuleException` -> 400).
    - Presencia del atributo `[EnableRateLimiting("AuthLimiter")]` en `AuthController`.
  - 5 nuevas pruebas en `apps/desktop/src/tests/Hardening.test.ts`:
    - Validación estructural y de seguridad de `tauri.conf.json` (identificador, ventana mínima, CSP seguro, targets msi/nsis).
    - Validación de manifiesto `Cargo.toml` con versión de Tauri 2.0.
    - Validación de puntos de entrada `main.rs` (sin consola de comandos) y `lib.rs`.
    - Validación de scripts ejecutables de respaldo y restauración para PostgreSQL y SQLite.
    - Validación de documentación operativa en `BACKUP_AND_RESTORE.md`.
  - Suite consolidada global: **58 pruebas backend en verde + 26 pruebas frontend en verde (100% éxito)**.

---

## [Fase 6: Dashboard de informes financieros y ganancias] - 2026-10-17

### Añadido
- **Módulo de Reportes Financieros en `Kanasta.Application`:**
  - `ReportDtos`: `DashboardSummaryDto`, `TopProductDto`, `PaymentMethodBreakdownDto`, `CashierBreakdownDto`, `DailySalesDto`, `LowStockAlertDto`, `SalesReportDto`, `SalesReportItemDto`, `DashboardQueryParams` y `SalesReportQueryParams`.
  - Abstracción de servicio `IReportService` con métodos `GetDashboardSummaryAsync` y `GetSalesReportAsync`.
- **Implementación de Fórmulas y Servicios en `Kanasta.Infrastructure`:**
  - `ReportService`:
    - **Ventas Netas Consolidadas:** Suma de `(Quantity * UnitPrice) - DiscountAmount` de ventas completadas, excluyendo impuestos y ventas anuladas.
    - **Costo de Mercancía Vendida (CMV):** Suma exacta de `Quantity * UnitCostSnapshot` extraído de los snapshots inmutables guardados en el momento de la venta.
    - **Margen Bruto Estimado:** `NetSales - CMV` en USD y porcentual `(Margen Bruto / NetSales) * 100`, con protección contra división por cero en períodos sin ventas.
    - **Impuestos Recaudados (IVA):** `Sum(TaxTotal)` presentado explícitamente como pasivo fiscal y desglosado fuera del ingreso/ganancia neta.
    - **Inventario Valorizado Global:** `Sum(StockQuantity * AverageCost)` computado sobre el catálogo activo de productos.
    - **Alertas de Stock Bajo:** Detección automática de productos en condición crítica (`StockQuantity <= MinimumStock`), con desglose de existencia actual, umbral de reposición y valor monetario inmovilizado.
    - **Exclusión Estricta de Ventas Anuladas:** Filtro `s.Status == SaleStatus.Completed` aplicado en todas las consultas de ingresos, costos y métricas promedio.
    - **Desglose Multidimensional:** Agrupación de ventas por método de pago (Efectivo, Tarjeta, Transferencia, Otro), ranking de productos por volumen y por margen de contribución, y métricas de desempeño por cajero.
    - **Auditoría Detallada de Líneas de Venta:** Detalle renglón por renglón con fecha, número de venta, cajero, SKU, producto, precio de venta, costo histórico snapshot, venta neta, CMV y utilidad bruta generada por renglón.
- **Controlador y API REST en `Kanasta.Api`:**
  - `ReportsController` (`/api/v1/reports`):
    - `GET /api/v1/reports/dashboard`: Retorna el consolidado de métricas y gráficos para el período solicitado.
    - `GET /api/v1/reports/sales`: Retorna el informe detallado de líneas vendidas para auditoría y conciliación contable.
    - **Seguridad Estricta Basada en Roles (RBAC):** Decorado con `[Authorize(Roles = "Admin")]`. Cualquier solicitud proveniente de un token con rol `CASHIER` es rechazada con `403 Forbidden` a nivel de pipeline de autorización.
  - Registro de inyección de dependencias en `Program.cs` (`AddScoped<IReportService, ReportService>()`).
- **Interfaz de Usuario Desktop en `apps/desktop`:**
  - `DashboardPanel` (`features/dashboard/DashboardPanel.tsx`):
    - Tarjetas KPI con estética glassmorphic: Ventas Netas, CMV Histórico, Margen Bruto ($ y %), IVA Recaudado, Inventario Valorizado, y Tickets & Promedios.
    - Filtro de períodos dinámico con botones rápidos ("Hoy", "7 Días", "Este Mes", "Personalizado") y selectores de fecha (`input type="date"`).
    - Selector desplegable de cajero para aislar métricas de rendimiento por usuario.
    - Ranking visual de Top Productos Más Vendidos con ingresos y margen.
    - Desglose por Método de Pago con barras de progreso porcentuales animadas.
    - Tarjeta de rendimiento individual por cajero (total transacciones, facturación y ticket promedio).
    - Tarjeta de alerta de productos con stock bajo o agotado.
    - Pestaña de Auditoría Detallada con tabla exhaustiva de líneas de venta y botón de **Exportación a CSV** (con formato estándar RFC-4180 y soporte para caracteres especiales).
  - Pestaña `"📊 Dashboard Financiero"` añadida en la barra de navegación de `App.tsx`, visible exclusivamente para usuarios con rol `Admin`.
  - Métodos `getDashboardSummary` y `getSalesReport` añadidos en `lib/api.ts`.
- **Pruebas Automatizadas:**
  - 7 nuevas pruebas en `Kanasta.Tests/ReportTests.cs`:
    - Verificación de fórmulas exactas de Ventas Netas, Brutas, CMV, Margen Bruto e Impuestos para escenario base.
    - Exclusión estricta de ventas anuladas (`Voided`) de métricas financieras.
    - Valuación precisa de inventario activo y detección de alertas de stock bajo.
    - Filtros por rango de fechas (hora inicio a hora fin).
    - Filtros por cajero específico.
    - Cálculo de top de productos más vendidos y desglose por método de pago.
    - Comprobación de atributo `[Authorize(Roles = "Admin")]` en `ReportsController`.
  - 6 nuevas pruebas en `apps/desktop/src/tests/Reports.test.ts`:
    - Fórmulas de margen bruto y porcentaje en escenarios normales, de alto margen y de ventas cero.
    - Valuación de inventario ponderado.
    - Detección de umbrales de stock bajo.
    - Exclusión de ventas anuladas en acumuladores.
    - Generación y escape de filas CSV para exportación contable.
    - Control de acceso RBAC en la UI.
  - Suite global: 54 pruebas backend en verde + 21 pruebas frontend en verde.

---

## [Fase 5: Caja y ventas] - 2026-10-17

### Añadido
- **Módulo de Caja y Ventas en `Kanasta.Application`:**
  - `SaleDtos`: `SaleDto`, `SaleItemDto`, `PaymentDto`, `ReceiptDto`, `SaleDetailDto`, `CreateSaleRequest`, `CreateSaleItemRequest`, `VoidSaleRequest`, `SaleQueryParams`.
  - Soporte para confidencialidad de costos: `UnitCostSnapshot` enmascarado como `null` para cajeros y visible para administradores.
  - Interfaz de abstracción `ISaleService` con métodos de creación atómica de venta, consulta de historial con filtros, detalle y anulación justificada.
- **Implementación de Servicios en `Kanasta.Infrastructure`:**
  - `SaleService`:
    - **Transacción Atómica Única:** Registra venta, líneas, pago, comprobante y movimientos de stock en una sola transacción (`BeginTransactionAsync` / `CommitAsync`) con rollback garantizado ante cualquier falla.
    - **Validación Estricta de Existencias (Anti-Stock Negativo):** Verifica en el servidor las unidades disponibles; si la cantidad solicitada excede el stock actual, la operación es rechazada con `BusinessRuleException` y no se altera el inventario.
    - **Inmutabilidad de Snapshots Históricos:** Captura en cada renglón `sku_snapshot`, `product_name_snapshot`, `unit_snapshot`, `unit_price`, `unit_cost_snapshot`, `tax_rate_snapshot`, `tax_amount` y `line_total`. Futuras modificaciones de precios, costos o tasas en el catálogo no alteran las ventas históricas.
    - **Descuento de Stock y Kardex:** Emisión de movimientos auditados `SALE_OUT` con decremento negativo (`quantity_delta = -quantity`), cantidad resultante y referencia a la venta.
    - **Comprobante Interno de Prueba:** Generación de recibo (`Receipt`) con DocumentType `INTERNAL_TEST_RECEIPT`, numeración única `REC-YYYYMMDD-XXXX` y estructura JSON en `BusinessSnapshot` conteniendo la advertencia visible: `"DOCUMENTO INTERNO DE PRUEBA - NO FISCAL (Ambiente de evaluación MVP)"`.
    - **Anulación de Venta Auditada (`VoidSaleAsync`):** Exclusiva para administradores, exige motivo obligatorio no vacío (`void_reason`), cambia estado a `Voided`, restaura las unidades al stock del producto y genera movimientos compensatorios en Kardex de tipo `SALE_REVERSAL_IN`.
    - **Control de Acceso por Rol en Consultas:** Los cajeros solo pueden consultar sus propias ventas del turno; los administradores pueden consultar todas las ventas.
- **Controlador y API REST en `Kanasta.Api`:**
  - `SalesController` (`/api/v1/sales`):
    - `POST /api/v1/sales`: Registro de ventas con cálculo server-side y respuesta `201 Created`.
    - `GET /api/v1/sales`: Consulta paginada con filtros por fecha, cajero y estado.
    - `GET /api/v1/sales/{id}`: Detalle de venta con enmascaramiento de costos para cajero.
    - `POST /api/v1/sales/{id}/void`: Anulación con motivo protegido con `[Authorize(Roles = "Admin")]`.
  - Inyección de dependencias registrada en `Program.cs` (`AddScoped<ISaleService, SaleService>()`).
- **Interfaz de Usuario Desktop en `apps/desktop`:**
  - `CheckoutPanel` (`features/checkout/CheckoutPanel.tsx`):
    - Terminal de caja POS con diseño responsivo y tema oscuro moderno.
    - Buscador en tiempo real por nombre, SKU o código de barras, con selector de categorías y botón simulador de escáner óptico.
    - Catálogo visual de productos con badges de disponibilidad (verde: stock abundante, amarillo: stock mínimo, rojo: agotado con bloqueo de adición).
    - Carrito interactivo con incremento/decremento `+`/`-`, validación en vivo para no superar el stock disponible y cálculo instantáneo de subtotal, IVA y total en `US$`.
    - Modal de cobro con selector de método de pago (Efectivo, Tarjeta, Transferencia, Otro), botones de denominaciones rápidas en USD ($5, $10, $20, $50, $100, Exacto) y cálculo en tiempo real de vuelto/cambio.
    - Modal visor de comprobante con diseño de ticket térmico, advertencia destacada de no fiscalidad, desglose completo de productos, impuestos y pago, botón para imprimir ticket (`window.print()`) y botón para iniciar nueva venta.
    - Pestaña de historial de ventas con tabla de transacciones, reimpresión de tickets y modal de anulación para administradores con justificación obligatoria.
  - Cliente de API actualizado en `lib/api.ts` con todos los contratos de ventas.
  - Integración en `App.tsx` con acceso para Administradores y Cajeros.
- **Pruebas Automatizadas:**
  - 11 nuevas pruebas unitarias e integración en `Kanasta.Tests/SalesTests.cs`: Creación exitosa de venta, inmutabilidad de snapshots, rechazo por stock insuficiente (prevención de stock negativo), rechazo por producto inactivo, rechazo por pago insuficiente, confidencialidad de costos para cajero vs administrador, comprobante interno con advertencia no fiscal, anulación por admin con restauración de existencias y movimiento `SALE_REVERSAL_IN`, rechazo de anulación sin motivo o duplicada, y verificación de atributos de autorización.
  - 5 nuevas pruebas unitarias en `apps/desktop/src/tests/Sales.test.ts`: Validación de cálculos de subtotales, impuestos, total, cambio en efectivo, validación estricta de stock disponible, verificación de disclaimer no fiscal y contratos DTO.
  - Suite global: 47 pruebas backend en verde + 15 pruebas frontend en verde.

---

## [Fase 4: Inventario y compras] - 2026-10-17

### Añadido
- **Módulo de Proveedores y Compras en `Kanasta.Application`:**
  - `SupplierDtos`: `SupplierDto`, `CreateSupplierRequest`, `UpdateSupplierRequest`, `SupplierQueryParams` y validaciones de datos obligatorios.
  - `PurchaseDtos`: `PurchaseDto`, `PurchaseItemDto`, `CreatePurchaseRequest`, `CreatePurchaseItemRequest`, `PurchaseQueryParams` y paginación `PagedResult<PurchaseDto>`.
  - `InventoryDtos`: `InventoryItemDto` (con soporte para enmascaramiento de costos a roles no autorizados), `StockMovementDto`, `ManualStockAdjustmentRequest`, `InventoryQueryParams`, `StockMovementQueryParams`.
  - Interfaces de servicio: `ISupplierService`, `IPurchaseService` e `IInventoryService`.
- **Implementación de Servicios en `Kanasta.Infrastructure`:**
  - `SupplierService`: Alta, modificación y listado de proveedores con validación de nombre único y auditoría.
  - `PurchaseService`:
    - Registro de compras en estado inicial `Draft`, validando proveedor activo y productos existentes sin alterar existencias ni costos.
    - **Recepción Idempotente y Transaccional (`ReceivePurchaseAsync`):** Verifica que la compra esté en estado `Draft`; cualquier intento de recibir una orden previamente procesada o cancelada es rechazado con `BusinessRuleException`.
    - **Recálculo de Costo Promedio Ponderado en USD:** Aplica rigurosamente la fórmula `((StockAnterior * CostoAnterior) + (Q_comprada * CostoUnitarioCompra)) / (StockAnterior + Q_comprada)` si el inventario previo es positivo; si no, adopta el costo unitario de compra.
    - **Movimientos de Stock:** Generación de movimientos auditables `PURCHASE_IN` de tipo append-only con trazabilidad de usuario, referencia de compra, costo unitario y existencias resultantes.
  - `InventoryService`:
    - Consulta de existencias con filtros por categoría, búsqueda por SKU/código y filtro de alerta de stock mínimo (`is_low_stock`).
    - **Protección de Costos para Cajeros:** Enmascaramiento dinámico a `null` del campo `AverageCost` para usuarios sin rol `Admin`.
    - Historial de movimientos de Kardex con filtrado por producto y tipo de movimiento (`PURCHASE_IN`, `MANUAL_IN`, `MANUAL_OUT`, etc.).
    - **Ajustes Manuales de Inventario:** Exige justificación no vacía (`reason`) y **previene estrictamente existencias negativas** (`resultingStock < 0` arroja `BusinessRuleException`).
- **Controladores y API REST en `Kanasta.Api`:**
  - `SuppliersController` (`/api/v1/suppliers`): Endpoints CRUD protegidos con `[Authorize(Roles = "Admin")]`.
  - `PurchasesController` (`/api/v1/purchases`): Endpoints de creación, listado, detalle y recepción protegidos con `[Authorize(Roles = "Admin")]`.
  - `InventoryController` (`/api/v1/inventory`):
    - `GET /api/v1/inventory`: Consulta pública para usuarios autenticados con protección y enmascaramiento de costos según rol.
    - `GET /api/v1/inventory/movements`: Historial de Kardex protegido para administradores.
    - `POST /api/v1/inventory/adjustments`: Ajustes manuales justificados protegidos para administradores.
- **Interfaz de Usuario Desktop en `apps/desktop`:**
  - `PurchasesPanel`:
    - Dashboard de gestión de compras con KPIs (Total de compras, órdenes en borrador, recibidas e importe total en USD).
    - Modal de creación de orden de compra con desglose dinámico de renglones, cálculo en vivo de subtotales, impuestos y totales.
    - Modal de confirmación de recepción física de mercancía para procesar la entrada a inventario de forma idempotente y segura.
    - Modal detallado de inspección de compras (renglones, costos, impuestos y fecha de recepción).
    - Gestión integrada de proveedores (alta y edición en modal dedicado).
  - `InventoryPanel`:
    - Monitor de existencias con alertas visuales de stock bajo, filtros por estado y categoría.
    - Modal de ajustes manuales de inventario (Entrada/Salida) con validación obligatoria de motivo y cálculo previo del saldo resultante.
    - Pestaña de Kardex / Movimientos con detalle de cada transacción, delta, saldo resultante, usuario responsable y tipo de movimiento.
  - Actualización de navegación por rol en `App.tsx`: Pestañas contextuales (`Compras y Proveedores`, `Inventario y Kardex` para Administrador; `Existencias de Almacén` para Cajero).
- **Pruebas Automatizadas:**
  - 11 nuevas pruebas exhaustivas en `Kanasta.Tests/InventoryAndPurchaseTests.cs`: Creación de proveedores, creación de compra en Draft, recepción física con incremento de stock, recálculo de costo promedio ponderado, rechazo idempotente de recepción duplicada, movimientos de inventario, ajustes manuales con prevención de stock negativo, obligatoriedad de justificación y restricciones de rol (`Admin` vs `Cashier`).
  - 4 nuevas pruebas en `apps/desktop/src/tests/InventoryAndPurchases.test.ts`: Validación matemática de costo promedio, cálculo de subtotales e impuestos, prevención de stock negativo y privacidad de costos en DTO de inventario.
  - Suite global: 36 pruebas backend en verde + 10 pruebas frontend en verde.

---

## [Fase 3: Catálogo] - 2026-10-17

### Añadido
- **Módulo de Catálogo y Categorías en `Kanasta.Application`:**
  - `CategoryDtos`: `CategoryDto` (con conteo dinámico de productos activos), `CreateCategoryRequest`, `UpdateCategoryRequest`, `UpdateCategoryStatusRequest`.
  - `ProductDtos`: `ProductDto` (con soporte para enmascaramiento de costos según rol), `CreateProductRequest`, `UpdateProductRequest`, `UpdateProductStatusRequest`, `ProductQueryParams` (búsqueda por nombre, SKU o código de barras, categoría, estado y paginación).
  - `TaxRateDtos`: `TaxRateDto` para tasas impositivas configurables del sistema.
  - `PagedResult<T>`: Contenedor genérico para paginación controlada con `TotalPages`, `HasNextPage` y `HasPreviousPage`.
  - Interfaces de abstracción `ICategoryService`, `IProductService` e `ITaxRateService`.
- **Implementación de Servicios en `Kanasta.Infrastructure`:**
  - `CategoryService`: Validación de nombres únicos (case-insensitive), persistencia, conteo de productos asociados y toggle de estado activo/inactivo.
  - `ProductService`:
    - Validación rigurosa de SKU único obligatorio, código de barras único opcional, nombre, unidad base y precios/costos no negativos (`>= 0`).
    - Validación de categoría y tasa impositiva existentes.
    - **Protección estricta de costos:** Si el solicitante no es `Admin` (por ejemplo, rol `Cashier`), el campo `AverageCost` se enmascara automáticamente como `null`, impidiendo la divulgación de costos de adquisición según la especificación del proyecto.
    - Búsqueda multi-criterio por SKU, nombre y código de barras con paginación (`Skip`/`Take`).
    - Métodos directos de búsqueda por código de barras (`GetProductByBarcodeAsync`) y SKU (`GetProductBySkuAsync`) para terminales de caja y lectores ópticos.
  - `TaxRateService`: Consulta de tasas impositivas activas para asignación de productos.
- **Controladores y API REST en `Kanasta.Api`:**
  - `CategoriesController` (`/api/v1/categories`):
    - `GET /api/v1/categories` y `GET /api/v1/categories/{id}` permitidos para usuarios autenticados (`Cashier` y `Admin`).
    - `POST`, `PUT` y `PATCH .../status` protegidos con `[Authorize(Roles = "Admin")]`.
  - `ProductsController` (`/api/v1/products`):
    - `GET /api/v1/products`, `GET /api/v1/products/{id}`, `GET /api/v1/products/by-barcode/{barcode}`, `GET /api/v1/products/by-sku/{sku}` con verificación automática de rol: oculta costos a `Cashier` y los revela a `Admin`.
    - `POST /api/v1/products`, `PUT /api/v1/products/{id}`, `PATCH /api/v1/products/{id}/status` protegidos con `[Authorize(Roles = "Admin")]`. El rol `CASHIER` recibe `403 Forbidden`.
  - `TaxRatesController` (`/api/v1/tax-rates`): Consulta de catálogo impositivo.
- **Interfaz de Usuario en `apps/desktop`:**
  - Cliente de API actualizado en `lib/api.ts` con todos los contratos de categorías, productos y tasas fiscales.
  - `ProductsCatalogPanel`: Panel interactivo con estadísticas KPI (total de productos, categorías activas, alertas de stock bajo), selector de categorías, selector de estado, buscador en tiempo real y tabla densa moderna con badges de estado, stock y tasa fiscal.
  - `CategoriesModal`: Modal para creación, edición y activación/desactivación de categorías.
  - `ProductFormModal`: Modal completo de creación y edición con validación de SKU, código de barras, unidad de medida (unidad, kg, g, litro, etc.), precios en USD, costos e impuestos.
  - Simulador de lector óptico de código de barras/SKU integrado en la cabecera del catálogo para verificación inmediata en bodega o caja.
  - Sistema de pestañas en `App.tsx` adaptado dinámicamente por rol:
    - `Admin`: Pestaña "Catálogo de Productos" con control total CRUD + Pestaña "Gestión de Usuarios".
    - `Cashier`: Pestaña "Catálogo de Productos" (Modo Consulta con costos protegidos) + Pestaña "Terminal de Caja".
- **Pruebas Automatizadas:**
  - 11 nuevas pruebas exhaustivas en `Kanasta.Tests/CatalogTests.cs`: Creación y unicidad de categorías, creación de producto, SKU/código duplicado, rechazo de precios negativos, búsqueda y paginación, confidencialidad de costos para Cashier (`AverageCost == null`), visualización de costos para Admin, y atributos de autorización `[Authorize(Roles = "Admin")]`. Suite backend: 25 pruebas en verde (0 fallos, 0 advertencias).
  - 4 nuevas pruebas en `apps/desktop/src/tests/Catalog.test.ts`: Verificación de contratos DTO, enmascaramiento de costos, cálculo de margen bruto y alertas de stock mínimo. Suite frontend: 6 pruebas en verde (0 fallos).

---

## [Fase 2: Autenticación, Roles y Sesiones] - 2026-10-17

### Añadido
- **Servicios de Seguridad y Criptografía:**
  - `BcryptPasswordHasher` en `Kanasta.Infrastructure.Services` implementando `IPasswordHasher` con factor de trabajo 11.
  - `JwtTokenService` en `Kanasta.Infrastructure.Services` implementando `ITokenService` con firma simétrica HMAC-SHA256, expiración configurable y claims de usuario/rol.
  - `AuthService` en `Kanasta.Infrastructure.Services` con:
    - `SetupInitialAdminAsync`: Endpoint seguro para crear el primer administrador maestro cuando la base de datos está vacía, bloqueando llamadas posteriores.
    - `LoginAsync`: Validación de credenciales, bloqueo de usuarios inactivos y registro de auditoría de intentos exitosos y fallidos en `user_sessions`.
    - `LogoutAsync`: Cierre ordenado de sesiones activas.
    - `GetCurrentUserAsync`: Consulta de perfil para usuario autenticado.
- **Gestión Administrativa de Usuarios (`UserAdminService`):**
  - Alta de usuarios cajeros (`Cashier`) y administradores (`Admin`).
  - Activación y desactivación inmediata de cuentas (`PATCH /api/v1/users/{id}/status`).
  - Consulta de historial de sesiones y motivos de fallo (`GET /api/v1/users/{id}/sessions`).
- **Controladores y API REST (`Kanasta.Api`):**
  - `AuthController`: Endpoints `/api/v1/auth/status`, `/setup-admin`, `/login`, `/logout`, `/me`.
  - `UsersController`: Protegido con `[Authorize(Roles = "Admin")]`. El rol `CASHIER` recibe `403 Forbidden` al invocarlo.
  - `ExceptionHandlingMiddleware`: Respuestas uniformes JSON para errores controlados (`400`, `401`, `403`, `404`, `409`).
  - Swagger UI configurado con autenticación interactiva JWT Bearer en `/swagger`.
  - Habilitado CORS para comunicación fluida con la aplicación de escritorio (`http://localhost:5173`).
- **Ejecución Local Resiliente:**
  - Configurado arranque en `Program.cs` con modo Auto para desarrollo: conecta a PostgreSQL si está activo en puerto 5432, o activa fallback automático local SQLite/semilla inicial para permitir ejecución local inmediata sin configuración adicional.
- **Interfaz de Usuario de Escritorio (`apps/desktop`):**
  - Cliente API con inyección automática de tokens JWT en `src/lib/api.ts`.
  - Pantalla interactiva `AuthScreen.tsx` con detección automática de estado inicial (Setup de Admin vs Login).
  - Panel administrativo `UsersPanel.tsx` para listar usuarios, crear cajeros, cambiar estados y auditar sesiones.
  - App shell completa con badge de rol, estado de usuario y logout.
- **Pruebas Automatizadas:**
  - 6 nuevas pruebas en `AuthAndRoleTests.cs`: Setup de primer admin, login válido, login con contraseña inválida (sesión fallida registrada), bloqueo de usuario inactivo, token de Cashier con denegación a admin endpoints, y logout con actualización de `ended_at`. Suite total: 14 pruebas pasando al 100%.

---

## [Fase 1: Modelo de Dominio y Base de Datos] - 2026-10-17


### Añadido
- **Entidades de Dominio en `Kanasta.Domain`:**
  - `BusinessSettings`: Configuración regional (`currency_code = 'USD'`, `timezone = 'America/Caracas'`, `prices_include_tax = false`).
  - `User`, `UserSession`, `UserRole` (`Admin`, `Cashier`).
  - `Category`, `Product`, `TaxRate`: Con soporte para unidades base, SKU único, código de barras opcional, precios y costos de referencia en USD.
  - `Supplier`, `Purchase`, `PurchaseItem`, `PurchaseStatus` (`Draft`, `Received`, `Cancelled`).
  - `StockMovement`, `StockMovementType` (`PurchaseIn`, `SaleOut`, `SaleReversalIn`, `ManualIn`, `ManualOut`).
  - `Sale`, `SaleItem`, `SaleStatus` (`Draft`, `Completed`, `Voided`, `PartiallyRefunded`, `Refunded`).
  - `Payment`, `PaymentMethod` (`Cash`, `Card`, `BankTransfer`, `Other`).
  - `Receipt`: Con relación 1-a-1 con `Sale`, número único de documento y snapshot del negocio.
  - `AuditLog`: Registro append-only con actor, acción, entidad y metadata.
- **Acceso a Datos y Esquema en `Kanasta.Infrastructure`:**
  - `KanastaDbContext` configurado con Npgsql y convención `snake_case`.
  - 15 clases de configuración Fluent API (`IEntityTypeConfiguration<T>`) con:
    - Precisión decimal estricta (`14,2` para dinero, `14,4` para cantidades y costos, `7,4` para tasas impositivas).
    - Claves primarias UUID (`Guid`).
    - Restricciones CHECK (`sale_price >= 0`, `stock_quantity >= 0`, `quantity > 0`, `unit_cost >= 0`, `amount > 0`, `rate >= 0`).
    - Índices únicos en `users.email`, `products.sku`, `products.barcode`, `sales.sale_number`, `purchases.purchase_number`, `receipts.document_number`, `categories.name`.
    - Índices de rendimiento en `sales.completed_at`, `sales.cashier_id`, `stock_movements.(product_id, created_at)` y `audit_logs.created_at`.
- **Versionado y Migraciones:**
  - Herramienta local `dotnet-ef` instalada en `.config/dotnet-tools.json`.
  - Migración inicial de EF Core generada: `Persistence/Migrations/20261017174106_InitialSchema.cs`.
  - Script SQL de migración idempotente generado en `database/migrations/01_initial_schema.sql`.
- **Datos Semilla de Desarrollo:**
  - `DatabaseSeeder.cs` en `Kanasta.Infrastructure.Persistence.Seed` con catálogo ficticio ilustrativo.
  - Script SQL `database/seed/01_development_seed.sql` para inicialización de desarrollo.
- **Pruebas Automatizadas de Modelo:**
  - `ModelIntegrityTests.cs` en `Kanasta.Tests`: 8 pruebas ejecutadas y aprobadas (verificación de 15 entidades, precisión decimal, relaciones foráneas, constraints e inicialización de seed data).

---

## [Fase 0: Decisiones y Cimientos] - 2026-10-17


### Añadido
- **Estructura de Directorios del Proyecto:**
  - `apps/desktop/`: Aplicación de escritorio con React + TypeScript y Vite, estructurada para integración con Tauri 2.
  - `services/api/`: Solución .NET 8 con Clean Architecture (`Kanasta.Domain`, `Kanasta.Application`, `Kanasta.Infrastructure`, `Kanasta.Api`, `Kanasta.Tests`).
  - `database/`: Carpetas `migrations/` y `seed/` para versionado de base de datos.
  - `docs/engineering/`: Especificaciones técnicas (`KANASTA_PROJECT_SPEC.md`, `ARCHITECTURE.md`, `DECISIONS.md`).
  - `planning/`: Control de fases (`PHASES.md`), tarea actual (`CURRENT_TASK.md`) e historial (`CHANGELOG.md`).
- **Configuración de Entorno y Seguridad:**
  - `.gitignore` robusto cubriendo .NET, React, Tauri, Node y archivos de secretos.
  - `.env.example` documentando variables de conexión a PostgreSQL, JWT, puertos y configuración regional sin valores sensibles.
- **Documentación de Decisiones (Anexo A):**
  - Formalización de Venezuela como jurisdicción del MVP y USD como moneda comercial de referencia (`US$ 12.50`).
  - Formalización de comprobantes internos de prueba sin validez fiscal legal asumida.
  - Requisitos fiscales venezolanos etiquetados como pendientes de validación profesional antes de producción.
  - Confirmación de arquitectura cliente-servidor para soporte multi-caja.
- **Validación Técnica:**
  - Solución .NET 8 compilable (`dotnet build`).
  - Suite de pruebas xUnit base ejecutable (`dotnet test`).
  - Esqueleto modular de frontend con scripts de compilación y verificación.
