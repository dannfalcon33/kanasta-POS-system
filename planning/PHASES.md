# Kanasta --- Plan de Desarrollo por Fases

Este documento establece la secuencia estricta de ejecución para el desarrollo de Kanasta. Ninguna fase debe iniciarse sin la autorización explícita del usuario y la finalización exitosa de los criterios de aceptación de la fase anterior.

---

## Resumen del Ciclo de Vida por Fases

| Fase | Título | Objetivo Principal | Entregable Clave |
|---|---|---|---|
| **Fase 0** | Decisiones y cimientos | Inicialización del repositorio, arquitectura documental, configuración de entorno y esqueletos ejecutables. | Proyecto ejecutable vacío, estructura validada y decisiones formalizadas. |
| **Fase 1** | Modelo de dominio y base de datos | Entidades del dominio, restricciones de integridad, migraciones de PostgreSQL y datos de prueba. | Esquema EF Core reproducible, migraciones verificadas y tests de restricciones. |
| **Fase 2** | Autenticación, roles y sesiones | Login/logout seguro, hashing argon2id/bcrypt, autorización en servidor (ADMIN vs CASHIER), auditoría de sesiones. | Endpoints de autenticación probados; cajero denegado en endpoints admin a nivel API. |
| **Fase 3** | Catálogo | Categorías, productos, SKU único, unidades, precio de venta en USD, costo de referencia y tasas fiscales de prueba. | CRUD probado y acceso restringido (solo lectura para cajero). |
| **Fase 4** | Inventario y compras | Proveedores, compras con estado DRAFT/RECEIVED, recepción idempotente, costo promedio ponderado y movimientos de stock. | Pruebas de stock auditado, no duplicidad en recepciones y valoración de existencias. |
| **Fase 5** | Caja y ventas | Pantalla de venta, cálculo server-side, validación estricta de stock sin permitir saldo negativo, confirmación transaccional y comprobante interno. | Pruebas de venta atómica, prevención de sobreventa concurrente y emisión de comprobante de prueba. |
| **Fase 6** | Dashboard e informes | Métricas financieras (ventas netas, CMV, margen bruto estimado, impuestos, inventario valorizado) y reportes auditables. | Indicadores contrastados con datasets de prueba manual y documental. |
| **Fase 7** | Endurecimiento y empaquetado | Seguridad general, empaquetado de escritorio con Tauri 2, backups, restauración y validación de checklist previo a producción. | Release candidate ejecutable y procedimiento de despliegue/restauración probado. |

---

## Detalle de Fases

### Fase 0 --- Decisiones y cimientos (EN CURSO)
- **Alcance:**
  - Estructuración de directorios acordada (`apps/desktop`, `services/api`, `database`, `docs`, `planning`).
  - Formalización de decisiones del Anexo A (Venezuela, moneda USD, comprobantes internos no fiscales, stack cliente-servidor).
  - Archivos `.gitignore` y `.env.example` sin credenciales reales.
  - Esqueleto de solución .NET 8 (Clean Architecture) y frontend React/TypeScript con Vite.
  - Configuración de pipelines de compilación (`dotnet build`) y pruebas unitarias iniciales (`dotnet test`).
- **Criterio de salida:** Proyectos compilan limpiamente, pruebas base pasan al 100%, estructura y decisiones aprobadas por el usuario.

### Fase 1 --- Modelo de dominio y base de datos
- **Alcance:**
  - Configuración de Entity Framework Core con Npgsql (PostgreSQL).
  - Definición de entidades: `users`, `user_sessions`, `categories`, `products`, `tax_rates`, `suppliers`, `purchases`, `purchase_items`, `stock_movements`, `sales`, `sale_items`, `payments`, `receipts`, `audit_logs`, `business_settings`.
  - Configuración de tipos `NUMERIC(14,4)` y `NUMERIC(14,2)` para cantidades e importes monetarios. Claves primarias UUID (`Guid`).
  - Restricciones CHECK (`sale_price >= 0`, `stock_quantity >= 0`, `quantity > 0`).
  - Migraciones reproducibles desde cero y scripts de rollback.
