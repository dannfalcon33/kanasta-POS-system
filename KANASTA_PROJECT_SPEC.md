# Kanasta --- Especificación de ingeniería del producto

**Versión:** 1.0\
**Fecha:** 2026-10-17\
**Estado:** Documento base para implementación controlada por fases\
**Producto:** Kanasta --- gestión de inventario, caja y ventas para
abastos y supermercados pequeños y medianos

------------------------------------------------------------------------

## 1. Propósito del documento

Este documento define el alcance funcional, la arquitectura, los
módulos, los flujos principales, el modelo de datos, las reglas de
negocio y los criterios de aceptación de Kanasta. Debe ser la fuente de
verdad para los agentes de desarrollo (Cursor y Antigravity).

Los agentes deben implementar **solo la fase y el módulo autorizados**
en `planning/CURRENT_TASK.md`. No deben cambiar arquitectura, esquema de
base de datos ni reglas de negocio sin aprobación explícita.

## 2. Visión y objetivos

Kanasta es una aplicación de escritorio para que un negocio pueda:

-   Administrar productos, categorías, proveedores y existencias.
-   Registrar compras y reabastecimientos, incluyendo costo de compra y
    cantidades.
-   Vender productos desde una pantalla de caja, calcular impuestos
    configurables y emitir facturas/recibos.
-   Registrar método de pago y mantener un historial auditable de
    ventas.
-   Consultar inventario valorizado, ingresos por ventas, costo de
    mercancía vendida y margen bruto estimado.
-   Administrar usuarios con roles `ADMIN` y `CASHIER`.
-   Consultar sesiones de acceso y actividad de caja por empleado.
-   Mantener trazabilidad de cambios importantes y movimientos de stock.

### 2.1 Fuera del alcance inicial (MVP)

No implementar en el MVP, salvo autorización posterior:

-   Contabilidad legal completa, nómina, gestión fiscal avanzada o
    declaraciones tributarias.
-   Comercio electrónico, aplicación móvil, fidelización, delivery o
    múltiples sucursales.
-   Integración con hardware fiscal, impresoras específicas, lectores o
    balanzas sin definir antes los dispositivos objetivo.
-   Sincronización cloud/offline avanzada.
-   Compras automáticas a proveedores.
-   Cambios retroactivos de facturas contabilizadas.

**Importante:** las obligaciones fiscales, numeración de facturas, tasas
de IVA, redondeo y datos obligatorios dependen del país. Deben
configurarse y validarse con un asesor local antes de utilizar Kanasta
en producción. No asumir una tasa fiscal fija.

## 3. Recomendación tecnológica

### 3.1 Stack propuesto

  -----------------------------------------------------------------------
  Capa                    Tecnología recomendada  Motivo
  ----------------------- ----------------------- -----------------------
  Aplicación de           **Tauri 2**             Instalador de
  escritorio                                      escritorio ligero y
                                                  buena integración con
                                                  el sistema operativo.

  Interfaz                **React + TypeScript**  Ecosistema amplio,
                                                  componentes
                                                  reutilizables y tipado
                                                  estático.

  UI y formularios        CSS/Tailwind opcional + Permite construir
                          biblioteca accesible    pantallas consistentes;
                          elegida al iniciar      elegir una sola
                                                  solución y
                                                  documentarla.

  API de negocio          **ASP.NET Core Web API  Validación
                          con C#**                centralizada,
                                                  seguridad,
                                                  transacciones y buen
                                                  soporte para
                                                  aplicaciones de
                                                  negocio.

  Base de datos           **PostgreSQL**          Adecuada para varios
                                                  terminales de caja
                                                  concurrentes,
                                                  integridad referencial
                                                  y transacciones.

  Acceso a datos          Entity Framework Core + Esquema versionado y
                          migraciones             acceso tipado.

  Pruebas                 xUnit para backend;     Pruebas unitarias, de
                          Vitest/Testing Library  interfaz e integración.
                          para frontend;          
                          Playwright para flujos  
                          E2E                     

  Diagramas               Mermaid dentro de       Diagramas versionables
                          Markdown                junto al código.

  Control de versiones    Git                     Historial, revisión y
                                                  cambios controlados.
  -----------------------------------------------------------------------

### 3.2 Arquitectura de despliegue

Para un negocio con más de una caja, no ejecutar una base de datos
independiente por terminal. Los clientes de escritorio deben conectarse
a una API de negocio que controle las transacciones contra una base de
datos central accesible en la red local o en un servidor autorizado.

``` text
┌──────────────────────┐      ┌──────────────────────┐
│ Kanasta Desktop Caja │      │ Kanasta Desktop Admin│
│ Tauri + React + TS   │      │ Tauri + React + TS   │
└──────────┬───────────┘      └──────────┬───────────┘
           └──────────────┬──────────────┘
                          │ HTTPS / red segura
                ┌─────────▼─────────┐
                │ ASP.NET Core API │
                │ reglas y permisos│
                └─────────┬─────────┘
                          │
                ┌─────────▼─────────┐
                │    PostgreSQL     │
                └───────────────────┘
```

La API y PostgreSQL pueden instalarse en un equipo servidor dentro del
negocio o en una infraestructura gestionada. La decisión final depende
de conectividad, presupuesto y requisitos de operación. El MVP requiere
conexión con el servidor para completar ventas; el modo sin conexión se
considera una fase posterior porque sincronizar ventas e inventario
offline requiere resolver conflictos y duplicados.

**Alternativa simplificada:** si se confirma que Kanasta funcionará
exclusivamente en un solo ordenador y nunca habrá varias cajas
concurrentes, podría evaluarse SQLite. No usar SQLite local por terminal
si se requiere inventario compartido en tiempo real entre cajas.

### 3.3 Principios de arquitectura

-   **Monolito modular:** una API desplegable, organizada en módulos de
    dominio; no microservicios en el MVP.
-   La interfaz nunca decide por sí sola el precio final, impuestos,
    permisos o stock disponible: la API valida y calcula.
-   Todas las operaciones monetarias usan `decimal`/`numeric`, nunca
    `float`/`double` para importes.
-   Guardar fechas en UTC y mostrar la zona horaria local configurada.
-   Las operaciones de venta y movimientos de inventario deben ser
    transaccionales.
