-- ==============================================================================
-- Kanasta - Script de Datos Semilla de Desarrollo (PostgreSQL)
-- FASE 1: Modelo de Dominio y Base de Datos
-- ADVERTENCIA: Datos ficticios exclusivamente para pruebas y desarrollo.
-- ==============================================================================

-- 1. Configuración del Negocio (Venezuela / USD)
INSERT INTO business_settings (
    id, business_name, tax_identifier, address, phone, currency_code, timezone, prices_include_tax, created_at, updated_at
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Abasto y Supermercado Ejemplo',
    'J-12345678-0',
    'Av. Principal, Local 1, Caracas, Venezuela',
    '+58 212 5550000',
    'USD',
    'America/Caracas',
    false,
    NOW(),
    NULL
) ON CONFLICT (id) DO NOTHING;

-- 2. Tasa de Impuesto Ilustrativa (16%)
INSERT INTO tax_rates (
    id, name, rate, jurisdiction_code, valid_from, valid_to, is_active
) VALUES (
    '22222222-2222-2222-2222-222222222222',
    'IVA General Ilustrativo (16%)',
    0.1600,
    'VE',
    '2026-01-01',
    NULL,
    true
) ON CONFLICT (id) DO NOTHING;

-- 3. Categorías
INSERT INTO categories (id, name, description, is_active, created_at, updated_at)
VALUES 
    ('33333333-3333-3333-3333-333333333333', 'Víveres', 'Alimentos no perecederos y granos básicos', true, NOW(), NULL),
    ('44444444-4444-4444-4444-444444444444', 'Lácteos y Refrigerados', 'Leches, quesos y derivados', true, NOW(), NULL)
ON CONFLICT (id) DO NOTHING;

-- 4. Proveedor de Ejemplo
INSERT INTO suppliers (id, name, tax_identifier, phone, email, address, is_active, created_at, updated_at)
VALUES (
    '55555555-5555-5555-5555-555555555555',
    'Distribuidora Nacional de Alimentos C.A.',
    'J-98765432-1',
    '+58 212 5551122',
    'contacto@distribuidoraficticia.com',
    'Zona Industrial, Caracas',
    true,
    NOW(),
    NULL
) ON CONFLICT (id) DO NOTHING;

-- 5. Productos de Prueba (Precios y Costos en USD)
INSERT INTO products (
    id, sku, barcode, name, description, category_id, base_unit, sale_price, average_cost, stock_quantity, minimum_stock, tax_rate_id, is_active, created_at, updated_at
) VALUES 
    ('66666666-6666-6666-6666-666666666661', 'VIV-ARR-001', '7591000111222', 'Arroz Blanco Tradicional 1kg', 'Arroz de grano largo calidad superior', '33333333-3333-3333-3333-333333333333', 'kg', 1.3500, 0.9500, 150.0000, 20.0000, '22222222-2222-2222-2222-222222222222', true, NOW(), NULL),
    ('66666666-6666-6666-6666-666666666662', 'VIV-HAR-002', '7591000333444', 'Harina de Maíz Blanco 1kg', 'Harina precocida para arepas', '33333333-3333-3333-3333-333333333333', 'kg', 1.2000, 0.8500, 200.0000, 30.0000, '22222222-2222-2222-2222-222222222222', true, NOW(), NULL),
    ('66666666-6666-6666-6666-666666666663', 'LAC-LEC-003', '7591000555666', 'Leche Entera Larga Vida 1L', 'Leche pasteurizada UHT', '44444444-4444-4444-4444-444444444444', 'litro', 2.1000, 1.5500, 80.0000, 15.0000, '22222222-2222-2222-2222-222222222222', true, NOW(), NULL)
ON CONFLICT (id) DO NOTHING;
