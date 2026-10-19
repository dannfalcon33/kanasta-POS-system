# Kanasta --- Registro de Decisiones de Arquitectura y Negocio

Este documento formaliza las decisiones críticas tomadas para el MVP de Kanasta, en estricto cumplimiento con el **Anexo A** y la **Sección 14** de la especificación técnica.

---

## 1. Decisiones Confirmadas para el MVP

### ADR-001: Jurisdicción y Moneda de Referencia
- **Decisión:** La jurisdicción objetivo del proyecto es **Venezuela**.
- **Moneda de Referencia Comercial:** Dólar estadounidense (**USD**). Todos los precios de venta, costos de compra, existencias valorizadas, métricas del dashboard y comprobantes se expresan con formato estándar `US$ 12.50`.
- **Código de Moneda:** En base de datos, `currency_code` almacena el valor literal `'USD'`.
- **Exclusión:** No se implementan conversiones automáticas ni consulta de tasas en bolívares en el MVP.

### ADR-002: Carácter No Fiscal de los Comprobantes del MVP
- **Decisión:** El sistema emite únicamente **comprobantes internos de prueba**.
- **Aviso Legal:** Los documentos generados por el MVP están explícitamente etiquetados como *Documento Interno de Prueba / No Válido como Factura Fiscal*.
- **Razón:** La normativa tributaria venezolana (SENIAT) exige requisitos estrictos (máquinas fiscales homologadas, numeración y formatos autorizados, expresión legal) que deben ser validados formalmente por un asesor tributario calificado antes de cualquier uso comercial en producción.

### ADR-003: Impuestos y Reglas Fiscales Configurables
- **Decisión:** No se establece una tasa de IVA fija o "hardcoded" en el código.
- **Configuración:** Las tasas impositivas se configuran de manera flexible mediante la entidad `tax_rates`.
- **Datos de Prueba:** Cualquier alícuota cargada en desarrollo (ej. 16%) tiene carácter estrictamente ilustrativo para pruebas de cálculo aritmético.

### ADR-004: Stack Tecnológico
- **Frontend de Escritorio:** Tauri 2 + React + TypeScript.
- **Backend / API de Negocio:** ASP.NET Core Web API (.NET 8) con C#.
- **Base de Datos:** PostgreSQL con Entity Framework Core y migraciones versionadas.
- **Pruebas:** xUnit para backend; Vitest / Testing Library para frontend.

### ADR-005: Concurrencia y Control de Inventario Multi-Caja
- **Decisión:** No se permite el uso de bases de datos locales independientes (como SQLite embebido por caja) para escenarios multi-caja.
- **Regla:** Todos los terminales se conectan a la API centralizada que controla las existencias en PostgreSQL con transacciones atómicas y bloqueos de concurrencia.
- **Stock Negativo:** Queda estrictamente prohibido permitir ventas que resulten en existencias negativas.

### ADR-006: Valoración de Inventario y Métricas Financieras
- **Método de Valoración:** Costo Promedio Ponderado (CPP), recalculado automáticamente al confirmar la recepción física de una compra (`purchases.status = RECEIVED`).
- **Margen Bruto Estimado:** Se calcula como:
  $$\text{Margen Bruto} = \text{Ventas Netas (sin impuestos)} - \text{Costo de Mercancía Vendida (CMV)}$$
- **IVA:** Los impuestos recaudados no se consideran ingresos ni ganancia del negocio.
- **Seguridad Financiera:** El rol `CASHIER` no tiene acceso bajo ninguna circunstancia a costos de compra, márgenes ni dashboards financieros.

---

## 2. Matriz de Decisiones Pendientes (Pre-Producción)

Antes de realizar el paso a producción comercial (Fase 7), las siguientes decisiones deben ser formalizadas por la administración del negocio:

| # | Área | Estado Actual (MVP) | Decisión Requerida para Producción |
|---|---|---|---|
| 1 | **Normativa Fiscal** | Comprobante interno no fiscal en USD. | Validación con asesor tributario venezolano sobre facturación formal, medios de emisión e IVA. |
| 2 | **Hardware de Impresión** | Salida en pantalla / exportación PDF estándar. | Definición de marca/modelo de impresoras térmicas (ej. Epson, Bixolon, 58mm o 80mm). |
| 3 | **Lectores de Código y Balanzas** | Entrada estándar de teclado (USB HID) para códigos de barra. | Identificar protocolos requeridos para balanzas electrónicas en tiempo real (ej. RS-232 / USB). |
| 4 | **Políticas de Descuentos** | Descuentos deshabilitados por defecto en caja. | Definir umbrales máximos de descuento y autorización requerida por supervisor/admin. |
| 5 | **Devoluciones y Anulaciones** | Anulaciones permitidas exclusivamente a `ADMIN` con motivo auditado. | Protocolo de devoluciones a clientes: reintegro de dinero vs nota de crédito interna. |
| 6 | **Respaldo de Datos** | Scripts de `pg_dump` en entorno local. | Estrategia de copias de seguridad automatizadas: destino físico aislado, frecuencia y política de retención. |
| 7 | **Operación sin Servidor** | Bloqueo preventivo de venta si la API no responde. | Análisis de factibilidad de una fase posterior de sincronización offline con resolución de conflictos. |