-   Los datos de negocio se validan en el servidor, incluso si ya se
    validaron en la interfaz.
-   No borrar físicamente ventas, facturas ni movimientos confirmados;
    corregir mediante anulación o movimientos compensatorios auditables.
-   Separar el costo de adquisición del precio de venta.
-   Evitar almacenar datos de tarjeta. El MVP registra el método de pago
    y, cuando corresponda, una referencia externa no sensible.

## 4. Roles y permisos

### ADMIN

-   Gestionar usuarios y desactivar cuentas.
-   Crear y editar productos, categorías y proveedores.
-   Registrar recepciones de mercancía y costos de compra.
-   Ver y ajustar inventario con motivo y auditoría.
-   Ver dashboards financieros e informes.
-   Consultar ventas, facturas, sesiones de usuario y actividad de caja.
-   Configurar impuestos, moneda, datos del negocio y numeración de
    documentos dentro de los límites legales definidos.
-   Anular ventas solo mediante el flujo autorizado y con motivo.

### CASHIER

-   Iniciar y cerrar sesión.
-   Consultar productos disponibles y precio de venta.
-   Crear una venta, modificar cantidades antes de confirmarla y
    seleccionar método de pago.
-   Confirmar venta y emitir/imprimir el comprobante disponible.
-   Consultar únicamente las ventas permitidas por la política del
    negocio; por defecto, sus propias ventas del turno.
-   No puede administrar usuarios, cambiar precios/costos, registrar
    compras, ajustar stock ni acceder a costos, ganancias o dashboard
    financiero.

**Regla de seguridad:** ocultar botones no es autorización suficiente.
La API debe comprobar el rol y el permiso en cada endpoint.

## 5. Módulos funcionales

1.  **Autenticación y sesiones:** login, logout, bloqueo/desactivación,
    registro de inicio/fin de sesión.
2.  **Usuarios y permisos:** creación de usuarios de caja, roles, estado
    y revocación de acceso.
3.  **Catálogo:** productos, categorías, SKU/código de barras opcional,
    unidad de medida, precios y estado.
4.  **Proveedores:** datos básicos de mayoristas y proveedores.
5.  **Compras y recepción:** registrar proveedor, fecha, productos,
    cantidades y costos; generar movimientos de entrada.
6.  **Inventario:** existencias por producto, historial de movimientos,
    ajustes justificados y alertas de stock bajo.
7.  **Caja y ventas:** carrito, validación de stock, cálculo de
    impuestos, método de pago, confirmación y comprobante.
8.  **Facturación/comprobantes:** numeración controlada, datos del
    negocio, desglose de importes y estado del documento; adaptar a
    normativa local.
9.  **Dashboard e informes:** ventas brutas, impuestos recaudados,
    devoluciones/anulaciones, costo de mercancía vendida, margen bruto
    estimado, stock valorizado y reposiciones.
10. **Auditoría:** registro de eventos sensibles, actor, fecha, entidad
    afectada y motivo.
11. **Configuración:** moneda, zona horaria, reglas de impuesto y
    parámetros del negocio.

## 6. Reglas de negocio esenciales

### 6.1 Producto y unidades

Cada producto tiene una unidad de medida definida: unidad, kg, g, litro,
ml, paquete, etc. Las cantidades deben respetar la precisión permitida
por esa unidad. Por ejemplo, vender arroz por peso requiere cantidades
decimales en kg; vender botellas puede exigir cantidades enteras.

Campos esenciales de producto: - SKU interno único. - Nombre y
categoría. - Unidad de medida. - Precio de venta unitario. - Costo
unitario de referencia (solo ADMIN). - Tasa/regla de impuesto
aplicable. - Existencia mínima opcional. - Estado activo/inactivo.

No mezclar unidades incompatibles. Si se compran 100 kg de arroz, la
existencia debe almacenarse en una unidad base consistente (por ejemplo,
kg).

### 6.2 Costo y rentabilidad

Mantener separados: - **Costo de compra:** lo que el negocio paga al
proveedor. - **Precio de venta:** lo que paga el cliente. - **Valor de
inventario:** suma del valor de costo de las existencias. - **Ingresos
por ventas:** suma de ventas confirmadas, distinguiendo impuestos y
devoluciones. - **Margen bruto:** ventas netas sin impuestos indirectos
menos costo de mercancía vendida.

Fórmulas conceptuales: -
`valor_inventario = cantidad_disponible × costo_unitario_valorado` -
`margen_unitario_estimado = precio_venta_sin_impuesto − costo_unitario_valorado` -
`margen_bruto = ventas_netas_sin_impuestos − costo_mercancia_vendida` -
`margen_porcentual = margen_bruto / ventas_netas_sin_impuestos × 100`,
solo si las ventas netas son mayores que cero.

El MVP debe usar un método de valoración de inventario consistente.
**Recomendación: costo promedio ponderado**, calculado al recibir
compras. Registrar el costo aplicado a cada línea de venta para que el
historial no cambie si luego cambia el costo promedio. El método debe
ser aprobado antes de implementar el módulo de compras.

Ejemplo ilustrativo: comprar 100 kg a 1,20 por kg genera un costo de
120. Si se venden 10 kg a 1,80 por kg antes de impuestos, los ingresos
netos son 18 y el costo de venta es 12; el margen bruto estimado es 6.
Los impuestos cobrados no son ganancia.

### 6.3 Venta y stock

-   Una venta confirmada, sus líneas, sus pagos, la factura/comprobante
    y los movimientos de stock se guardan en una única transacción.
-   No permitir stock negativo en el MVP.
-   La API vuelve a comprobar stock al confirmar; no confiar en el stock
    que muestra la pantalla.
-   Una venta pendiente no modifica el stock definitivo. Al confirmar,
    reduce la existencia.
-   Si falla cualquier paso de confirmación, no debe quedar una venta
    parcialmente registrada.
-   Guardar en cada línea el nombre/SKU, cantidad, precio unitario,
    descuento autorizado, impuesto, costo unitario aplicado y totales
    históricos necesarios para reproducir la factura.
-   El precio y el impuesto históricos de una venta no se modifican al
    editar el catálogo.
-   Métodos de pago iniciales configurables: efectivo, tarjeta,
    transferencia y otros. Permitir pagos divididos queda fuera del MVP
    salvo autorización.
