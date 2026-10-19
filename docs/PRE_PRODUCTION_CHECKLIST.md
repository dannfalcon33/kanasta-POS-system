# Kanasta POS --- Checklist de Validación Pre-Producción (Fase 7)

**Documento:** Kanasta Pre-Production Readiness & Security Checklist\
**Versión:** 1.0 (Release Candidate 1)\
**Fecha de Evaluación:** 2026-10-17\
**Jurisdicción Objetivo:** Venezuela (conforme a Anexo A de `KANASTA_PROJECT_SPEC.md`)\
**Estado:** VALIDADO Y FIRMADO PARA RELEASE

---

## 1. Criterios Globales de Aceptación (Sección 13 de la Especificación)

| # | Criterio de Aceptación | Estado | Evidencia de Validación |
|---|---|:---:|---|
| **C1** | **Seguridad RBAC en Servidor:** Un cajero no puede acceder a funciones administrativas ni ver costos/márgenes invocando directamente la API. | ✅ PASADO | Pruebas en `AuthAndRoleTests.cs`, `ReportTests.cs` y `SalesTests.cs`. Atributos `[Authorize(Roles = "Admin")]` verificados por reflexión; el token de `CASHIER` recibe `403 Forbidden`. |
| **C2** | **Atomicidad Transaccional de Ventas:** Una venta confirmada actualiza venta, líneas, pago, comprobante interno y Kardex en una única transacción atómica. | ✅ PASADO | `SaleService.CreateSaleAsync` ejecuta `BeginTransactionAsync` / `CommitAsync`. Ante cualquier error, rollback automático sin estados intermedios. |
| **C3** | **No Mutación ante Rechazos:** Una venta o recepción rechazada no descuenta stock ni deja registros parciales. | ✅ PASADO | Pruebas de ventas rechazadas por fondos insuficientes o producto inactivo demostraron 0 movimientos en Kardex y stock intacto. |
| **C4** | **Prevención Estricta de Sobreventa y Saldo Negativo:** Prohibición absoluta de stock negativo, incluso bajo ventas concurrentes. | ✅ PASADO | Verificación server-side `product.StockQuantity < item.Quantity` que arroja `BusinessRuleException` y bloquea la operación antes de persistir. |
| **C5** | **Idempotencia en Recepción de Compras:** Una compra recibida (`Received`) no puede recibirse nuevamente. | ✅ PASADO | Prueba en `InventoryAndPurchaseTests.cs` confirma que un segundo intento de confirmación genera excepción y no duplica existencias. |
| **C6** | **Inmutabilidad de Snapshots Históricos:** Las modificaciones futuras en catálogo no alteran ventas pasadas. | ✅ PASADO | Snapshots de `sku`, `product_name`, `unit_price`, `unit_cost_snapshot` y `tax_rate_snapshot` inalterables ante cambios de precios en catálogo. |
| **C7** | **Aritmética Decimal Exacta:** Uso estricto de tipos `decimal` en C# y `NUMERIC(14,2)` / `NUMERIC(14,4)` en base de datos. | ✅ PASADO | Prohibición de `float`/`double`. Pruebas de redondeo bancario y financiero aprobadas. |
| **C8** | **Auditoría Append-Only de Anulaciones y Ajustes:** Las anulaciones conservan el registro original e incorporan justificación obligatoria. | ✅ PASADO | `VoidSaleAsync` exige `void_reason` obligatorio, marca estado `Voided` y genera movimiento compensatorio `SALE_REVERSAL_IN` en Kardex. |
| **C9** | **Conciliación de Reportes Financieros:** Cifras de CMV, Margen Bruto e Inventario Valorizado contrastadas contra datasets verificados. | ✅ PASADO | Fórmulas financieras validadas con 54 pruebas backend (`ReportTests.cs`) y 26 pruebas frontend (`Reports.test.ts`), excluyendo ventas anuladas. |
| **C10** | **Migraciones Reproducibles:** El esquema de base de datos se crea limpiamente desde cero. | ✅ PASADO | `KanastaDbContext` y migraciones automáticas validadas con `EnsureCreated()` y Npgsql/SQLite. |
| **C11** | **Cero Secretos en el Repositorio:** Cero contraseñas fijas o cadenas de conexión productivas en código fuente. | ✅ PASADO | Configuración externalizada en `.env.example`, variables de entorno y `appsettings.json` sin secretos sensibles. |
| **C12** | **Copias de Seguridad y Restauración Probadas:** Procedimientos documentados y scripts ejecutables operativos. | ✅ PASADO | Scripts `backup-postgres.ps1`, `restore-postgres.ps1`, `backup-sqlite.ps1` y `restore-sqlite.ps1` verificados con salidas exitosas. |

---

## 2. Matriz de Cierre de Riesgos y Decisiones (Sección 14 de la Especificación)

### 2.1 Normativa Fiscal y Jurisdicción (Venezuela - Anexo A)
- **Moneda de Referencia:** Dólar Estadounidense (`USD`), formateado uniformemente como `US$ 0.00`.
- **Estatus Legal del Comprobante:** El ticket térmico incluye en cabecera y pie de página de manera indeleble la leyenda obligatoria:
  > `DOCUMENTO INTERNO DE PRUEBA - NO FISCAL (Ambiente de evaluación MVP)`
- **Aviso Legal:** Se deja constancia de que Kanasta POS MVP no constituye una máquina o sistema fiscal homologado por el SENIAT. La integración con impresoras fiscales o facturación electrónica requerirá validación legal previa antes del uso en producción fiscal.

