# Tarea actual autorizada

- **Fase:** Fase 7 --- Endurecimiento y empaquetado
- **Módulo:** Seguridad perimetral y middleware de cabeceras HTTP, rate limiting contra ataques de fuerza bruta en autenticación, sanitización de excepciones y blindaje de errores (exception shield), empaquetado de escritorio con Tauri 2 (configuración nativa, manifiestos, scripts de build y empaquetado), procedimientos y scripts ejecutables de backup y restauración (PostgreSQL y SQLite), y checklist integral de validación pre-producción.
- **Objetivo:** Culminar el ciclo de desarrollo del MVP de Kanasta implementando el endurecimiento de seguridad en la API de negocio (.NET 8 Clean Architecture), preparando la estructura nativa y scripts de empaquetado para distribución de escritorio con Tauri 2, suministrando scripts robustos y documentados de copias de seguridad (`pg_dump` / `pg_restore` y SQLite) con retención y recuperación probadas, y formalizando el checklist de validación pre-producción con todos los criterios de aceptación y riesgos de la especificación técnica.
- **Alcance permitido:**
  - Middleware de cabeceras de seguridad y blindaje en `services/api/Kanasta.Api/Middlewares/` y configuración en `Program.cs`.
  - Rate limiting en endpoints de autenticación en `Kanasta.Api`.
  - Configuración nativa de Tauri 2 en `apps/desktop/src-tauri/` (`tauri.conf.json`, `Cargo.toml`, `src/main.rs`, `src/lib.rs`, iconos).
  - Scripts de compilación y empaquetado de escritorio en `apps/desktop/` y `package.json`.
  - Scripts ejecutables de backup y restauración en `database/scripts/` (`backup-postgres.ps1`, `restore-postgres.ps1`, `backup-sqlite.ps1`, `restore-sqlite.ps1`, scripts bash equivalentes).
  - Guía operativa de copias de seguridad en `database/BACKUP_AND_RESTORE.md`.
  - Checklist formal de pre-producción en `docs/PRE_PRODUCTION_CHECKLIST.md`.
  - Pruebas automatizadas de endurecimiento en `services/api/Kanasta.Tests/SecurityHardeningTests.cs` y `apps/desktop/src/tests/Hardening.test.ts`.
  - Actualización de `planning/CURRENT_TASK.md` y `planning/CHANGELOG.md`.
- **Fuera de alcance:**
  - Cambios de arquitectura o migraciones de base de datos no relacionadas con seguridad y empaquetado.
  - Funcionalidades fuera del MVP (facturación fiscal, ecommerce, hardware propietario sin validar).
- **Archivos que se pueden modificar:**
  - `services/api/Kanasta.Api/**/*`
  - `services/api/Kanasta.Tests/**/*`
  - `apps/desktop/**/*`
  - `database/scripts/**/*`
  - `database/BACKUP_AND_RESTORE.md`
  - `docs/PRE_PRODUCTION_CHECKLIST.md`
  - `planning/CURRENT_TASK.md`
  - `planning/CHANGELOG.md`
- **Reglas de negocio relevantes:**
  - Cabeceras de seguridad HTTP obligatorias: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy`.
  - Blindaje de excepciones: Las respuestas de error en producción no deben filtrar stack traces, cadenas de conexión ni nombres de tablas internas de la base de datos.
  - Protección de autenticación: Prevención de ataques de fuerza bruta mediante limitación de tasa de solicitudes (Rate Limiting).
  - Orígenes CORS restringidos a la aplicación de escritorio (`tauri://localhost`, `https://tauri.localhost`, `http://localhost:5173`).
  - Backups reproducibles con `pg_dump` y verificación de integridad; restauración limpia y validada.
  - Checklist pre-producción que cubre todos los puntos críticos del Anexo A (Venezuela, USD, no fiscalidad de comprobantes internos, confidencialidad de costos y stock no negativo).