-   Devoluciones y anulaciones deben registrar usuario, fecha, motivo y
    movimientos compensatorios; no borrar la venta original.

### 6.4 Impuestos y redondeo

-   No codificar una tasa fija de IVA.
-   Configurar tasas y reglas por producto o categoría conforme a la
    jurisdicción.
-   Definir con asesoría local si el precio se introduce con impuesto
    incluido o excluido.
-   Definir precisión monetaria y regla de redondeo antes de las pruebas
    fiscales.
-   El documento de venta debe mostrar subtotal, descuentos, base
    imponible, impuesto y total según la normativa aplicable.

### 6.5 Sesiones y auditoría

-   Registrar inicio y cierre de sesión, usuario, resultado de
    autenticación, fecha UTC y, si aplica, terminal.
-   No registrar contraseñas ni tokens en logs.
-   Registrar cambios de precio, ajustes de inventario, cambios de
    permisos, compras, anulaciones y configuración fiscal.
-   Una sesión interrumpida puede quedar abierta; mostrarla como sesión
    sin cierre y permitir una política administrativa auditada, sin
    inventar la hora de cierre.

## 7. Modelo de datos propuesto

Usar PostgreSQL. Nombres de tablas en `snake_case`; claves primarias
UUID. Cantidades y dinero se almacenan con precisión decimal. El esquema
final se crea mediante migraciones versionadas.

### 7.1 Entidades y campos principales

#### `business_settings`

Configuración del negocio. - `id` UUID PK - `business_name`
VARCHAR(160) - `tax_identifier` VARCHAR(80), nullable - `address` TEXT,
nullable - `phone` VARCHAR(40), nullable - `currency_code` CHAR(3) -
`timezone` VARCHAR(80) - `prices_include_tax` BOOLEAN - `created_at`,
`updated_at` TIMESTAMPTZ

El MVP soporta un negocio por instalación. Varias sucursales requieren
una extensión explícita del modelo.

#### `users`

-   `id` UUID PK
-   `email` CITEXT UNIQUE NOT NULL
-   `password_hash` TEXT NOT NULL
-   `full_name` VARCHAR(160)
-   `role` ENUM lógico: `ADMIN`, `CASHIER`
-   `is_active` BOOLEAN NOT NULL DEFAULT TRUE
-   `created_at`, `updated_at`, `last_login_at` TIMESTAMPTZ

Nunca almacenar contraseñas en texto plano. Usar un algoritmo de hashing
de contraseñas moderno y mantenido, con parámetros seguros.

#### `user_sessions`

-   `id` UUID PK
-   `user_id` UUID FK → `users.id`
-   `terminal_name` VARCHAR(120), nullable
-   `started_at` TIMESTAMPTZ NOT NULL
-   `ended_at` TIMESTAMPTZ, nullable
-   `login_success` BOOLEAN NOT NULL
-   `failure_reason_code` VARCHAR(60), nullable
-   `created_at` TIMESTAMPTZ

No guardar contraseñas ni tokens de sesión en esta tabla.

#### `categories`

-   `id` UUID PK
-   `name` VARCHAR(120) UNIQUE NOT NULL
-   `description` TEXT, nullable
-   `is_active` BOOLEAN DEFAULT TRUE
-   `created_at`, `updated_at` TIMESTAMPTZ

#### `products`

-   `id` UUID PK
-   `sku` VARCHAR(80) UNIQUE NOT NULL
-   `barcode` VARCHAR(100) UNIQUE nullable
-   `name` VARCHAR(180) NOT NULL
-   `description` TEXT, nullable
-   `category_id` UUID FK → `categories.id`
-   `base_unit` VARCHAR(20) NOT NULL
-   `sale_price` NUMERIC(14,4) NOT NULL CHECK (`sale_price` \>= 0)
-   `average_cost` NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK
    (`average_cost` \>= 0)
-   `stock_quantity` NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK
    (`stock_quantity` \>= 0)
-   `minimum_stock` NUMERIC(14,4), nullable
-   `tax_rate_id` UUID FK → `tax_rates.id`, nullable
-   `is_active` BOOLEAN NOT NULL DEFAULT TRUE
-   `created_at`, `updated_at` TIMESTAMPTZ

`stock_quantity` puede mantenerse como valor agregado por rendimiento,
pero debe actualizarse dentro de la misma transacción que
`stock_movements`. El historial de movimientos es la trazabilidad del
stock.

#### `suppliers`

-   `id` UUID PK
-   `name` VARCHAR(180) NOT NULL
-   `tax_identifier` VARCHAR(80), nullable
-   `phone`, `email`, `address` nullable
-   `is_active` BOOLEAN DEFAULT TRUE
-   `created_at`, `updated_at` TIMESTAMPTZ

#### `purchases`

-   `id` UUID PK
-   `purchase_number` VARCHAR(60) UNIQUE NOT NULL
-   `supplier_id` UUID FK → `suppliers.id`
-   `created_by` UUID FK → `users.id`
-   `status` VARCHAR(20): `DRAFT`, `RECEIVED`, `CANCELLED`
-   `purchased_at` TIMESTAMPTZ
-   `received_at` TIMESTAMPTZ, nullable
-   `subtotal` NUMERIC(14,2) NOT NULL
-   `tax_total` NUMERIC(14,2) NOT NULL
-   `total` NUMERIC(14,2) NOT NULL
-   `notes` TEXT, nullable
-   `created_at`, `updated_at` TIMESTAMPTZ

#### `purchase_items`

-   `id` UUID PK
-   `purchase_id` UUID FK → `purchases.id`
-   `product_id` UUID FK → `products.id`
-   `quantity` NUMERIC(14,4) NOT NULL CHECK (`quantity` \> 0)
-   `unit_cost` NUMERIC(14,4) NOT NULL CHECK (`unit_cost` \>= 0)
-   `tax_rate_snapshot` NUMERIC(7,4) NOT NULL DEFAULT 0
-   `line_subtotal`, `line_tax`, `line_total` NUMERIC(14,2) NOT NULL

Una compra solo incrementa stock cuando pasa a `RECEIVED`, una única
vez.

#### `stock_movements`