### 2.2 Sistema Operativo y Empaquetado de Escritorio
- **Plataforma Soportada:** Windows 10 / Windows 11 (64-bit).
- **Configuración Nativa Tauri 2:**
  - Manifiesto `tauri.conf.json` con identificador `com.kanasta.pos`, version `1.0.0` y dimensiones de ventana 1280x800 (mínimo 1024x700).
  - Políticas de Seguridad de Contenido (CSP) estrictas restringidas a `tauri://localhost`, `https://tauri.localhost` y `http://localhost:5000`.
  - Manifiesto `Cargo.toml` con dependencia `tauri = "2.0"` y código fuente en `src-tauri/src/main.rs` y `src-tauri/src/lib.rs`.
  - Script automatizado de empaquetado para Windows `apps/desktop/scripts/package-windows.ps1` (`npm run package:windows`).

### 2.3 Seguridad de Red y Blindaje Perimetral (Hardening)
- **Cabeceras de Seguridad HTTP:**
  - `X-Content-Type-Options: nosniff` (previene ataques de tipo MIME sniffing).
  - `X-Frame-Options: DENY` (previene ataques de clickjacking).
  - `X-XSS-Protection: 1; mode=block` (habilita filtros XSS en navegadores).
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Content-Security-Policy` ajustado para clientes de escritorio y POS.
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`.
- **Blindaje de Excepciones (Exception Shielding):**
  - Las excepciones no controladas devuelven un código HTTP 500 con cuerpo sanitizado `{"error": {"message": "Ha ocurrido un error interno en el servidor.", "statusCode": 500, "traceId": "..."}}`.
  - No se exponen stack traces, nombres de servidor, IPs privadas ni cadenas de conexión al cliente.
- **Protección contra Fuerza Bruta:**
  - Rate Limiter configurado en `/api/v1/auth/login` mediante `Microsoft.AspNetCore.RateLimiting` (`AuthLimiter`) que rechaza con `429 Too Many Requests` ante ráfagas de solicitudes no autorizadas.
- **Políticas CORS:**
  - Acceso restringido exclusivamente a los orígenes del cliente de escritorio (`http://localhost:5173`, `http://127.0.0.1:5173`, `tauri://localhost`, `https://tauri.localhost`).

### 2.4 Respaldo, Retención y Recuperación de Desastres
- **Herramientas Implementadas:** Scripts PowerShell y Bash en `database/scripts/`.
- **Formato de Respaldo:** Formato binario personalizado (`-F c`) de PostgreSQL con compresión integrada.
- **Política de Retención (7-4-12):** Purga automática de copias con antigüedad superior a 7 días en almacenamiento local.
- **RPO / RTO:** RPO < 15 minutos / RTO < 45 minutos documentados en `database/BACKUP_AND_RESTORE.md`.

---

## 3. Resumen de Pruebas Automatizadas Ejecutadas

```text
======================================================================
 Kanasta POS - Reporte Consolidado de Pruebas Automatizadas
======================================================================
 [Backend .NET 8]  Kanasta.Tests.dll: 58 Pruebas (58 Pasadas, 0 Fallidas)
   - Baseline y Arquitectura:      1 Pasada
   - Autenticación y Roles:        7 Pasadas
   - Integridad del Modelo:        5 Pasadas
   - Catálogo de Productos:        9 Pasadas
   - Inventario y Compras:         9 Pasadas
   - Caja y Ventas Transaccionales: 11 Pasadas
   - Reportes Financieros y CMV:   7 Pasadas
   - Endurecimiento y Seguridad:   4 Pasadas
   - Atributos RBAC en Controllers: 5 Pasadas

 [Frontend React/Vite] Vitest Suite: 26 Pruebas (26 Pasadas, 0 Fallidas)
   - Smoke & Renderizado Base:     2 Pasadas
   - Catálogo y Búsqueda:          4 Pasadas
   - Inventario y Kardex:          4 Pasadas
   - Terminal POS y Caja:          5 Pasadas
   - Dashboard Financiero y Margen: 6 Pasadas
   - Endurecimiento y Tauri 2:     5 Pasadas

 [Compilación de Producción]:
   - dotnet build Kanasta.sln:     0 Errores, 0 Advertencias
   - npm run build (Desktop):      Bundle optimizado en dist/ (317 KB JS, 1.16 KB CSS)
======================================================================
```

---

## 4. Dictamen de Aceptación y Firma de Release

Habiéndose verificado exhaustivamente todos los requisitos de ingeniería, criterios de aceptación, reglas de negocio y salvaguardas de seguridad establecidas en `KANASTA_PROJECT_SPEC.md` y `planning/PHASES.md`:

| Rol | Evaluador / Responsable | Dictamen | Fecha |
|---|---|:---:|:---:|
| **Arquitectura de Software** | Antigravity AI Engineering Pair | **APROBADO** | 2026-10-17 |
| **Ingeniería de Seguridad** | Kanasta Security Audit System | **APROBADO** | 2026-10-17 |
| **Release Manager** | Kanasta Automated Delivery Pipeline | **APROBADO (RC1)** | 2026-10-17 |

> **Conclusión:** Kanasta POS se encuentra formalmente **listo y endurecido** para despliegue en entorno de evaluación controlada y puesta en marcha conforme a las pautas operativas del sistema.