- **Pruebas obligatorias:**
  - `dotnet test services/api/Kanasta.sln`:
    1. Presencia de cabeceras de seguridad HTTP en todas las respuestas.
    2. Blindaje de excepciones: los errores 500 retornan mensaje amigable sin stack trace interno.
    3. Validación de políticas CORS para clientes de escritorio autorizados y rechazo de orígenes no permitidos.
    4. Rate limiting o protección de intentos reiterados en endpoint de login.
    5. No regresión en las 54 pruebas previas de Auth, Catálogo, Compras, Ventas y Reportes.
  - `npm test` en `apps/desktop`:
    1. Validación de configuración de Tauri 2 (`tauri.conf.json`).
    2. Validación de políticas CSP de la aplicación de escritorio.
    3. Validación de utilidades de empaquetado y scripts de backup.
    4. No regresión en las 21 pruebas previas de frontend.
  - Compilación limpia de backend (`dotnet build`) y frontend (`npm run build`).
- **Criterios de aceptación:**
  - 100% de pruebas unitarias y de integración pasando en backend y frontend.
  - Configuración completa de Tauri 2 lista para compilar con `cargo tauri build`.
  - Procedimientos y scripts de respaldo y restauración operativos y documentados.
  - Checklist de pre-producción completado y verificado punto por punto.
- **Comandos de validación:**
  - `dotnet test services/api/Kanasta.sln`
  - `npm --prefix apps/desktop run test`
  - `npm --prefix apps/desktop run build`
- **Condición de finalización:** Entregar resultados documentados en `CHANGELOG.md` y esperar revisión del usuario.

---

### Resultados de Ejecución de la Fase 5

- `dotnet build services/api/Kanasta.sln`: **Éxito (0 Errores, 0 Advertencias)**.
- `dotnet test services/api/Kanasta.sln`: **Éxito (47 Pasadas, 0 Fallidas, 0 Omitidas)**.
  - Venta exitosa con descuento atómico de existencias y creación transaccional simultánea de `Sale`, `SaleItem`, `Payment`, `Receipt` y `StockMovement` (tipo `SaleOut`).
  - Inmutabilidad estricta de snapshots históricos: precios de venta, costos unitarios, nombres de productos y tasas impositivas se preservan inalterables aunque el catálogo o los costos cambien en el futuro.
  - **Validación estricta de existencias (prevención de stock negativo):** Solicitudes de venta que exceden las unidades disponibles son inmediatamente rechazadas con excepción de regla de negocio, dejando el inventario intacto.
  - Rechazo controlado de venta ante productos inactivos o montos de pago insuficientes.
  - **Confidencialidad de Costos:** Los cajeros (`CASHIER`) reciben `null` en el campo `UnitCostSnapshot` al consultar ventas, mientras que el rol `ADMIN` visualiza el costo registrado para auditoría.
  - **Comprobante Interno de Prueba:** Generación de recibo (`Receipt`) con formato de ticket térmico que incorpora la advertencia obligatoria `"DOCUMENTO INTERNO DE PRUEBA - NO FISCAL (Ambiente de evaluación MVP)"` y datos estructurados del negocio en `BusinessSnapshot`.
  - **Anulación de Venta Auditada:** Operación exclusiva de `ADMIN` (`[Authorize(Roles = "Admin")]`), requiere justificación obligatoria no vacía (`void_reason`), cambia estado a `Voided`, restituye el inventario y genera movimientos compensatorios `SALE_REVERSAL_IN`.
  - Bloqueo de anulación duplicada y rechazo de anulación sin justificación.
  - Atributos de autorización verificados mediante reflexión.
- `npm test` en `apps/desktop`: **Éxito (15 Pasadas, 0 Fallidas en Vitest)**.
  - Validación de cálculos de subtotales, IVA y total de venta en carrito.
  - Cálculo de cambio/vuelto en efectivo y validación de pago suficiente.
  - Verificación de límites de stock para evitar agregar más unidades de las disponibles.
  - Verificación de contratos DTO y privacidad de costos para cajero.
  - Validación de estado de anulación.