-   `id` UUID PK
-   `product_id` UUID FK → `products.id`
-   `movement_type` VARCHAR(30): `PURCHASE_IN`, `SALE_OUT`,
    `SALE_REVERSAL_IN`, `MANUAL_IN`, `MANUAL_OUT`
-   `quantity_delta` NUMERIC(14,4) NOT NULL
-   `quantity_after` NUMERIC(14,4) NOT NULL
-   `unit_cost_snapshot` NUMERIC(14,4), nullable
-   `reference_type` VARCHAR(30), nullable
-   `reference_id` UUID, nullable
-   `reason` TEXT, nullable
-   `created_by` UUID FK → `users.id`
-   `created_at` TIMESTAMPTZ NOT NULL

Los movimientos son append-only para usuarios normales. No se corrige un
movimiento histórico borrándolo: se agrega uno compensatorio.

#### `tax_rates`

-   `id` UUID PK
-   `name` VARCHAR(100) NOT NULL
-   `rate` NUMERIC(7,4) NOT NULL CHECK (`rate` \>= 0)
-   `jurisdiction_code` VARCHAR(40), nullable
-   `valid_from` DATE NOT NULL
-   `valid_to` DATE, nullable
-   `is_active` BOOLEAN NOT NULL DEFAULT TRUE

El historial de cada venta debe conservar la tasa aplicada incluso si
cambia esta tabla.

#### `sales`

-   `id` UUID PK
-   `sale_number` VARCHAR(60) UNIQUE NOT NULL
-   `cashier_id` UUID FK → `users.id`
-   `status` VARCHAR(20): `DRAFT`, `COMPLETED`, `VOIDED`,
    `PARTIALLY_REFUNDED`, `REFUNDED`
-   `subtotal` NUMERIC(14,2) NOT NULL
-   `discount_total` NUMERIC(14,2) NOT NULL DEFAULT 0
-   `tax_total` NUMERIC(14,2) NOT NULL
-   `total` NUMERIC(14,2) NOT NULL
-   `currency_code` CHAR(3) NOT NULL
-   `completed_at` TIMESTAMPTZ, nullable
-   `voided_at` TIMESTAMPTZ, nullable
-   `voided_by` UUID FK → `users.id`, nullable
-   `void_reason` TEXT, nullable
-   `created_at` TIMESTAMPTZ NOT NULL

#### `sale_items`

-   `id` UUID PK
-   `sale_id` UUID FK → `sales.id`
-   `product_id` UUID FK → `products.id`
-   `sku_snapshot` VARCHAR(80) NOT NULL
-   `product_name_snapshot` VARCHAR(180) NOT NULL
-   `unit_snapshot` VARCHAR(20) NOT NULL
-   `quantity` NUMERIC(14,4) NOT NULL CHECK (`quantity` \> 0)
-   `unit_price` NUMERIC(14,4) NOT NULL CHECK (`unit_price` \>= 0)
-   `discount_amount` NUMERIC(14,2) NOT NULL DEFAULT 0
-   `tax_rate_snapshot` NUMERIC(7,4) NOT NULL
-   `tax_amount` NUMERIC(14,2) NOT NULL
-   `line_total` NUMERIC(14,2) NOT NULL
-   `unit_cost_snapshot` NUMERIC(14,4) NOT NULL

Los snapshots conservan los valores históricos usados en la venta.

#### `payments`

-   `id` UUID PK
-   `sale_id` UUID FK → `sales.id`
-   `payment_method` VARCHAR(30): `CASH`, `CARD`, `BANK_TRANSFER`,
    `OTHER`
-   `amount` NUMERIC(14,2) NOT NULL CHECK (`amount` \> 0)
-   `reference` VARCHAR(120), nullable; nunca incluir datos sensibles de
    tarjeta
-   `paid_at` TIMESTAMPTZ NOT NULL
-   `received_by` UUID FK → `users.id`

En el MVP se admite un método de pago por venta. La estructura permite
ampliarlo después a pagos divididos.

#### `receipts`

-   `id` UUID PK
-   `sale_id` UUID FK → `sales.id` UNIQUE
-   `document_number` VARCHAR(80) UNIQUE NOT NULL
-   `document_type` VARCHAR(30) NOT NULL
-   `business_snapshot` JSONB NOT NULL
-   `issued_at` TIMESTAMPTZ NOT NULL
-   `document_status` VARCHAR(20) NOT NULL

La forma del comprobante y su numeración deben validarse contra la
legislación del país antes de producción.

#### `audit_logs`

-   `id` UUID PK
-   `actor_user_id` UUID FK → `users.id`, nullable para eventos de
    sistema
-   `action` VARCHAR(100) NOT NULL
-   `entity_type` VARCHAR(80) NOT NULL
-   `entity_id` UUID, nullable
-   `reason` TEXT, nullable
-   `metadata` JSONB NOT NULL DEFAULT `{}`
-   `created_at` TIMESTAMPTZ NOT NULL

No guardar contraseñas, tokens ni información de tarjeta en `metadata`.

### 7.2 Relaciones principales

``` mermaid
erDiagram
    USERS ||--o{ USER_SESSIONS : opens
    USERS ||--o{ SALES : processes
    USERS ||--o{ PURCHASES : creates
    USERS ||--o{ STOCK_MOVEMENTS : records
    CATEGORIES ||--o{ PRODUCTS : groups
    TAX_RATES ||--o{ PRODUCTS : applies_to
    SUPPLIERS ||--o{ PURCHASES : supplies
    PURCHASES ||--|{ PURCHASE_ITEMS : contains
    PRODUCTS ||--o{ PURCHASE_ITEMS : purchased
    PRODUCTS ||--o{ STOCK_MOVEMENTS : tracks
    SALES ||--|{ SALE_ITEMS : contains
    PRODUCTS ||--o{ SALE_ITEMS : sold
    SALES ||--|{ PAYMENTS : paid_by
    SALES ||--o| RECEIPTS : issues
```

### 7.3 Índices y restricciones

-   Índice único en `users.email`, `products.sku`, `products.barcode`
    cuando no sea nulo, `sales.sale_number`, `purchases.purchase_number`
    y `receipts.document_number`.
-   Índices en `sales.completed_at`, `sales.cashier_id`,
    `purchase_items.purchase_id`, `sale_items.sale_id`,
    `stock_movements.product_id, created_at` y `audit_logs.created_at`.