- **Criterio de salida:** Migraciones aplican sin errores en base limpia de desarrollo; pruebas de integración verifican restricciones de base de datos.

### Fase 2 --- Autenticación, roles y sesiones
- **Alcance:**
  - Endpoints `/api/v1/auth/login`, `/api/v1/auth/logout`, `/api/v1/auth/me`.
  - Hash de contraseñas robusto y verificación de usuario activo.
  - Generación y validación de tokens JWT con roles (`ADMIN`, `CASHIER`).
  - Endpoint seguro de inicialización del primer administrador (sin contraseñas por defecto en código).
  - Gestión de usuarios y bloqueo de cuentas (solo ADMIN).
  - Auditoría de sesiones en `user_sessions`.
- **Criterio de salida:** Pruebas automatizadas demuestran que un token de `CASHIER` recibe `403 Forbidden` en endpoints administrativos.

### Fase 3 --- Catálogo
- **Alcance:**
  - Endpoints `/api/v1/categories` y `/api/v1/products`.
  - Campos: SKU único, código de barras opcional, nombre, unidad base, precio venta en USD, costo referencia, tasa fiscal.
  - Validación de campos requeridos y formatos.
  - Regla: CASHIER tiene permiso solo de lectura (`GET`); ADMIN puede crear, editar y desactivar.
- **Criterio de salida:** CRUD probado exhaustivamente, paginación, filtros de búsqueda y cumplimiento estricto de roles.

### Fase 4 --- Inventario y compras
- **Alcance:**
  - Registro de proveedores (`/api/v1/suppliers`).
  - Registro de compras en estado `DRAFT` y confirmación a `RECEIVED` (`/api/v1/purchases`).
  - Idempotencia en la recepción: una compra recibida no puede recibirse nuevamente.
  - Generación de `stock_movements` tipo `PURCHASE_IN`.
  - Recálculo de costo promedio ponderado.
  - Ajustes manuales de inventario con motivo obligatorio (`/api/v1/inventory/adjustments`).
- **Criterio de salida:** Pruebas que validan recálculo de costo, historial de movimientos append-only y rechazo de recepciones repetidas.

### Fase 5 --- Caja y ventas
- **Alcance:**
  - Flujo de venta: creación, validación server-side de precios e impuestos.
  - Bloqueo de concurrencia y validación estricta de stock disponible (prohibido stock negativo).
  - Transacción atómica única: inserción de `sales`, `sale_items` con snapshots de costo y precio, `payments`, `receipts` y `stock_movements` tipo `SALE_OUT`.
  - Emisión de comprobante interno de prueba en USD (etiquetado como documento no fiscal).
- **Criterio de salida:** Pruebas de ventas simultáneas que intentan sobrepasar el stock demuestran que la segunda venta es rechazada transaccionalmente; rollback automático ante fallos en cualquier paso.

### Fase 6 --- Dashboard e informes
- **Alcance:**
  - Consulta de indicadores para rol ADMIN (`/api/v1/reports/dashboard` y `/api/v1/reports/sales`):
    - Ventas netas (sin impuestos).
    - Impuestos recaudados.
    - Costo de mercancía vendida (CMV a partir de los snapshots).
    - Margen bruto estimado (`ventas_netas - CMV`).
    - Inventario valorizado (`stock * costo_unitario`).
    - Alertas de stock bajo.
  - Denegación estricta de acceso al rol CASHIER.
- **Criterio de salida:** Fórmulas financieras documentadas y contrastadas con pruebas contra un dataset de prueba con cálculos manuales verificados.

### Fase 7 --- Endurecimiento y empaquetado
- **Alcance:**
  - Empaquetado de cliente de escritorio Tauri 2 (instaladores Windows `.msi` / `.exe`).
  - Verificación de políticas de seguridad, encabezados HTTP y sanitización de datos.
  - Procedimientos documentados de copias de seguridad de PostgreSQL (`pg_dump`) y restauración (`pg_restore`).
  - Checklist final de validación pre-producción.
- **Criterio de salida:** Instalador de escritorio funcional conectado a la API de negocio y checklist de aceptación firmado.