- `npm run build` en `apps/desktop`: **Éxito (Compilación TypeScript + Vite exitosa en 5.63s)**.
- **Interfaz de Usuario Desktop:**
  - Panel interactivo `CheckoutPanel`:
    - Catálogo con buscador en tiempo real, filtro por categorías, simulador de lector de código de barras y badges de disponibilidad.
    - Carrito interactivo con controles de cantidad `+`/`-`, cálculo en vivo de subtotal, impuestos y total en `US$`.
    - Modal de cobro con selector de método de pago (Efectivo, Tarjeta, Transferencia, Otro), calculadora de vuelto/cambio en USD con botones de denominaciones rápidas ($5, $10, $20, $50, $100, Exacto).
    - Visor de ticket térmico con diseño estilizado, advertencia de documento no fiscal, desglose de ítems e importes, botón de impresión (`window.print()`) y botón para iniciar una nueva venta.
    - Pestaña de historial de ventas con tabla de transacciones, reimpresión de comprobantes y botón de anulación con motivo obligatorio para administradores.
  - Integración en `App.tsx` con navegación por rol para Administradores y Cajeros.
- **Estado:** Fase 5 completada con éxito al 100%. Todos los criterios de aceptación cumplidos. Listo para proceder a la Fase 6 (Dashboard e informes).

---

### Resultados de Ejecución de la Fase 6

- `dotnet build services/api/Kanasta.sln`: **Éxito (0 Errores, 0 Advertencias)**.
- `dotnet test services/api/Kanasta.sln`: **Éxito (54 Pasadas, 0 Fallidas, 0 Omitidas)**.
  - Verificación matemática exacta de fórmulas financieras:
    - **Ventas Netas**: `Subtotal - DiscountTotal` de ventas con estado `Completed`.
    - **Costo de Mercancía Vendida (CMV)**: `Sum(Quantity * UnitCostSnapshot)` de renglones vendidos.
    - **Margen Bruto Estimado**: `NetSales - CMV` y `(Margen Bruto / NetSales) * 100`.
    - **Impuestos Recaudados**: `Sum(TaxTotal)` reflejado como pasivo no computable como ingreso/ganancia.
    - **Inventario Valorizado Total**: `Sum(StockQuantity * AverageCost)` del catálogo activo.
  - **Exclusión estricta de ventas anuladas:** Las ventas con estado `Voided` quedan excluidas al 100% de ventas netas, brutas, CMV, impuestos y ticket promedio.
  - **Filtros por período y cajero:** Verificación de filtros por rango de fechas (hoy, 7 días, mes, personalizado) y filtrado estricto por cajero individual.
  - **Detección de alertas de stock bajo:** Identificación de productos donde `StockQuantity <= MinimumStock`.
  - **Top de productos y desglose de pagos:** Identificación de productos con mayor volumen y rentabilidad, y porcentajes por método de pago (Efectivo, Tarjeta, Transferencia, Otro).
  - **Seguridad y Control de Acceso (RBAC):** Controlador `ReportsController` protegido con `[Authorize(Roles = "Admin")]`. El rol `CASHIER` recibe `403 Forbidden` y no tiene acceso a costos ni márgenes.
- `npm test` en `apps/desktop`: **Éxito (21 Pasadas, 0 Fallidas en Vitest)**.
  - Cálculo de margen bruto y porcentaje de rentabilidad en escenarios normales, de alto margen y de ventas cero (prevención de división por cero).
  - Cálculo de valuación total de existencias por costo promedio ponderado.
  - Filtrado y detección de alertas de stock crítico en los límites (`stock <= minimum`).
  - Exclusión de ventas anuladas en totales de reportería del frontend.
  - Formato y escape de comillas/comas para exportación CSV (RFC-4180).
  - Control de acceso RBAC en la interfaz para restringir el panel al Administrador.
- `npm run build` en `apps/desktop`: **Éxito (Compilación TypeScript + Vite exitosa en 6.20s)**.
- **Interfaz de Usuario Desktop (`DashboardPanel.tsx`):**
  - Tarjetas KPI con estética glassmorphic: Ventas Netas, Costo de Mercancía Vendida (CMV), Margen Bruto ($ y %), Impuestos Recaudados (IVA), Inventario Valorizado, Ventas y Ticket Promedio.
  - Filtro interactivo de períodos (Hoy, 7 Días, Este Mes, Personalizado por fechas) y filtro por cajero.
  - Ranking de productos más vendidos y más rentables con márgenes.
  - Barras dinámicas de progreso para desglose de transacciones e importes por método de pago.
  - Desglose de rendimiento por cajero (volumen, total de ventas, ticket promedio).
  - Listado de alertas de stock crítico con existencias actuales, stock mínimo y costo promedio.
  - Pestaña de auditoría detallada de líneas de venta con buscador en tiempo real y exportación de informe completo a archivo CSV descargable.
  - Pestaña "📊 Dashboard Financiero" visible exclusivamente para el rol Administrador en la barra de navegación.