-   Usar claves foráneas y restricciones `CHECK` para cantidades e
    importes no negativos cuando corresponda.
-   Las transiciones de estado deben validarse en el servicio de
    dominio; no basta con aceptar cualquier texto desde el cliente.
-   Las operaciones de stock deben usar transacciones y
    bloqueo/concurrencia adecuados para impedir ventas simultáneas que
    consuman más unidades de las disponibles.
-   Considerar tipos enumerados o restricciones `CHECK` para roles,
    estados y métodos de pago.

## 8. Diagramas de flujo

### 8.1 Flujo general de la aplicación

``` mermaid
flowchart TD
    A([Inicio]) --> B[Mostrar inicio de sesión]
    B --> C{Credenciales válidas y usuario activo?}
    C -- No --> D[Mostrar error genérico y registrar intento]
    D --> B
    C -- Sí --> E[Crear sesión auditada]
    E --> F{Rol}
    F -- ADMIN --> G[Panel de administración]
    F -- CASHIER --> H[Pantalla de caja]
    G --> I[Catálogo / Compras / Inventario]
    G --> J[Dashboard / Informes]
    G --> K[Usuarios / Sesiones / Auditoría]
    H --> L[Buscar o escanear productos]
    L --> M[Construir carrito]
    M --> N[Confirmar venta]
    N --> O[API valida stock, precios, impuestos y permisos]
    O --> P{Validación correcta?}
    P -- No --> Q[Mostrar errores sin registrar venta]
    Q --> H
    P -- Sí --> R[Guardar venta, pago, comprobante y movimientos en una transacción]
    R --> S[Mostrar resultado e imprimir/exportar comprobante]
    I --> T[Guardar cambios con validación y auditoría]
    J --> G
    K --> G
    T --> G
    S --> H
```

### 8.2 Flujo de compra y recepción

``` mermaid
flowchart TD
    A([Inicio compra]) --> B[ADMIN selecciona proveedor]
    B --> C[Agrega productos, cantidades y costos]
    C --> D[Validar cantidades, costos y totales]
    D --> E{Datos correctos?}
    E -- No --> C
    E -- Sí --> F[Guardar compra en estado DRAFT]
    F --> G[ADMIN confirma recepción física]
    G --> H{Ya fue recibida?}
    H -- Sí --> I[Rechazar recepción duplicada]
    H -- No --> J[Transacción: marcar RECEIVED, crear movimientos y actualizar stock]
    J --> K[Actualizar costo promedio ponderado]
    K --> L[Registrar auditoría]
    L --> M([Fin])
```

### 8.3 Flujo de venta en caja

``` mermaid
flowchart TD
    A([Nueva venta]) --> B[Buscar por nombre, SKU o código de barras]
    B --> C[Agregar cantidad al carrito]
    C --> D{Seguir agregando?}
    D -- Sí --> B
    D -- No --> E[API calcula subtotal, descuentos, impuestos y total]
    E --> F[Seleccionar método de pago]
    F --> G[Solicitar confirmación]
    G --> H{Confirmar?}
    H -- No --> C
    H -- Sí --> I[Iniciar transacción y bloquear/validar stock]
    I --> J{Stock suficiente y datos válidos?}
    J -- No --> K[Rechazar operación y explicar motivo]
    K --> C
    J -- Sí --> L[Guardar venta y líneas con snapshots]
    L --> M[Guardar pago y comprobante]
    M --> N[Crear movimientos de salida y actualizar existencias]
    N --> O[Registrar auditoría y confirmar transacción]
    O --> P[Mostrar venta completada]
    P --> Q[Imprimir o exportar comprobante]
    Q --> R([Fin])
```

### 8.4 Flujo de autorización

``` mermaid
flowchart TD
    A[Petición desde escritorio] --> B[Validar sesión/token]
    B --> C{Sesión válida?}
    C -- No --> D[401: volver a login]
    C -- Sí --> E[Resolver usuario y rol en servidor]
    E --> F{Permiso para la acción?}
    F -- No --> G[403: registrar evento relevante]
    F -- Sí --> H[Validar datos y reglas de negocio]
    H --> I{Datos válidos?}
    I -- No --> J[400/409 con error controlado]
    I -- Sí --> K[Ejecutar operación transaccional]
    K --> L[Responder resultado]
```

## 9. Pantallas principales

1.  **Inicio de sesión:** correo, contraseña, mensajes genéricos de
    error.
2.  **Dashboard ADMIN:** ventas del día, ventas por período, impuestos,
    costo de mercancía vendida, margen bruto estimado, productos con
    stock bajo, valor del inventario y últimas reposiciones.
3.  **Catálogo:** tabla con búsqueda, filtros, crear/editar/desactivar
    producto y categoría.
4.  **Compras:** proveedor, líneas, cantidades, costos, estado y acción
    de recibir mercancía.
5.  **Inventario:** stock actual, unidad, stock mínimo, historial de
    movimientos y ajuste con motivo.
6.  **Caja:** búsqueda rápida, carrito, cantidad, subtotal, impuestos,
    total, método de pago y confirmar.
7.  **Comprobante:** negocio, número, fecha, artículos, cantidades,
    precios, subtotal, impuesto, total y método de pago, según
    requisitos legales.
8.  **Usuarios:** alta de cajeros, estado, rol, sesiones y ventas
    asociadas.
9.  **Informes:** filtros por período, empleado, producto y método de
    pago.
10. **Configuración:** negocio, moneda, zona horaria, tasas y reglas
    fiscales.

## 10. API propuesta (contrato inicial)

Prefijo: `/api/v1`. La lista es una guía de límites de módulos, no
autorización para implementarlos todos de una vez.

-   `POST /auth/login`
-   `POST /auth/logout`
-   `GET /auth/me`
-   `GET/POST/PATCH /users` (ADMIN)
-   `GET/POST/PATCH /categories` (ADMIN)
-   `GET/POST/PATCH /products` (lectura para CASHIER; cambios solo
    ADMIN)
