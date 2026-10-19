CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    migration_id character varying(150) NOT NULL,
    product_version character varying(32) NOT NULL,
    CONSTRAINT pk___ef_migrations_history PRIMARY KEY (migration_id)
);

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE TABLE business_settings (
        id uuid NOT NULL,
        business_name character varying(160) NOT NULL,
        tax_identifier character varying(80),
        address text,
        phone character varying(40),
        currency_code character(3) NOT NULL,
        timezone character varying(80) NOT NULL,
        prices_include_tax boolean NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        CONSTRAINT pk_business_settings PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE TABLE categories (
        id uuid NOT NULL,
        name character varying(120) NOT NULL,
        description text,
        is_active boolean NOT NULL DEFAULT TRUE,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        CONSTRAINT pk_categories PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE TABLE suppliers (
        id uuid NOT NULL,
        name character varying(180) NOT NULL,
        tax_identifier character varying(80),
        phone character varying(40),
        email character varying(120),
        address text,
        is_active boolean NOT NULL DEFAULT TRUE,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        CONSTRAINT pk_suppliers PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE TABLE tax_rates (
        id uuid NOT NULL,
        name character varying(100) NOT NULL,
        rate numeric(7,4) NOT NULL,
        jurisdiction_code character varying(40),
        valid_from timestamp with time zone NOT NULL,
        valid_to timestamp with time zone,
        is_active boolean NOT NULL DEFAULT TRUE,
        CONSTRAINT pk_tax_rates PRIMARY KEY (id),
        CONSTRAINT "CK_tax_rates_rate" CHECK (rate >= 0)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE TABLE users (
        id uuid NOT NULL,
        email character varying(255) NOT NULL,
        password_hash text NOT NULL,
        full_name character varying(160) NOT NULL,
        role character varying(20) NOT NULL,
        is_active boolean NOT NULL DEFAULT TRUE,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        last_login_at timestamp with time zone,
        CONSTRAINT pk_users PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE TABLE products (
        id uuid NOT NULL,
        sku character varying(80) NOT NULL,
        barcode character varying(100),
        name character varying(180) NOT NULL,
        description text,
        category_id uuid NOT NULL,
        base_unit character varying(20) NOT NULL,
        sale_price numeric(14,4) NOT NULL,
        average_cost numeric(14,4) NOT NULL DEFAULT 0.0,
        stock_quantity numeric(14,4) NOT NULL DEFAULT 0.0,
        minimum_stock numeric(14,4),
        tax_rate_id uuid,
        is_active boolean NOT NULL DEFAULT TRUE,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        CONSTRAINT pk_products PRIMARY KEY (id),
        CONSTRAINT "CK_products_average_cost" CHECK (average_cost >= 0),
        CONSTRAINT "CK_products_sale_price" CHECK (sale_price >= 0),
        CONSTRAINT "CK_products_stock_quantity" CHECK (stock_quantity >= 0),
        CONSTRAINT fk_products_categories_category_id FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT,
        CONSTRAINT fk_products_tax_rates_tax_rate_id FOREIGN KEY (tax_rate_id) REFERENCES tax_rates (id) ON DELETE SET NULL
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE TABLE audit_logs (
        id uuid NOT NULL,
        actor_user_id uuid,
        action character varying(100) NOT NULL,
        entity_type character varying(80) NOT NULL,
        entity_id uuid,
        reason text,
        metadata text NOT NULL DEFAULT '{}',
        created_at timestamp with time zone NOT NULL,
        CONSTRAINT pk_audit_logs PRIMARY KEY (id),
        CONSTRAINT fk_audit_logs_users_actor_user_id FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE TABLE purchases (
        id uuid NOT NULL,
        purchase_number character varying(60) NOT NULL,
        supplier_id uuid NOT NULL,
        created_by_id uuid NOT NULL,
        status character varying(20) NOT NULL,
        purchased_at timestamp with time zone NOT NULL,
        received_at timestamp with time zone,
        subtotal numeric(14,2) NOT NULL,
        tax_total numeric(14,2) NOT NULL,
        total numeric(14,2) NOT NULL,
        notes text,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        CONSTRAINT pk_purchases PRIMARY KEY (id),
        CONSTRAINT fk_purchases_suppliers_supplier_id FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE RESTRICT,
        CONSTRAINT fk_purchases_users_created_by_id FOREIGN KEY (created_by_id) REFERENCES users (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE TABLE sales (
        id uuid NOT NULL,
        sale_number character varying(60) NOT NULL,
        cashier_id uuid NOT NULL,
        status character varying(20) NOT NULL,
        subtotal numeric(14,2) NOT NULL,
        discount_total numeric(14,2) NOT NULL DEFAULT 0.0,
        tax_total numeric(14,2) NOT NULL,
        total numeric(14,2) NOT NULL,
        currency_code character(3) NOT NULL,
        completed_at timestamp with time zone,
        voided_at timestamp with time zone,
        voided_by_id uuid,
        void_reason text,
        created_at timestamp with time zone NOT NULL,
        CONSTRAINT pk_sales PRIMARY KEY (id),
        CONSTRAINT fk_sales_users_cashier_id FOREIGN KEY (cashier_id) REFERENCES users (id) ON DELETE RESTRICT,
        CONSTRAINT fk_sales_users_voided_by_id FOREIGN KEY (voided_by_id) REFERENCES users (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE TABLE user_sessions (
        id uuid NOT NULL,
        user_id uuid NOT NULL,
        terminal_name character varying(120),
        started_at timestamp with time zone NOT NULL,
        ended_at timestamp with time zone,
        login_success boolean NOT NULL,
        failure_reason_code character varying(60),
        created_at timestamp with time zone NOT NULL,
        CONSTRAINT pk_user_sessions PRIMARY KEY (id),
        CONSTRAINT fk_user_sessions_users_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE TABLE stock_movements (
        id uuid NOT NULL,
        product_id uuid NOT NULL,
        movement_type character varying(30) NOT NULL,
        quantity_delta numeric(14,4) NOT NULL,
        quantity_after numeric(14,4) NOT NULL,
        unit_cost_snapshot numeric(14,4),
        reference_type character varying(30),
        reference_id uuid,
        reason text,
        created_by_id uuid NOT NULL,
        created_at timestamp with time zone NOT NULL,
        CONSTRAINT pk_stock_movements PRIMARY KEY (id),
        CONSTRAINT fk_stock_movements_products_product_id FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
        CONSTRAINT fk_stock_movements_users_created_by_id FOREIGN KEY (created_by_id) REFERENCES users (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE TABLE purchase_items (
        id uuid NOT NULL,
        purchase_id uuid NOT NULL,
        product_id uuid NOT NULL,
        quantity numeric(14,4) NOT NULL,
        unit_cost numeric(14,4) NOT NULL,
        tax_rate_snapshot numeric(7,4) NOT NULL DEFAULT 0.0,
        line_subtotal numeric(14,2) NOT NULL,
        line_tax numeric(14,2) NOT NULL,
        line_total numeric(14,2) NOT NULL,
        CONSTRAINT pk_purchase_items PRIMARY KEY (id),
        CONSTRAINT "CK_purchase_items_quantity" CHECK (quantity > 0),
        CONSTRAINT "CK_purchase_items_unit_cost" CHECK (unit_cost >= 0),
        CONSTRAINT fk_purchase_items_products_product_id FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
        CONSTRAINT fk_purchase_items_purchases_purchase_id FOREIGN KEY (purchase_id) REFERENCES purchases (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE TABLE payments (
        id uuid NOT NULL,
        sale_id uuid NOT NULL,
        payment_method character varying(30) NOT NULL,
        amount numeric(14,2) NOT NULL,
        reference character varying(120),
        paid_at timestamp with time zone NOT NULL,
        received_by_id uuid NOT NULL,
        CONSTRAINT pk_payments PRIMARY KEY (id),
        CONSTRAINT "CK_payments_amount" CHECK (amount > 0),
        CONSTRAINT fk_payments_sales_sale_id FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
        CONSTRAINT fk_payments_users_received_by_id FOREIGN KEY (received_by_id) REFERENCES users (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE TABLE receipts (
        id uuid NOT NULL,
        sale_id uuid NOT NULL,
        document_number character varying(80) NOT NULL,
        document_type character varying(30) NOT NULL,
        business_snapshot text NOT NULL,
        issued_at timestamp with time zone NOT NULL,
        document_status character varying(20) NOT NULL,
        CONSTRAINT pk_receipts PRIMARY KEY (id),
        CONSTRAINT fk_receipts_sales_sale_id FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE TABLE sale_items (
        id uuid NOT NULL,
        sale_id uuid NOT NULL,
        product_id uuid NOT NULL,
        sku_snapshot character varying(80) NOT NULL,
        product_name_snapshot character varying(180) NOT NULL,
        unit_snapshot character varying(20) NOT NULL,
        quantity numeric(14,4) NOT NULL,
        unit_price numeric(14,4) NOT NULL,
        discount_amount numeric(14,2) NOT NULL DEFAULT 0.0,
        tax_rate_snapshot numeric(7,4) NOT NULL,
        tax_amount numeric(14,2) NOT NULL,
        line_total numeric(14,2) NOT NULL,
        unit_cost_snapshot numeric(14,4) NOT NULL,
        CONSTRAINT pk_sale_items PRIMARY KEY (id),
        CONSTRAINT "CK_sale_items_quantity" CHECK (quantity > 0),
        CONSTRAINT "CK_sale_items_unit_price" CHECK (unit_price >= 0),
        CONSTRAINT fk_sale_items_products_product_id FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
        CONSTRAINT fk_sale_items_sales_sale_id FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE INDEX ix_audit_logs_actor_user_id ON audit_logs (actor_user_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE INDEX ix_audit_logs_created_at ON audit_logs (created_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE UNIQUE INDEX ix_categories_name ON categories (name);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE INDEX ix_payments_received_by_id ON payments (received_by_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE INDEX ix_payments_sale_id ON payments (sale_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE UNIQUE INDEX ix_products_barcode ON products (barcode);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE INDEX ix_products_category_id ON products (category_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE UNIQUE INDEX ix_products_sku ON products (sku);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE INDEX ix_products_tax_rate_id ON products (tax_rate_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE INDEX ix_purchase_items_product_id ON purchase_items (product_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE INDEX ix_purchase_items_purchase_id ON purchase_items (purchase_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE INDEX ix_purchases_created_by_id ON purchases (created_by_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE UNIQUE INDEX ix_purchases_purchase_number ON purchases (purchase_number);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE INDEX ix_purchases_supplier_id ON purchases (supplier_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE UNIQUE INDEX ix_receipts_document_number ON receipts (document_number);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE UNIQUE INDEX ix_receipts_sale_id ON receipts (sale_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE INDEX ix_sale_items_product_id ON sale_items (product_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE INDEX ix_sale_items_sale_id ON sale_items (sale_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE INDEX ix_sales_cashier_id ON sales (cashier_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE INDEX ix_sales_completed_at ON sales (completed_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE UNIQUE INDEX ix_sales_sale_number ON sales (sale_number);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE INDEX ix_sales_voided_by_id ON sales (voided_by_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE INDEX ix_stock_movements_created_by_id ON stock_movements (created_by_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE INDEX ix_stock_movements_product_id_created_at ON stock_movements (product_id, created_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE INDEX ix_user_sessions_user_id ON user_sessions (user_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    CREATE UNIQUE INDEX ix_users_email ON users (email);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261017174106_InitialSchema') THEN
    INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20261017174106_InitialSchema', '8.0.11');
    END IF;
END $EF$;
COMMIT;