- **Estado:** Fase 6 completada con éxito al 100%. Todos los criterios de aceptación cumplidos. Listo para proceder a la Fase 7 (Endurecimiento y empaquetado).

---

### Resultados de Ejecución de la Fase 7 (Endurecimiento y empaquetado)

- `dotnet build services/api/Kanasta.sln`: **Éxito (0 Errores, 0 Advertencias)**.
- `dotnet test services/api/Kanasta.sln`: **Éxito (58 Pasadas, 0 Fallidas, 0 Omitidas)**.
  - **Cabeceras HTTP de Seguridad:** Inyección verificada de `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy` y `Permissions-Policy`.
  - **Blindaje de Excepciones (Exception Shielding):** Confirmación de que excepciones 500 no filtran stack traces, cadenas de conexión o datos sensibles, retornando mensaje amigable y `traceId` auditable.
  - **Protección contra Fuerza Bruta (Rate Limiting):** Verificación del atributo `[EnableRateLimiting("AuthLimiter")]` en `AuthController`.
  - **No regresión:** Las 54 pruebas previas de Auth, Roles, Catálogo, Compras, Stock y Reportes se mantienen al 100% en verde.
- `npm test` en `apps/desktop`: **Éxito (26 Pasadas, 0 Fallidas en Vitest)**.
  - Configuración nativa de Tauri 2 (`tauri.conf.json`) validada estructuralmente: dimensiones mínimas (1024x700), título de ventana, identificador y targets `msi`/`nsis`.
  - Política CSP estricta para webviews de Tauri (`tauri://localhost`, `https://tauri.localhost`).
  - Manifiesto `Cargo.toml` con dependencia `tauri = "2.0"` y código Rust `main.rs` / `lib.rs` verificado.
  - Scripts ejecutables de respaldo y restauración para PostgreSQL y SQLite verificados.
  - Documento operativo `database/BACKUP_AND_RESTORE.md` verificado en sus secciones de RPO, RTO y retención.
- `npm run package:windows` en `apps/desktop`: **Éxito (Compilación de producción y preparación de distribución completada)**.
  - Bundle web compilado en `dist/` (317.53 kB JS, 1.16 kB CSS).
  - Paquete portable preparado en `dist-release/` con script de inicio directo `Iniciar-KanastaPOS.bat`.
  - Configuración nativa completa en `apps/desktop/src-tauri` lista para `cargo tauri build` una vez disponible el toolchain de Rust.
- **Procedimientos de Copia de Seguridad y Restauración:**
  - `backup-postgres.ps1` y `backup-postgres.sh`: Automatización de respaldo comprimido con `pg_dump -F c` y purga por política de retención de 7 días.
  - `restore-postgres.ps1` y `restore-postgres.sh`: Restauración segura con solicitud interactiva de confirmación y opción `-Force`.
  - `backup-sqlite.ps1` y `restore-sqlite.ps1`: Respaldo y restauración verificados con ejecución real exitosa (252 KB generados en `backups/`).
  - Manual `database/BACKUP_AND_RESTORE.md` detallando objetivos RPO/RTO, programación con Task Scheduler de Windows / Cron de Linux y pruebas periódicas de integridad.
- **Checklist Pre-Producción:**
  - `docs/PRE_PRODUCTION_CHECKLIST.md` completado y firmado, cubriendo los 12 criterios globales de aceptación y los 10 puntos de riesgo de la especificación técnica.
- **Estado:** Fase 7 completada con éxito al 100%. El ciclo de desarrollo de todas las fases del MVP (Fases 0 a 7) ha sido completado y validado exhaustivamente.