-   `GET/POST /suppliers` (ADMIN)
-   `GET/POST /purchases` (ADMIN)
-   `POST /purchases/{id}/receive` (ADMIN)
-   `GET /inventory` (lectura acotada para CASHIER)
-   `GET /inventory/movements` (ADMIN)
-   `POST /inventory/adjustments` (ADMIN, motivo obligatorio)
-   `POST /sales` (CASHIER y ADMIN según política)
-   `GET /sales/{id}` (autorización por rol/propiedad)
-   `POST /sales/{id}/void` (ADMIN, motivo obligatorio)
-   `GET /reports/dashboard` (ADMIN)
-   `GET /reports/sales` (ADMIN)
-   `GET /audit-logs` (ADMIN)

Todas las rutas necesitan autenticación y autorización explícitas,
validación, respuestas de error consistentes, paginación en listados y
pruebas. No exponer costos ni informes financieros al rol CASHIER.

## 11. Estructura de carpetas sugerida

``` text
kanasta/
├── apps/
│   └── desktop/
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── features/
│       │   │   ├── auth/
│       │   │   ├── dashboard/
│       │   │   ├── products/
│       │   │   ├── inventory/
│       │   │   ├── purchases/
│       │   │   ├── checkout/
│       │   │   ├── sales/
│       │   │   └── users/
│       │   ├── lib/
│       │   └── tests/
│       └── src-tauri/
├── services/
│   └── api/
│       ├── Kanasta.Api/
│       ├── Kanasta.Application/
│       ├── Kanasta.Domain/
│       ├── Kanasta.Infrastructure/
│       └── Kanasta.Tests/
├── database/
│   ├── migrations/
│   └── seed/
├── docs/
│   └── engineering/
│       ├── SPEC.md
│       ├── ARCHITECTURE.md
│       ├── DATABASE.md
│       ├── FLOWCHARTS.md
│       ├── MODULES.md
│       └── ACCEPTANCE_CRITERIA.md
├── planning/
│   ├── PHASES.md
│   ├── CURRENT_TASK.md
│   └── CHANGELOG.md
├── README.md
└── .gitignore
```

Este archivo puede guardarse inicialmente como
`docs/engineering/KANASTA_PROJECT_SPEC.md`. En una fase de documentación
posterior puede dividirse en los archivos indicados, manteniendo una
única fuente de verdad y evitando contradicciones.

## 12. Plan de desarrollo por fases

### Fase 0 --- Decisiones y cimientos

-   Confirmar sistema operativo objetivo y jurisdicción fiscal.
-   Confirmar si habrá una sola caja o varias terminales conectadas.
-   Inicializar repositorio, herramientas, estructura y convenciones.
-   Documentar configuración de entorno y secretos.
-   Crear pipeline de pruebas y formato/lint.

**Salida:** proyecto ejecutable vacío, arquitectura documentada y
decisiones aprobadas.

### Fase 1 --- Modelo de dominio y base de datos

-   Crear entidades, restricciones, relaciones y migraciones iniciales.
-   Configurar PostgreSQL de desarrollo y datos de prueba no sensibles.
-   Probar restricciones, migraciones desde cero y rollback cuando
    proceda.

**Salida:** esquema verificable, migraciones reproducibles y pruebas de
integridad.

### Fase 2 --- Autenticación, roles y sesiones

-   Login/logout, hash seguro de contraseñas, autorización en servidor.
-   Crear el primer ADMIN mediante un procedimiento de inicialización
    seguro, no con credenciales por defecto publicadas.
-   Alta y desactivación de usuarios CASHIER.
-   Sesiones y auditoría básica.

**Salida:** pruebas que demuestren que CASHIER no puede acceder a
funciones de ADMIN, incluso llamando directamente a la API.

### Fase 3 --- Catálogo

-   Categorías, productos, unidades, SKU, precio, costo de referencia y
    tasa fiscal.
-   Validaciones, búsqueda y paginación.

**Salida:** CRUD probado y acceso de solo lectura de caja.

### Fase 4 --- Inventario y compras

-   Proveedores, compras, recepción idempotente y movimientos de stock.
-   Costo promedio ponderado.
-   Ajustes de inventario con motivo.

**Salida:** pruebas de recepción duplicada, cantidades, valoración y
auditoría.

### Fase 5 --- Caja y ventas

-   Carrito, cálculo server-side, método de pago y confirmación
    transaccional.
-   Comprobante inicial sujeto a validación fiscal.
-   Control de concurrencia y prevención de stock negativo.

**Salida:** pruebas de venta exitosa, stock insuficiente, errores a
mitad de operación y ventas simultáneas.

### Fase 6 --- Dashboard e informes

-   Ventas netas, impuestos, costo de mercancía vendida, margen bruto y
    stock valorizado.
-   Filtros por fecha y cajero.
-   Verificación de cifras contra datos de prueba calculados
    manualmente.

**Salida:** cada indicador documentado con fórmula y prueba.

### Fase 7 --- Endurecimiento y empaquetado

-   Pruebas de seguridad, permisos, recuperación de errores y
    rendimiento básico.
-   Instalador, configuración del servidor, copias de seguridad y
    procedimiento de restauración.
-   Pruebas en el sistema operativo objetivo.
-   Validación fiscal y prueba con hardware real si aplica.

**Salida:** versión candidata a producción con checklist firmado.

## 13. Criterios de aceptación globales

-   No se permite acceder a una función restringida modificando la
    interfaz o llamando directamente a la API.
-   Una venta confirmada actualiza venta, líneas, pago, comprobante y
    stock de forma atómica.
-   Una venta rechazada no deja cambios parciales ni descuenta stock.
-   No se puede vender una cantidad mayor a la disponible, incluso con
    dos cajas vendiendo al mismo tiempo.
-   La recepción de una compra no puede ejecutarse dos veces.
-   Los cambios en el catálogo no alteran los importes históricos de
    ventas.
-   Los importes usan aritmética decimal y una regla de redondeo
    documentada.
-   Las anulaciones y ajustes quedan auditados y conservan el registro
    original.
-   Los informes se contrastan con escenarios de prueba reproducibles.
-   Las migraciones permiten crear una base nueva desde cero.
-   No se incluyen secretos ni credenciales reales en el repositorio.
-   Las copias de seguridad y la restauración se prueban antes de
    producción.

## 14. Riesgos y decisiones que deben cerrarse antes de producción

1.  **País y normativa fiscal:** tasas, documentos legales, numeración,
    redondeo y conservación de registros.
2.  **Sistema operativo:** confirmar Windows, macOS o Linux; no prometer
    compatibilidad sin pruebas.
