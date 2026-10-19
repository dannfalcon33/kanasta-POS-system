# Kanasta --- Arquitectura de Ingeniería

Este documento describe la arquitectura técnica, las capas del sistema, los principios rectores y los patrones de diseño aplicados en **Kanasta**.

---

## 1. Topología del Sistema

Kanasta está diseñado bajo una arquitectura cliente-servidor centralizada para garantizar la consistencia transaccional y el inventario en tiempo real entre múltiples cajas registradoras y terminales administrativas.

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│     Kanasta Desktop (Caja)      │       │     Kanasta Desktop (Admin)     │
│       Tauri 2 + React + TS      │       │       Tauri 2 + React + TS      │
└────────────────┬────────────────┘       └────────────────┬────────────────┘
                 │                                         │
                 └───────────────────┬─────────────────────┘
                                     │ HTTPS / Red local
                                     ▼
                      ┌─────────────────────────────┐
                      │    ASP.NET Core Web API     │
                      │  Reglas, Permisos, Dominio  │
                      └──────────────┬──────────────┘
                                     │
                                     ▼
                      ┌─────────────────────────────┐
                      │   PostgreSQL (BD Central)   │
                      │  Transacciones e Integridad │
                      └─────────────────────────────┘
```

> **Nota:** Aunque en fases tempranas o despliegues mono-equipo la API y PostgreSQL puedan ejecutarse en la misma máquina física, la separación lógica cliente-servidor se mantiene intacta. No se utiliza SQLite local por terminal para evitar divergencias de inventario.

---

## 2. Capas de la Solución Backend (.NET 8)

La API de Kanasta se organiza en un **Monolito Modular** aplicando principios de **Clean Architecture**:

```
services/api/
├── Kanasta.Domain/          # Núcleo: Entidades, Enums, Reglas puras, Interfaces de repositorio
├── Kanasta.Application/     # Casos de uso: DTOs, Servicios de aplicación, Validaciones Fluent
├── Kanasta.Infrastructure/  # Acceso a datos: EF Core DbContext, Migraciones, Repositorios, Hashing
├── Kanasta.Api/             # Punto de entrada HTTP: Controladores, Middlewares, Filtros de autorización
└── Kanasta.Tests/           # Pruebas automatizadas: Unitarias, de Integración y Arquitectura
```

### Reglas de Dependencia
1. **Domain** no depende de ningún proyecto ni paquete de infraestructura externa.
2. **Application** depende únicamente de **Domain**.
3. **Infrastructure** implementa interfaces de **Domain** y **Application** utilizando Entity Framework Core y Npgsql.
4. **Api** orquesta las dependencias, expone los endpoints HTTP y no contiene lógica de negocio directa.

---

## 3. Principios Fundamentales de Diseño

1. **La Interfaz de Usuario nunca es fuente de verdad:**
   - La UI no calcula precios finales, ni valida permisos por sí sola, ni descuenta inventario localmente. La API de negocio calcula, valida y persiste.
2. **Precisión Aritmética Estricta:**
   - Todo importe monetario y cantidad física utiliza tipos `decimal` en C# y `NUMERIC(14,2)` / `NUMERIC(14,4)` en PostgreSQL. Está estrictamente prohibido el uso de `float` o `double` para cálculos financieros o de existencias.
3. **Transaccionalidad Atómica:**
   - Una venta confirmada registra la venta, sus líneas con snapshots históricos, el pago, el comprobante y los movimientos de inventario dentro de **una única transacción de base de datos**.
   - Ante cualquier error o falta de stock, la transacción se revierte (`rollback`) por completo sin dejar registros huérfanos.
4. **Prohibición de Stock Negativo:**
   - Las operaciones de confirmación de venta validan la existencia real en base de datos bajo control de concurrencia para evitar sobreventas simultáneas.
5. **Inmutabilidad y Snapshots Históricos:**
   - Las líneas de venta (`sale_items`) capturan una copia instantánea (`snapshot`) del SKU, nombre, unidad, precio unitario, tasa de impuesto y costo de adquisición vigente al momento de la venta.
   - Cambios posteriores en el catálogo de productos no alteran las transacciones pasadas.
6. **Historial Append-Only y Auditoría:**
   - No se realiza borrado físico (`hard delete`) de ventas, facturas ni movimientos de inventario. Las correcciones se registran como anulaciones o movimientos compensatorios con motivo obligatorio.
7. **Tratamiento Temporal Uniforme:**
   - Todas las fechas y marcas de tiempo se persisten en base de datos en **UTC** (`TIMESTAMPTZ`). La interfaz de usuario las presenta en la zona horaria local configurada (`America/Caracas`).

---

## 4. Frontend de Escritorio (Desktop)

La interfaz se estructura de manera modular:
- **Tecnología:** React + TypeScript + Vite, envuelto con Tauri 2 para compilación nativa en escritorio.
- **Estructura de Características (`features/`):**
  - `auth/`: Inicio/cierre de sesión y estado de sesión del usuario.
  - `checkout/`: Terminal de venta, escaneo de productos, gestión de carrito y confirmación.
  - `products/`: Catálogo de productos y categorías (solo lectura para cajero, gestión para admin).
  - `inventory/`: Existencias actuales, historial de movimientos y ajustes justificados.
  - `purchases/`: Registro de compras a proveedores y confirmación de recepción física.
  - `dashboard/`: Métricas financieras, márgenes brutos y stock crítico (exclusivo admin).
  - `users/`: Gestión de cajeros y auditoría de accesos.