3.  **Número de cajas:** una terminal o varias en red.
4.  **Operación sin internet o sin servidor:** el MVP no permite ventas
    offline; diseñar sincronización es una iniciativa separada.
5.  **Impresión:** modelo de impresora, formato de papel y requisitos
    del comprobante.
6.  **Código de barras y balanzas:** dispositivos y formatos soportados.
7.  **Devoluciones:** política, reembolso, devolución física a stock y
    permisos.
8.  **Descuentos:** si se permiten y quién puede autorizarlos.
9.  **Moneda y precisión:** moneda principal, decimales y redondeo.
10. **Copias de seguridad:** ubicación, frecuencia, retención, cifrado y
    prueba de restauración.

No presentar Kanasta como fiscalmente certificada hasta validar la
implementación con los requisitos oficiales de la jurisdicción elegida.

## 15. Instrucciones obligatorias para Cursor y Antigravity

Copiar estas reglas en las instrucciones del agente del repositorio:

1.  Antes de escribir código, leer `README.md`, este documento y
    `planning/CURRENT_TASK.md`.
2.  Implementar exclusivamente la fase y el módulo autorizados en
    `planning/CURRENT_TASK.md`.
3.  No anticipar módulos de fases futuras, aunque parezcan convenientes.
4.  No cambiar stack, arquitectura, esquema, nombres de campos, roles,
    reglas fiscales o reglas de negocio sin aprobación explícita.
5.  Si existe una contradicción o falta una decisión crítica, detenerse
    y presentar la pregunta concreta antes de modificar el diseño.
6.  Antes de editar, resumir el objetivo, archivos previstos, riesgos y
    pruebas que ejecutará.
7.  Escribir pruebas junto con la funcionalidad. No declarar una prueba
    exitosa si no se ejecutó.
8.  Ejecutar las pruebas relevantes, lint y build disponibles; reportar
    comandos y resultados reales.
9.  No ocultar fallos, no borrar pruebas para hacer pasar la compilación
    y no sustituir datos reales por mocks en las pruebas de integración
    sin declararlo.
10. Mantener cambios pequeños, legibles y revisables; no hacer refactors
    ajenos a la tarea.
11. No guardar secretos, contraseñas, tokens o datos personales reales
    en el repositorio.
12. Al terminar, entregar: resumen, archivos modificados, decisiones
    tomadas dentro del alcance, pruebas ejecutadas y resultados,
    limitaciones conocidas y cualquier bloqueo.
13. Actualizar `planning/CHANGELOG.md` si la tarea autorizada lo
    requiere y proponer el siguiente paso, pero **esperar aprobación**
    antes de continuar.
14. No pasar a la siguiente fase hasta que el usuario revise y apruebe
    la fase actual.

### Plantilla para `planning/CURRENT_TASK.md`

``` markdown
# Tarea actual autorizada

- Fase:
- Módulo:
- Objetivo:
- Alcance permitido:
- Fuera de alcance:
- Archivos que se pueden modificar:
- Reglas de negocio relevantes:
- Pruebas obligatorias:
- Criterios de aceptación:
- Comandos de validación:
- Condición de finalización: entregar resultados y esperar aprobación.
```

## 16. Primera tarea recomendada para el agente

**No implementar aún toda la aplicación.** La primera tarea debe ser
únicamente la Fase 0:

-   Crear la estructura de carpetas acordada.
-   Crear `README.md` con requisitos, stack y pasos de instalación
    previstos.
-   Crear `planning/PHASES.md`, `planning/CURRENT_TASK.md` y
    `planning/CHANGELOG.md`.
-   Registrar las decisiones pendientes de la sección 14.
-   No implementar login, CRUD, API de negocio ni pantallas funcionales.
-   Ejecutar solo las verificaciones aplicables a la estructura
    documental y reportar el resultado.

Una vez revisada y aprobada la Fase 0, autorizar explícitamente la Fase
1.


---

# Anexo A — Decisiones confirmadas para el MVP (Venezuela)

**Este anexo prevalece sobre cualquier decisión provisional contradictoria del documento principal.** Cursor y Antigravity deben leerlo antes de comenzar cada tarea.

## A.1 Jurisdicción, moneda y precios

- **País de operación:** Venezuela.
- **Moneda principal de visualización y referencia comercial del MVP:** dólar estadounidense (USD).
- La interfaz administrativa, el catálogo, los precios, los costos, el inventario valorizado, los informes y los comprobantes de prueba deben mostrar importes en USD, con formato uniforme, por ejemplo `US$ 12.50`.
- En la base de datos, `currency_code` debe guardar `USD` para las operaciones del MVP. No usar bolívares como moneda predeterminada ni convertir automáticamente importes a bolívares.
- No interpretar USD como autorización para emitir facturas fiscalmente válidas en Venezuela. La moneda de referencia de la interfaz y la moneda/forma de expresión exigida para documentos fiscales son cuestiones distintas.
- La aplicación debe separar el **documento de prueba/comprobante interno** del documento fiscal legal. Antes de producción, un profesional tributario venezolano debe validar las reglas vigentes de facturación, expresión de moneda, IVA, numeración, identificación del contribuyente, redondeo, conservación de documentos y cualquier obligación de expresar importes en bolívares o en otra moneda.
- No fijar una tasa de IVA por defecto sin una decisión explícita y validada. Las tasas deben configurarse por el administrador autorizado según reglas aprobadas; cualquier valor inicial del entorno de desarrollo debe estar claramente marcado como dato ficticio/no fiscal.
- El MVP puede calcular impuestos usando reglas configuradas para pruebas, pero la interfaz debe mostrar que la configuración fiscal no ha sido validada para producción hasta completar la revisión legal.
- No integrar tasas de cambio automáticas en el MVP. Si en una fase posterior se necesita registrar equivalencias entre USD y bolívares, definir fuente, fecha/hora, política de redondeo, moneda legal de la operación y tratamiento contable por separado. No convertir históricos al cambiar una tasa.
- Usar `NUMERIC`/`decimal`, nunca coma flotante binaria, para importes. Definir y probar una política uniforme de redondeo monetario; no redondear cantidades físicas de forma accidental.
- El formato visual puede usar dos decimales para dinero, pero la precisión almacenada y el cálculo de líneas deben seguir una política explícita. Los totales de factura deben derivarse de reglas de cálculo centralizadas en la API.

## A.2 Alcance del MVP para pruebas

El MVP debe ser una versión funcional pequeña, comprobable y segura, no la aplicación completa en una sola entrega.

### Incluido

1. Inicio de sesión y cierre de sesión.
2. Roles `ADMIN` y `CASHIER`, autorizados en el servidor.
3. Inicialización segura del primer administrador.
4. CRUD básico de categorías y productos.
5. SKU único, nombre, unidad de medida, precio de venta en USD, costo de referencia y existencia.
6. Registro de proveedores.
7. Registro de compras y recepción de mercancía.
8. Movimientos de inventario y ajustes con motivo.
9. Pantalla de caja con búsqueda de productos, carrito, cantidades y total.
10. Confirmación transaccional de ventas y registro del método de pago.
11. Comprobante interno de prueba con desglose de subtotal, impuesto configurado y total; no presentarlo como factura fiscal certificada.
12. Dashboard básico con ventas, impuestos configurados, costo de mercancía vendida, margen bruto estimado, stock y valor de inventario.
13. Historial de sesiones y actividad básica de usuarios.
14. Datos semilla claramente ficticios para pruebas automatizadas y demostraciones.

### Fuera del MVP, salvo autorización escrita

- Emisión fiscal certificada o afirmación de cumplimiento tributario venezolano.
- Integración con sistemas fiscales, máquinas fiscales, impresoras fiscales o proveedores externos.
- Conversión automática USD/bolívares o consulta automática de tasas.
- Operación offline y sincronización posterior.
- Múltiples sucursales.
- Contabilidad general, cuentas por pagar completas y conciliación bancaria.
- Pagos divididos, devoluciones parciales avanzadas, promociones complejas y fidelización.
- Integraciones con hardware no identificado y probado.
- Despliegue público en la nube sin revisión de seguridad.

## A.3 Decisión de arquitectura para pruebas

Se mantiene la arquitectura propuesta:

- Escritorio: Tauri 2 + React + TypeScript.
- API: ASP.NET Core + C#.
- Datos: PostgreSQL.
- Acceso a datos: Entity Framework Core y migraciones versionadas.

El MVP debe conectarse a una API y una base de datos compartidas cuando se prueben varias cajas. Si las pruebas iniciales se realizan en un único equipo, se puede ejecutar la API y PostgreSQL en ese equipo, conservando la misma separación lógica. No crear una base independiente por terminal para el modo multi-caja.

**Modo de operación inicial:** requiere conexión con la API y la base de datos. Si no se puede alcanzar el servidor, bloquear la confirmación de nuevas ventas y mostrar un error claro; no simular que la venta quedó guardada ni permitir que una venta se pierda silenciosamente.

## A.4 Reglas financieras para el MVP

- El precio de venta y el costo son campos distintos.
- El costo de mercancía vendida se captura como snapshot en cada línea de venta.
- Se recomienda costo promedio ponderado para la valoración del inventario, actualizado al recibir compras.
- Valor de inventario de prueba: `existencia × costo unitario valorado`.
- Ventas netas para cálculo de margen: ventas confirmadas menos descuentos y devoluciones aplicables, excluyendo impuestos indirectos.
- Margen bruto estimado: ventas netas sin impuestos menos costo de mercancía vendida.
- No tratar el IVA cobrado como ingreso o ganancia.
- Los nombres de los indicadores y sus fórmulas deben estar documentados junto al dashboard.
- Los datos de demostración deben permitir comprobar manualmente las cifras del dashboard.
- La app debe evitar que un cajero vea costos de adquisición, margen, ganancia o informes financieros.

## A.5 Pruebas mínimas específicas del MVP

1. Un producto de prueba muestra precio y costo en USD con el formato establecido.
2. Un cajero no puede consultar costos ni endpoints administrativos, aunque invoque la API directamente.
3. Una venta confirmada reduce el stock exactamente una vez.
4. Una venta rechazada no deja venta, pago, comprobante ni movimiento de stock parcial.
5. Dos cajas no pueden vender conjuntamente más unidades de las disponibles.
6. Una recepción de compra repetida no duplica la existencia.
7. Una venta conserva el precio, impuesto, nombre de producto y costo usados en ese momento.
8. Cambiar el catálogo no reescribe ventas históricas.
9. El cálculo de importes usa decimal y casos de prueba de redondeo documentados.
10. Los dashboards coinciden con los resultados esperados de un conjunto de datos ficticio.
11. Los comprobantes del entorno de prueba se identifican claramente como internos/no fiscales.
12. Si la API no está disponible, la caja no informa que la venta se completó.

## A.6 Configuración de entorno y datos de prueba

- Usar variables de entorno o un archivo local ignorado por Git para cadenas de conexión y secretos.
- Incluir un `.env.example` sin credenciales reales.
- No subir contraseñas reales, tokens ni datos de clientes o empleados.
- Crear datos semilla con nombres y datos ficticios.
- No incluir un usuario administrador con contraseña fija conocida en producción.
- Documentar cómo inicializar la base, ejecutar migraciones, cargar datos de prueba y reiniciar el entorno.
- Las copias de seguridad y restauración deben probarse antes de cualquier uso comercial real.

## A.7 Próxima tarea autorizada recomendada

La primera tarea sigue siendo **Fase 0 — cimientos y documentación**, actualizada con las decisiones confirmadas en este anexo. El agente debe:

1. Crear la estructura del repositorio.
2. Crear `README.md` y los documentos de planificación.
3. Registrar Venezuela como jurisdicción objetivo y USD como moneda principal de referencia del MVP.
4. Marcar los requisitos fiscales venezolanos como pendientes de validación profesional.
5. Registrar que el MVP usa Tauri 2, React, TypeScript, ASP.NET Core, C# y PostgreSQL.
6. Registrar las funcionalidades incluidas y excluidas del MVP.
7. No implementar todavía login, CRUD, ventas ni lógica de negocio.
8. Entregar un informe de archivos creados, validaciones ejecutadas y decisiones pendientes, y esperar aprobación.

Una vez aprobada la Fase 0, la siguiente autorización será la Fase 1: modelo de dominio, migraciones y restricciones de base de datos.
