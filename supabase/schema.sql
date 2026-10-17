-- ================================================================
-- CATATAN KEUANGAN - FULL SUPABASE DATABASE SCHEMA & MIGRATION
-- ================================================================
-- Jalankan file SQL ini di Supabase Dashboard -> SQL Editor
-- untuk menginisialisasi atau memperbarui seluruh database project.

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. AUTOMATIC UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- TABLE 1: ACCOUNTS (Akun / Rekening Keuangan)
-- ================================================================
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (length(trim(type)) > 0),
    initial_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT accounts_user_id_name_unique_idx UNIQUE (user_id, name)
);

-- Apabila tabel accounts sudah ada dari versi sebelumnya, pastikan constraint type diperbarui:
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_type_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_type_check CHECK (length(trim(type)) > 0);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);

-- ================================================================
-- TABLE 2: CATEGORIES (Kategori Pemasukan / Pengeluaran)
-- ================================================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    color TEXT NOT NULL DEFAULT '#10B981',
    icon TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT categories_user_id_name_type_unique_idx UNIQUE (user_id, name, type)
);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);

-- ================================================================
-- TABLE 3: TRANSACTIONS (Transaksi Keuangan)
-- ================================================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    from_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    to_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    description TEXT,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);

-- ================================================================
-- TABLE 4: BUDGETS (Budget Bulanan Per Kategori)
-- ================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year INTEGER NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    is_auto_generated BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sama dengan migrations/202610170001_align_budget_soft_delete.sql.
-- CREATE TABLE IF NOT EXISTS tidak menambahkan kolom pada database lama.
ALTER TABLE public.budgets
    ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Buat pengganti sebelum melepas constraint lama. Riwayat yang dihapus
-- tidak menghalangi pembuatan budget baru untuk kategori/periode yang sama.
CREATE UNIQUE INDEX IF NOT EXISTS budgets_active_user_category_period_unique_idx
    ON public.budgets (user_id, category_id, period_month, period_year)
    WHERE deleted_at IS NULL;

ALTER TABLE public.budgets
    DROP CONSTRAINT IF EXISTS budgets_user_category_period_unique_idx;
-- Mendukung database yang menyimpan aturan lama sebagai standalone index.
DROP INDEX IF EXISTS public.budgets_user_category_period_unique_idx;

CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(period_year, period_month);

COMMIT;

-- ================================================================
-- TABLE 5: BUDGET_TEMPLATES (Template Budget Otomatis)
-- ================================================================
CREATE TABLE IF NOT EXISTS budget_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT budget_templates_user_category_unique_idx UNIQUE (user_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_budget_templates_user_id ON budget_templates(user_id);

-- ================================================================
-- TABLE 5B: DAILY_ALLOWANCES (Jatah Anggaran Harian & Akumulasi Rollover)
-- ================================================================
CREATE TABLE IF NOT EXISTS daily_allowances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    daily_amount NUMERIC(15, 2) NOT NULL CHECK (daily_amount > 0),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    rollover_enabled BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT daily_allowances_user_category_unique_idx UNIQUE (user_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_allowances_user_id ON daily_allowances(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_allowances_category_id ON daily_allowances(category_id);

-- ================================================================
-- TABLE 6: SAVINGS_GOALS (Target Tabungan / Impian)
-- ================================================================
CREATE TABLE IF NOT EXISTS savings_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount NUMERIC(15, 2) NOT NULL CHECK (target_amount > 0),
    current_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (current_amount >= 0),
    target_date DATE,
    color TEXT NOT NULL DEFAULT '#10B981',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON savings_goals(user_id);

-- ================================================================
-- TABLE 7: PRODUCT_TYPES (Daftar tipe produk: bawaan + custom per user)
-- Bawaan: Pulsa, Kuota, Token Listrik, Wifi (is_builtin = true).
-- ================================================================
CREATE TABLE IF NOT EXISTS product_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_builtin BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT product_types_user_id_name_unique_idx UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_product_types_user_id ON product_types(user_id);

-- ================================================================
-- TABLE 8: SALES (Penjualan -> link 2 baris transactions)
-- product_type_name_snapshot menyimpan NAMA TIPE (bukan nama produk).
-- ================================================================
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_type_id UUID REFERENCES product_types(id) ON DELETE SET NULL,
    product_type_name_snapshot TEXT,
    sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
    cost_amount NUMERIC(15, 2) NOT NULL CHECK (cost_amount >= 0),
    sell_amount NUMERIC(15, 2) NOT NULL CHECK (sell_amount > 0),
    cost_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    income_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    income_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    expense_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    expense_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    income_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    customer_ref TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kolom lama product_id / product_name_snapshot dimigrasikan di blok MIGRASI
-- di akhir file (bila masih ada dari schema versi lama).
ALTER TABLE sales ADD COLUMN IF NOT EXISTS product_type_id UUID REFERENCES product_types(id) ON DELETE SET NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS product_type_name_snapshot TEXT;

CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_product_type ON sales(product_type_id);

-- ================================================================
-- TABLE 9: CUSTOMERS (Pelanggan untuk tagihan hutang/piutang)
-- ================================================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT customers_user_id_name_unique_idx UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);

-- ================================================================
-- TABLE 10: DEBTS (Tagihan pelanggan: hutang produk kredit / pinjaman uang)
-- kind='sale': hutang 1:1 dari penjualan kredit; total = sales.sell_amount.
-- kind='loan': pinjaman uang berdiri sendiri (tanpa sales);
--              total tagihan = loan_amount (uang diserahkan, tanpa bunga).
-- Tanpa jatuh tempo: status selalu dihitung dari payments vs total tagihan.
-- ================================================================
CREATE TABLE IF NOT EXISTS debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name_snapshot TEXT,
    sale_id UUID UNIQUE REFERENCES sales(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'sale' CHECK (kind IN ('sale', 'loan')),
    loan_amount NUMERIC(15, 2) CHECK (loan_amount IS NULL OR loan_amount > 0),
    loan_date DATE DEFAULT CURRENT_DATE,
    loan_source_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    loan_expense_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    loan_income_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    loan_description TEXT,
    loan_expense_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT debts_kind_source_check CHECK (
        (kind = 'sale' AND sale_id IS NOT NULL AND loan_amount IS NULL)
        OR (kind = 'loan' AND sale_id IS NULL AND loan_amount IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_customer ON debts(customer_id);

-- ================================================================
-- TABLE 11: DEBT_PAYMENTS (Riwayat cicilan; tiap baris punya income tx sendiri)
-- ================================================================
CREATE TABLE IF NOT EXISTS debt_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    income_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_user ON debt_payments(user_id);

-- ================================================================
-- TRIGGERS FOR AUTOMATIC UPDATED_AT
-- ================================================================
DROP TRIGGER IF EXISTS trg_accounts_updated_at ON accounts;
CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON transactions;
CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_budgets_updated_at ON budgets;
CREATE TRIGGER trg_budgets_updated_at BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_budget_templates_updated_at ON budget_templates;
CREATE TRIGGER trg_budget_templates_updated_at BEFORE UPDATE ON budget_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_daily_allowances_updated_at ON daily_allowances;
CREATE TRIGGER trg_daily_allowances_updated_at BEFORE UPDATE ON daily_allowances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_savings_goals_updated_at ON savings_goals;
CREATE TRIGGER trg_savings_goals_updated_at BEFORE UPDATE ON savings_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_product_types_updated_at ON product_types;
CREATE TRIGGER trg_product_types_updated_at BEFORE UPDATE ON product_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_sales_updated_at ON sales;
CREATE TRIGGER trg_sales_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_debts_updated_at ON debts;
CREATE TRIGGER trg_debts_updated_at BEFORE UPDATE ON debts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_debt_payments_updated_at ON debt_payments;
CREATE TRIGGER trg_debt_payments_updated_at BEFORE UPDATE ON debt_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ================================================================
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_allowances ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any before recreating
DROP POLICY IF EXISTS "Users can manage their own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can manage their own categories" ON categories;
DROP POLICY IF EXISTS "Users can manage their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can manage their own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can manage their own budget_templates" ON budget_templates;
DROP POLICY IF EXISTS "Users can manage their own daily_allowances" ON daily_allowances;
DROP POLICY IF EXISTS "Users can manage their own savings_goals" ON savings_goals;
DROP POLICY IF EXISTS "Users can manage their own product_types" ON product_types;
DROP POLICY IF EXISTS "Users can manage their own sales" ON sales;
DROP POLICY IF EXISTS "Users can manage their own customers" ON customers;
DROP POLICY IF EXISTS "Users can manage their own debts" ON debts;
DROP POLICY IF EXISTS "Users can manage their own debt_payments" ON debt_payments;

CREATE POLICY "Users can manage their own accounts" ON accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own categories" ON categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own transactions" ON transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own budgets" ON budgets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own budget_templates" ON budget_templates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own daily_allowances" ON daily_allowances FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own savings_goals" ON savings_goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own product_types" ON product_types FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own sales" ON sales FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own customers" ON customers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own debts" ON debts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own debt_payments" ON debt_payments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ================================================================
-- RPC: ATOMIC SALES (1 sale = [1 expense tx bila modal > 0] + 1 income tx + 1 sales row)
-- Catatan: transactions.amount CHECK > 0, jadi modal Rp0 = tidak buat expense tx.
-- ================================================================
DROP FUNCTION IF EXISTS assert_sale_ownership(UUID, UUID, UUID, UUID, UUID, UUID) CASCADE;
CREATE OR REPLACE FUNCTION assert_sale_ownership(
    p_user_id UUID,
    p_product_type_id UUID,
    p_cost_account_id UUID,
    p_income_account_id UUID,
    p_income_category_id UUID,
    p_expense_category_id UUID
)
RETURNS VOID AS $$
BEGIN
    IF p_cost_account_id IS NULL THEN
        RAISE EXCEPTION 'Akun Sumber wajib diisi';
    END IF;

    IF p_income_account_id IS NULL THEN
        RAISE EXCEPTION 'Akun penerima wajib diisi';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = p_cost_account_id AND user_id = p_user_id) THEN
        RAISE EXCEPTION 'Akun Sumber tidak valid';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = p_income_account_id AND user_id = p_user_id) THEN
        RAISE EXCEPTION 'Akun penerima tidak valid';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM categories WHERE id = p_income_category_id AND user_id = p_user_id AND type = 'income') THEN
        RAISE EXCEPTION 'Kategori penjualan tidak valid';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM categories WHERE id = p_expense_category_id AND user_id = p_user_id AND type = 'expense') THEN
        RAISE EXCEPTION 'Kategori modal tidak valid';
    END IF;

    IF p_product_type_id IS NULL THEN
        RAISE EXCEPTION 'Pilih tipe produk';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM product_types WHERE id = p_product_type_id AND user_id = p_user_id) THEN
        RAISE EXCEPTION 'Tipe produk tidak valid';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS create_sale(UUID, TEXT, DATE, NUMERIC, NUMERIC, UUID, UUID, UUID, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION create_sale(
    p_product_type_id UUID,
    p_product_type_name_snapshot TEXT,
    p_sale_date DATE,
    p_cost_amount NUMERIC,
    p_sell_amount NUMERIC,
    p_cost_account_id UUID,
    p_income_account_id UUID,
    p_income_category_id UUID,
    p_expense_category_id UUID,
    p_customer_ref TEXT,
    p_description TEXT
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_expense_tx_id UUID;
    v_income_tx_id UUID;
    v_sale_id UUID;
    v_expense_desc TEXT;
    v_income_desc TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_sell_amount IS NULL OR p_sell_amount <= 0 THEN
        RAISE EXCEPTION 'Harga jual harus lebih dari 0';
    END IF;

    IF p_cost_amount IS NULL OR p_cost_amount < 0 THEN
        RAISE EXCEPTION 'Modal tidak boleh negatif';
    END IF;

    PERFORM assert_sale_ownership(v_user_id, p_product_type_id, p_cost_account_id, p_income_account_id, p_income_category_id, p_expense_category_id);

    v_expense_desc := COALESCE(NULLIF(TRIM(COALESCE(p_description, '')), ''), 'HPP ' || COALESCE(NULLIF(TRIM(COALESCE(p_product_type_name_snapshot, '')), ''), 'Penjualan'));
    v_income_desc := COALESCE(NULLIF(TRIM(COALESCE(p_description, '')), ''), 'Penjualan ' || COALESCE(NULLIF(TRIM(COALESCE(p_product_type_name_snapshot, '')), ''), ''));

    -- Modal Rp0 -> tidak ada arus keluar, jadi expense tx dilewati (transactions.amount > 0).
    IF p_cost_amount > 0 THEN
        INSERT INTO transactions (user_id, type, amount, account_id, category_id, description, transaction_date)
        VALUES (v_user_id, 'expense', p_cost_amount, p_cost_account_id, p_expense_category_id, v_expense_desc, p_sale_date)
        RETURNING id INTO v_expense_tx_id;
    END IF;

    BEGIN
        INSERT INTO transactions (user_id, type, amount, account_id, category_id, description, transaction_date)
        VALUES (v_user_id, 'income', p_sell_amount, p_income_account_id, p_income_category_id, v_income_desc, p_sale_date)
        RETURNING id INTO v_income_tx_id;
    EXCEPTION WHEN OTHERS THEN
        IF v_expense_tx_id IS NOT NULL THEN
            DELETE FROM transactions WHERE id = v_expense_tx_id;
        END IF;
        RAISE;
    END;

    BEGIN
        INSERT INTO sales (
            user_id, product_type_id, product_type_name_snapshot, sale_date,
            cost_amount, sell_amount,
            cost_account_id, income_account_id,
            income_category_id, expense_category_id,
            expense_transaction_id, income_transaction_id,
            customer_ref, description
        )
        VALUES (
            v_user_id, p_product_type_id, p_product_type_name_snapshot, p_sale_date,
            p_cost_amount, p_sell_amount,
            p_cost_account_id, p_income_account_id,
            p_income_category_id, p_expense_category_id,
            v_expense_tx_id, v_income_tx_id,
            NULLIF(TRIM(COALESCE(p_customer_ref, '')), ''), NULLIF(TRIM(COALESCE(p_description, '')), '')
        )
        RETURNING id INTO v_sale_id;
    EXCEPTION WHEN OTHERS THEN
        IF v_expense_tx_id IS NOT NULL THEN
            DELETE FROM transactions WHERE id = v_expense_tx_id;
        END IF;
        IF v_income_tx_id IS NOT NULL THEN
            DELETE FROM transactions WHERE id = v_income_tx_id;
        END IF;
        RAISE;
    END;

    RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS update_sale(UUID, UUID, TEXT, DATE, NUMERIC, NUMERIC, UUID, UUID, UUID, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION update_sale(
    p_sale_id UUID,
    p_product_type_id UUID,
    p_product_type_name_snapshot TEXT,
    p_sale_date DATE,
    p_cost_amount NUMERIC,
    p_sell_amount NUMERIC,
    p_cost_account_id UUID,
    p_income_account_id UUID,
    p_income_category_id UUID,
    p_expense_category_id UUID,
    p_customer_ref TEXT,
    p_description TEXT
)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_expense_tx_id UUID;
    v_income_tx_id UUID;
    v_expense_desc TEXT;
    v_income_desc TEXT;
    v_is_credit BOOLEAN := false;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT expense_transaction_id, income_transaction_id
    INTO v_expense_tx_id, v_income_tx_id
    FROM sales WHERE id = p_sale_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Data penjualan tidak ditemukan';
    END IF;

    IF p_sell_amount IS NULL OR p_sell_amount <= 0 THEN
        RAISE EXCEPTION 'Harga jual harus lebih dari 0';
    END IF;

    IF p_cost_amount IS NULL OR p_cost_amount < 0 THEN
        RAISE EXCEPTION 'Modal tidak boleh negatif';
    END IF;

    PERFORM assert_sale_ownership(v_user_id, p_product_type_id, p_cost_account_id, p_income_account_id, p_income_category_id, p_expense_category_id);

    -- Credit sale (terhubung ke debts) tidak punya income tx penuh: jangan buat/update income tx.
    SELECT EXISTS (SELECT 1 FROM debts WHERE sale_id = p_sale_id AND user_id = v_user_id)
    INTO v_is_credit;

    -- Pastikan expense tx yang dirujuk masih milik user ini (bisa yatim bila dihapus manual).
    IF v_expense_tx_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM transactions WHERE id = v_expense_tx_id AND user_id = v_user_id) THEN
        v_expense_tx_id := NULL;
    END IF;

    IF v_income_tx_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM transactions WHERE id = v_income_tx_id AND user_id = v_user_id) THEN
        v_income_tx_id := NULL;
    END IF;

    IF v_is_credit THEN
        v_income_tx_id := NULL;
    END IF;

    v_expense_desc := COALESCE(NULLIF(TRIM(COALESCE(p_description, '')), ''), 'HPP ' || COALESCE(NULLIF(TRIM(COALESCE(p_product_type_name_snapshot, '')), ''), 'Penjualan'));
    v_income_desc := COALESCE(NULLIF(TRIM(COALESCE(p_description, '')), ''), 'Penjualan ' || COALESCE(NULLIF(TRIM(COALESCE(p_product_type_name_snapshot, '')), ''), ''));

    IF p_cost_amount > 0 THEN
        IF v_expense_tx_id IS NOT NULL THEN
            UPDATE transactions
            SET amount = p_cost_amount,
                account_id = p_cost_account_id,
                category_id = p_expense_category_id,
                description = v_expense_desc,
                transaction_date = p_sale_date
            WHERE id = v_expense_tx_id AND user_id = v_user_id;
        ELSE
            INSERT INTO transactions (user_id, type, amount, account_id, category_id, description, transaction_date)
            VALUES (v_user_id, 'expense', p_cost_amount, p_cost_account_id, p_expense_category_id, v_expense_desc, p_sale_date)
            RETURNING id INTO v_expense_tx_id;
        END IF;
    ELSE
        -- Modal turun ke Rp0: hapus expense tx bila masih ada.
        IF v_expense_tx_id IS NOT NULL THEN
            DELETE FROM transactions WHERE id = v_expense_tx_id AND user_id = v_user_id;
            v_expense_tx_id := NULL;
        END IF;
    END IF;

    IF NOT v_is_credit THEN
        IF v_income_tx_id IS NOT NULL THEN
            UPDATE transactions
            SET amount = p_sell_amount,
                account_id = p_income_account_id,
                category_id = p_income_category_id,
                description = v_income_desc,
                transaction_date = p_sale_date
            WHERE id = v_income_tx_id AND user_id = v_user_id;
        ELSE
            INSERT INTO transactions (user_id, type, amount, account_id, category_id, description, transaction_date)
            VALUES (v_user_id, 'income', p_sell_amount, p_income_account_id, p_income_category_id, v_income_desc, p_sale_date)
            RETURNING id INTO v_income_tx_id;
        END IF;
    END IF;

    UPDATE sales
    SET product_type_id = p_product_type_id,
        product_type_name_snapshot = p_product_type_name_snapshot,
        sale_date = p_sale_date,
        cost_amount = p_cost_amount,
        sell_amount = p_sell_amount,
        cost_account_id = p_cost_account_id,
        income_account_id = CASE WHEN v_is_credit THEN NULL ELSE p_income_account_id END,
        income_category_id = p_income_category_id,
        expense_category_id = p_expense_category_id,
        expense_transaction_id = v_expense_tx_id,
        income_transaction_id = CASE WHEN v_is_credit THEN NULL ELSE v_income_tx_id END,
        customer_ref = NULLIF(TRIM(COALESCE(p_customer_ref, '')), ''),
        description = NULLIF(TRIM(COALESCE(p_description, '')), '')
    WHERE id = p_sale_id AND user_id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION delete_sale(p_sale_id UUID)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_expense_tx_id UUID;
    v_income_tx_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT expense_transaction_id, income_transaction_id
    INTO v_expense_tx_id, v_income_tx_id
    FROM sales WHERE id = p_sale_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Data penjualan tidak ditemukan';
    END IF;

    -- Hapus dulu income tx milik semua cicilan hutang (FK CASCADE hanya
    -- membersihkan debts + payments, bukan transactions).
    DELETE FROM transactions
    WHERE id IN (
        SELECT dp.income_transaction_id
        FROM debt_payments dp
        JOIN debts d ON d.id = dp.debt_id
        WHERE d.sale_id = p_sale_id AND d.user_id = v_user_id
          AND dp.income_transaction_id IS NOT NULL
    ) AND user_id = v_user_id;

    DELETE FROM sales WHERE id = p_sale_id AND user_id = v_user_id;

    IF v_expense_tx_id IS NOT NULL THEN
        DELETE FROM transactions WHERE id = v_expense_tx_id AND user_id = v_user_id;
    END IF;

    IF v_income_tx_id IS NOT NULL THEN
        DELETE FROM transactions WHERE id = v_income_tx_id AND user_id = v_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ================================================================
-- RPC: CREDIT SALES / DEBTS (tagihan pelanggan, cash-basis, tanpa jatuh tempo)
-- 1 credit sale = [1 expense tx bila modal > 0] + 1 sales row (income NULL) + 1 debts row.
-- Income dicatat bertahap via record_debt_payment (1 payment = 1 income tx).
-- Total tagihan SELALU dibaca dari sales.sell_amount; status dihitung di query.
-- ================================================================
DROP FUNCTION IF EXISTS assert_credit_sale_ownership(UUID, UUID, UUID, UUID, UUID, UUID) CASCADE;
CREATE OR REPLACE FUNCTION assert_credit_sale_ownership(
    p_user_id UUID,
    p_customer_id UUID,
    p_product_type_id UUID,
    p_cost_account_id UUID,
    p_income_category_id UUID,
    p_expense_category_id UUID
)
RETURNS VOID AS $$
BEGIN
    IF p_cost_account_id IS NULL THEN
        RAISE EXCEPTION 'Akun Sumber wajib diisi';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = p_cost_account_id AND user_id = p_user_id) THEN
        RAISE EXCEPTION 'Akun Sumber tidak valid';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM categories WHERE id = p_income_category_id AND user_id = p_user_id AND type = 'income') THEN
        RAISE EXCEPTION 'Kategori penjualan tidak valid';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM categories WHERE id = p_expense_category_id AND user_id = p_user_id AND type = 'expense') THEN
        RAISE EXCEPTION 'Kategori modal tidak valid';
    END IF;

    IF p_product_type_id IS NULL THEN
        RAISE EXCEPTION 'Pilih tipe produk';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM product_types WHERE id = p_product_type_id AND user_id = p_user_id) THEN
        RAISE EXCEPTION 'Tipe produk tidak valid';
    END IF;

    IF p_customer_id IS NULL THEN
        RAISE EXCEPTION 'Pilih pelanggan';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id AND user_id = p_user_id) THEN
        RAISE EXCEPTION 'Pelanggan tidak valid';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS create_credit_sale(UUID, TEXT, UUID, TEXT, DATE, NUMERIC, NUMERIC, UUID, UUID, UUID, TEXT);
CREATE OR REPLACE FUNCTION create_credit_sale(
    p_customer_id UUID,
    p_customer_name_snapshot TEXT,
    p_product_type_id UUID,
    p_product_type_name_snapshot TEXT,
    p_sale_date DATE,
    p_cost_amount NUMERIC,
    p_sell_amount NUMERIC,
    p_cost_account_id UUID,
    p_expense_category_id UUID,
    p_income_category_id UUID,
    p_description TEXT
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_expense_tx_id UUID;
    v_sale_id UUID;
    v_debt_id UUID;
    v_expense_desc TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_sell_amount IS NULL OR p_sell_amount <= 0 THEN
        RAISE EXCEPTION 'Harga jual harus lebih dari 0';
    END IF;

    IF p_cost_amount IS NULL OR p_cost_amount < 0 THEN
        RAISE EXCEPTION 'Modal tidak boleh negatif';
    END IF;

    PERFORM assert_credit_sale_ownership(v_user_id, p_customer_id, p_product_type_id, p_cost_account_id, p_income_category_id, p_expense_category_id);

    v_expense_desc := COALESCE(NULLIF(TRIM(COALESCE(p_description, '')), ''), 'HPP ' || COALESCE(NULLIF(TRIM(COALESCE(p_product_type_name_snapshot, '')), ''), 'Penjualan'));

    IF p_cost_amount > 0 THEN
        INSERT INTO transactions (user_id, type, amount, account_id, category_id, description, transaction_date)
        VALUES (v_user_id, 'expense', p_cost_amount, p_cost_account_id, p_expense_category_id, v_expense_desc, p_sale_date)
        RETURNING id INTO v_expense_tx_id;
    END IF;

    BEGIN
        INSERT INTO sales (
            user_id, product_type_id, product_type_name_snapshot, sale_date,
            cost_amount, sell_amount,
            cost_account_id, income_account_id,
            income_category_id, expense_category_id,
            expense_transaction_id, income_transaction_id,
            customer_ref, description
        )
        VALUES (
            v_user_id, p_product_type_id, p_product_type_name_snapshot, p_sale_date,
            p_cost_amount, p_sell_amount,
            p_cost_account_id, NULL,
            p_income_category_id, p_expense_category_id,
            v_expense_tx_id, NULL,
            NULLIF(TRIM(COALESCE(p_customer_name_snapshot, '')), ''), NULLIF(TRIM(COALESCE(p_description, '')), '')
        )
        RETURNING id INTO v_sale_id;
    EXCEPTION WHEN OTHERS THEN
        IF v_expense_tx_id IS NOT NULL THEN
            DELETE FROM transactions WHERE id = v_expense_tx_id;
        END IF;
        RAISE;
    END;

    BEGIN
        INSERT INTO debts (user_id, customer_id, customer_name_snapshot, sale_id)
        VALUES (v_user_id, p_customer_id, NULLIF(TRIM(COALESCE(p_customer_name_snapshot, '')), ''), v_sale_id)
        RETURNING id INTO v_debt_id;
    EXCEPTION WHEN OTHERS THEN
        DELETE FROM sales WHERE id = v_sale_id;
        IF v_expense_tx_id IS NOT NULL THEN
            DELETE FROM transactions WHERE id = v_expense_tx_id;
        END IF;
        RAISE;
    END;

    RETURN v_debt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION record_debt_payment(
    p_debt_id UUID,
    p_amount NUMERIC,
    p_account_id UUID,
    p_payment_date DATE,
    p_note TEXT
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_kind TEXT;
    v_loan_amount NUMERIC;
    v_loan_income_category_id UUID;
    v_total NUMERIC;
    v_sell_amount NUMERIC;
    v_paid NUMERIC;
    v_remaining NUMERIC;
    v_income_category_id UUID;
    v_income_tx_id UUID;
    v_payment_id UUID;
    v_desc TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Nominal pembayaran harus lebih dari 0';
    END IF;

    IF p_account_id IS NULL THEN
        RAISE EXCEPTION 'Pilih akun penerima pembayaran';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = p_account_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'Akun penerima tidak valid';
    END IF;

    -- Kunci baris debt agar dua cicilan bersamaan tidak melebihi sisa.
    PERFORM 1 FROM debts WHERE id = p_debt_id AND user_id = v_user_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Data hutang tidak ditemukan';
    END IF;

    -- Total tagihan & kategori cicilan: dari sales untuk hutang produk (kind='sale'),
    -- dari baris debts untuk pinjaman uang (kind='loan').
    SELECT d.kind, d.loan_amount, d.loan_income_category_id,
           s.sell_amount, s.income_category_id
    INTO v_kind, v_loan_amount, v_loan_income_category_id,
         v_sell_amount, v_income_category_id
    FROM debts d
    LEFT JOIN sales s ON s.id = d.sale_id
    WHERE d.id = p_debt_id AND d.user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Data hutang tidak ditemukan';
    END IF;

    v_total := CASE WHEN v_kind = 'loan' THEN v_loan_amount ELSE v_sell_amount END;

    IF v_total IS NULL THEN
        RAISE EXCEPTION 'Data penjualan hutang tidak ditemukan';
    END IF;

    v_income_category_id := CASE
        WHEN v_kind = 'loan' THEN v_loan_income_category_id
        ELSE v_income_category_id
    END;

    SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM debt_payments WHERE debt_id = p_debt_id AND user_id = v_user_id;

    v_remaining := v_total - v_paid;

    IF v_remaining <= 0 THEN
        RAISE EXCEPTION 'Hutang sudah lunas';
    END IF;

    IF p_amount > v_remaining THEN
        RAISE EXCEPTION 'Melebihi sisa hutang';
    END IF;

    v_desc := NULLIF(TRIM(COALESCE(p_note, '')), '');
    IF v_desc IS NULL THEN
        SELECT 'Cicilan hutang ' || COALESCE(NULLIF(TRIM(COALESCE(d.customer_name_snapshot, '')), ''), 'pelanggan')
        INTO v_desc
        FROM debts d WHERE d.id = p_debt_id AND d.user_id = v_user_id;
    END IF;

    BEGIN
        INSERT INTO transactions (user_id, type, amount, account_id, category_id, description, transaction_date)
        VALUES (v_user_id, 'income', p_amount, p_account_id, v_income_category_id, v_desc, COALESCE(p_payment_date, CURRENT_DATE))
        RETURNING id INTO v_income_tx_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE;
    END;

    BEGIN
        INSERT INTO debt_payments (user_id, debt_id, amount, account_id, category_id, income_transaction_id, payment_date, note)
        VALUES (v_user_id, p_debt_id, p_amount, p_account_id, v_income_category_id, v_income_tx_id, COALESCE(p_payment_date, CURRENT_DATE), NULLIF(TRIM(COALESCE(p_note, '')), ''))
        RETURNING id INTO v_payment_id;
    EXCEPTION WHEN OTHERS THEN
        DELETE FROM transactions WHERE id = v_income_tx_id;
        RAISE;
    END;

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION update_debt_payment(
    p_payment_id UUID,
    p_amount NUMERIC,
    p_account_id UUID,
    p_payment_date DATE,
    p_note TEXT
)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_debt_id UUID;
    v_income_tx_id UUID;
    v_kind TEXT;
    v_loan_amount NUMERIC;
    v_total NUMERIC;
    v_sell_amount NUMERIC;
    v_paid_others NUMERIC;
    v_remaining NUMERIC;
    v_desc TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Nominal pembayaran harus lebih dari 0';
    END IF;

    IF p_account_id IS NULL THEN
        RAISE EXCEPTION 'Pilih akun penerima pembayaran';
    END IF;

    SELECT debt_id, income_transaction_id
    INTO v_debt_id, v_income_tx_id
    FROM debt_payments WHERE id = p_payment_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Data cicilan tidak ditemukan';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = p_account_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'Akun penerima tidak valid';
    END IF;

    PERFORM 1 FROM debts WHERE id = v_debt_id AND user_id = v_user_id FOR UPDATE;

    SELECT d.kind, d.loan_amount, s.sell_amount
    INTO v_kind, v_loan_amount, v_sell_amount
    FROM debts d
    LEFT JOIN sales s ON s.id = d.sale_id
    WHERE d.id = v_debt_id AND d.user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Data hutang tidak ditemukan';
    END IF;

    v_total := CASE WHEN v_kind = 'loan' THEN v_loan_amount ELSE v_sell_amount END;

    IF v_total IS NULL THEN
        RAISE EXCEPTION 'Data penjualan hutang tidak ditemukan';
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_paid_others
    FROM debt_payments WHERE debt_id = v_debt_id AND user_id = v_user_id AND id <> p_payment_id;

    v_remaining := v_total - v_paid_others;

    IF p_amount > v_remaining THEN
        RAISE EXCEPTION 'Melebihi sisa hutang';
    END IF;

    v_desc := NULLIF(TRIM(COALESCE(p_note, '')), '');
    IF v_desc IS NULL THEN
        SELECT 'Cicilan hutang ' || COALESCE(NULLIF(TRIM(COALESCE(d.customer_name_snapshot, '')), ''), 'pelanggan')
        INTO v_desc
        FROM debts d WHERE d.id = v_debt_id AND d.user_id = v_user_id;
    END IF;

    IF v_income_tx_id IS NOT NULL AND EXISTS (SELECT 1 FROM transactions WHERE id = v_income_tx_id AND user_id = v_user_id) THEN
        UPDATE transactions
        SET amount = p_amount,
            account_id = p_account_id,
            description = v_desc,
            transaction_date = COALESCE(p_payment_date, CURRENT_DATE)
        WHERE id = v_income_tx_id AND user_id = v_user_id;
    ELSE
        INSERT INTO transactions (user_id, type, amount, account_id, category_id, description, transaction_date)
        VALUES (v_user_id, 'income', p_amount, p_account_id, (SELECT CASE WHEN d.kind = 'loan' THEN d.loan_income_category_id ELSE s.income_category_id END FROM debts d LEFT JOIN sales s ON s.id = d.sale_id WHERE d.id = v_debt_id AND d.user_id = v_user_id), v_desc, COALESCE(p_payment_date, CURRENT_DATE))
        RETURNING id INTO v_income_tx_id;
    END IF;

    UPDATE debt_payments
    SET amount = p_amount,
        account_id = p_account_id,
        income_transaction_id = v_income_tx_id,
        payment_date = COALESCE(p_payment_date, CURRENT_DATE),
        note = NULLIF(TRIM(COALESCE(p_note, '')), '')
    WHERE id = p_payment_id AND user_id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION delete_debt_payment(p_payment_id UUID)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_income_tx_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT income_transaction_id
    INTO v_income_tx_id
    FROM debt_payments WHERE id = p_payment_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Data cicilan tidak ditemukan';
    END IF;

    DELETE FROM debt_payments WHERE id = p_payment_id AND user_id = v_user_id;

    IF v_income_tx_id IS NOT NULL THEN
        DELETE FROM transactions WHERE id = v_income_tx_id AND user_id = v_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ================================================================
-- PINJAMAN UANG (debts kind='loan' — tanpa baris sales)
-- Penyerahan uang = 1 transaksi pengeluaran dari akun sumber;
-- cicilan memakai record_debt_payment / update_debt_payment /
-- delete_debt_payment (total tagihan dibaca dari debts.loan_amount).
-- ================================================================
DROP FUNCTION IF EXISTS assert_money_loan_ownership(UUID, UUID, UUID, UUID, UUID) CASCADE;
CREATE OR REPLACE FUNCTION assert_money_loan_ownership(
    p_user_id UUID,
    p_customer_id UUID,
    p_source_account_id UUID,
    p_income_category_id UUID,
    p_expense_category_id UUID
)
RETURNS VOID AS $$
BEGIN
    IF p_source_account_id IS NULL THEN
        RAISE EXCEPTION 'Pilih akun sumber pinjaman';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = p_source_account_id AND user_id = p_user_id) THEN
        RAISE EXCEPTION 'Akun sumber pinjaman tidak valid';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM categories WHERE id = p_income_category_id AND user_id = p_user_id AND type = 'income') THEN
        RAISE EXCEPTION 'Kategori cicilan tidak valid';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM categories WHERE id = p_expense_category_id AND user_id = p_user_id AND type = 'expense') THEN
        RAISE EXCEPTION 'Kategori pinjaman tidak valid';
    END IF;

    IF p_customer_id IS NULL THEN
        RAISE EXCEPTION 'Pilih pelanggan';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id AND user_id = p_user_id) THEN
        RAISE EXCEPTION 'Pelanggan tidak valid';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS create_money_loan(UUID, TEXT, NUMERIC, UUID, UUID, UUID, DATE, TEXT);
CREATE OR REPLACE FUNCTION create_money_loan(
    p_customer_id UUID,
    p_customer_name_snapshot TEXT,
    p_loan_amount NUMERIC,
    p_source_account_id UUID,
    p_expense_category_id UUID,
    p_income_category_id UUID,
    p_loan_date DATE,
    p_description TEXT
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_display_name TEXT;
    v_expense_tx_id UUID;
    v_debt_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_loan_amount IS NULL OR p_loan_amount <= 0 THEN
        RAISE EXCEPTION 'Jumlah pinjaman harus lebih dari 0';
    END IF;

    PERFORM assert_money_loan_ownership(v_user_id, p_customer_id, p_source_account_id, p_income_category_id, p_expense_category_id);

    v_display_name := COALESCE(
        NULLIF(TRIM(COALESCE(p_customer_name_snapshot, '')), ''),
        (SELECT name FROM customers WHERE id = p_customer_id AND user_id = v_user_id),
        'pelanggan'
    );

    -- Uang keluar dari akun sumber saat pinjaman diserahkan.
    INSERT INTO transactions (user_id, type, amount, account_id, category_id, description, transaction_date)
    VALUES (
        v_user_id,
        'expense',
        p_loan_amount,
        p_source_account_id,
        p_expense_category_id,
        COALESCE(NULLIF(TRIM(COALESCE(p_description, '')), ''), 'Pinjaman ' || v_display_name),
        COALESCE(p_loan_date, CURRENT_DATE)
    )
    RETURNING id INTO v_expense_tx_id;

    BEGIN
        INSERT INTO debts (
            user_id, customer_id, customer_name_snapshot, sale_id, kind,
            loan_amount, loan_date, loan_source_account_id,
            loan_expense_category_id, loan_income_category_id,
            loan_description, loan_expense_transaction_id
        )
        VALUES (
            v_user_id, p_customer_id, NULLIF(TRIM(COALESCE(p_customer_name_snapshot, '')), ''), NULL, 'loan',
            p_loan_amount, COALESCE(p_loan_date, CURRENT_DATE), p_source_account_id,
            p_expense_category_id, p_income_category_id,
            NULLIF(TRIM(COALESCE(p_description, '')), ''), v_expense_tx_id
        )
        RETURNING id INTO v_debt_id;
    EXCEPTION WHEN OTHERS THEN
        DELETE FROM transactions WHERE id = v_expense_tx_id;
        RAISE;
    END;

    RETURN v_debt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS update_money_loan(UUID, UUID, TEXT, NUMERIC, UUID, UUID, UUID, DATE, TEXT);
CREATE OR REPLACE FUNCTION update_money_loan(
    p_debt_id UUID,
    p_customer_id UUID,
    p_customer_name_snapshot TEXT,
    p_loan_amount NUMERIC,
    p_source_account_id UUID,
    p_expense_category_id UUID,
    p_income_category_id UUID,
    p_loan_date DATE,
    p_description TEXT
)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_display_name TEXT;
    v_expense_tx_id UUID;
    v_paid NUMERIC;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_loan_amount IS NULL OR p_loan_amount <= 0 THEN
        RAISE EXCEPTION 'Jumlah pinjaman harus lebih dari 0';
    END IF;

    PERFORM assert_money_loan_ownership(v_user_id, p_customer_id, p_source_account_id, p_income_category_id, p_expense_category_id);

    PERFORM 1 FROM debts
    WHERE id = p_debt_id AND user_id = v_user_id AND kind = 'loan'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Data pinjaman tidak ditemukan';
    END IF;

    -- Tagihan tidak boleh lebih kecil dari cicilan yang sudah masuk.
    SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM debt_payments WHERE debt_id = p_debt_id AND user_id = v_user_id;

    IF p_loan_amount < v_paid THEN
        RAISE EXCEPTION 'Jumlah pinjaman tidak boleh lebih kecil dari total cicilan';
    END IF;

    v_display_name := COALESCE(
        NULLIF(TRIM(COALESCE(p_customer_name_snapshot, '')), ''),
        (SELECT name FROM customers WHERE id = p_customer_id AND user_id = v_user_id),
        'pelanggan'
    );

    SELECT loan_expense_transaction_id INTO v_expense_tx_id
    FROM debts WHERE id = p_debt_id AND user_id = v_user_id;

    UPDATE debts
    SET customer_id = p_customer_id,
        customer_name_snapshot = NULLIF(TRIM(COALESCE(p_customer_name_snapshot, '')), ''),
        loan_amount = p_loan_amount,
        loan_date = COALESCE(p_loan_date, CURRENT_DATE),
        loan_source_account_id = p_source_account_id,
        loan_expense_category_id = p_expense_category_id,
        loan_income_category_id = p_income_category_id,
        loan_description = NULLIF(TRIM(COALESCE(p_description, '')), ''),
        updated_at = NOW()
    WHERE id = p_debt_id AND user_id = v_user_id;

    -- Sinkronkan transaksi pengeluaran penyerahan pinjaman.
    IF v_expense_tx_id IS NOT NULL THEN
        UPDATE transactions
        SET amount = p_loan_amount,
            account_id = p_source_account_id,
            category_id = p_expense_category_id,
            description = COALESCE(NULLIF(TRIM(COALESCE(p_description, '')), ''), 'Pinjaman ' || v_display_name),
            transaction_date = COALESCE(p_loan_date, CURRENT_DATE)
        WHERE id = v_expense_tx_id AND user_id = v_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS delete_money_loan(UUID);
CREATE OR REPLACE FUNCTION delete_money_loan(p_debt_id UUID)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_expense_tx_id UUID;
    v_payment_tx_ids UUID[];
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT loan_expense_transaction_id
    INTO v_expense_tx_id
    FROM debts
    WHERE id = p_debt_id AND user_id = v_user_id AND kind = 'loan'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Data pinjaman tidak ditemukan';
    END IF;

    SELECT COALESCE(array_agg(income_transaction_id), ARRAY[]::UUID[])
    INTO v_payment_tx_ids
    FROM debt_payments
    WHERE debt_id = p_debt_id AND user_id = v_user_id AND income_transaction_id IS NOT NULL;

    DELETE FROM debts WHERE id = p_debt_id AND user_id = v_user_id;

    DELETE FROM transactions
    WHERE user_id = v_user_id
      AND (id = ANY(v_payment_tx_ids) OR id = v_expense_tx_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS update_credit_sale(UUID, UUID, TEXT, UUID, TEXT, DATE, NUMERIC, NUMERIC, UUID, UUID, UUID, TEXT);
CREATE OR REPLACE FUNCTION update_credit_sale(
    p_debt_id UUID,
    p_customer_id UUID,
    p_customer_name_snapshot TEXT,
    p_product_type_id UUID,
    p_product_type_name_snapshot TEXT,
    p_sale_date DATE,
    p_cost_amount NUMERIC,
    p_sell_amount NUMERIC,
    p_cost_account_id UUID,
    p_expense_category_id UUID,
    p_income_category_id UUID,
    p_description TEXT
)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_sale_id UUID;
    v_expense_tx_id UUID;
    v_expense_desc TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT sale_id INTO v_sale_id
    FROM debts WHERE id = p_debt_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Data hutang tidak ditemukan';
    END IF;

    IF p_sell_amount IS NULL OR p_sell_amount <= 0 THEN
        RAISE EXCEPTION 'Harga jual harus lebih dari 0';
    END IF;

    IF p_cost_amount IS NULL OR p_cost_amount < 0 THEN
        RAISE EXCEPTION 'Modal tidak boleh negatif';
    END IF;

    PERFORM assert_credit_sale_ownership(v_user_id, p_customer_id, p_product_type_id, p_cost_account_id, p_income_category_id, p_expense_category_id);

    SELECT expense_transaction_id INTO v_expense_tx_id
    FROM sales WHERE id = v_sale_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Data penjualan tidak ditemukan';
    END IF;

    IF v_expense_tx_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM transactions WHERE id = v_expense_tx_id AND user_id = v_user_id) THEN
        v_expense_tx_id := NULL;
    END IF;

    v_expense_desc := COALESCE(NULLIF(TRIM(COALESCE(p_description, '')), ''), 'HPP ' || COALESCE(NULLIF(TRIM(COALESCE(p_product_type_name_snapshot, '')), ''), 'Penjualan'));

    IF p_cost_amount > 0 THEN
        IF v_expense_tx_id IS NOT NULL THEN
            UPDATE transactions
            SET amount = p_cost_amount,
                account_id = p_cost_account_id,
                category_id = p_expense_category_id,
                description = v_expense_desc,
                transaction_date = p_sale_date
            WHERE id = v_expense_tx_id AND user_id = v_user_id;
        ELSE
            INSERT INTO transactions (user_id, type, amount, account_id, category_id, description, transaction_date)
            VALUES (v_user_id, 'expense', p_cost_amount, p_cost_account_id, p_expense_category_id, v_expense_desc, p_sale_date)
            RETURNING id INTO v_expense_tx_id;
        END IF;
    ELSE
        IF v_expense_tx_id IS NOT NULL THEN
            DELETE FROM transactions WHERE id = v_expense_tx_id AND user_id = v_user_id;
            v_expense_tx_id := NULL;
        END IF;
    END IF;

    -- Credit sale tidak punya income tx penuh: pastikan tetap NULL.
    UPDATE sales
    SET product_type_id = p_product_type_id,
        product_type_name_snapshot = p_product_type_name_snapshot,
        sale_date = p_sale_date,
        cost_amount = p_cost_amount,
        sell_amount = p_sell_amount,
        cost_account_id = p_cost_account_id,
        income_account_id = NULL,
        income_category_id = p_income_category_id,
        expense_category_id = p_expense_category_id,
        expense_transaction_id = v_expense_tx_id,
        income_transaction_id = NULL,
        customer_ref = NULLIF(TRIM(COALESCE(p_customer_name_snapshot, '')), ''),
        description = NULLIF(TRIM(COALESCE(p_description, '')), '')
    WHERE id = v_sale_id AND user_id = v_user_id;

    UPDATE debts
    SET customer_id = p_customer_id,
        customer_name_snapshot = NULLIF(TRIM(COALESCE(p_customer_name_snapshot, '')), '')
    WHERE id = p_debt_id AND user_id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ================================================================
-- MIGRASI: PRODUCTS (master katalog) -> PRODUCT_TYPES (daftar tipe)
-- Urutan ketat: seed bawaan -> custom dari produk lama -> backfill sales
-- -> drop product_id -> drop tabel products. JANGAN diubah urutannya.
-- Nama kanonis bawaan: Pulsa, Kuota, Token Listrik, Wifi
-- (sama dengan BUILTIN_PRODUCT_TYPES di src/lib/validations/product-types.ts).
-- ================================================================

-- 1-4 dibungkus guard agar aman di database fresh (tanpa tabel products lama)
-- maupun database lama (dengan products + sales.product_id). Seluruh referensi
-- ke tabel/kolom lama hanya dieksekusi bila objeknya benar-benar ada.
DO $$
DECLARE
    r RECORD;
    v_has_products BOOLEAN := (to_regclass('public.products') IS NOT NULL);
    v_has_sales_product_id BOOLEAN := EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'product_id'
    );
BEGIN
    IF v_has_products THEN
        -- 1. Seed 4 tipe bawaan untuk semua user eksisting.
        FOR r IN (
            SELECT DISTINCT user_id FROM sales
            UNION
            SELECT DISTINCT user_id FROM products
        ) LOOP
            INSERT INTO product_types (user_id, name, is_builtin, is_active)
            VALUES
                (r.user_id, 'Pulsa', true, true),
                (r.user_id, 'Kuota', true, true),
                (r.user_id, 'Token Listrik', true, true),
                (r.user_id, 'Wifi', true, true)
            ON CONFLICT (user_id, name) DO NOTHING;
        END LOOP;

        -- 2. Buat tipe custom dari produk lama bertipe 'lainnya' (distinct per user+nama).
        INSERT INTO product_types (user_id, name, is_builtin, is_active)
        SELECT DISTINCT p.user_id, p.name, false, true
        FROM products p
        WHERE p.product_type = 'lainnya'
        ON CONFLICT (user_id, name) DO NOTHING;

        IF v_has_sales_product_id THEN
            -- 3a. Backfill sales yang ter-link ke produk bertipe bawaan
            -- (pulsa/kuota/token_listrik/wifi) -> tipe builtin se-nama.
            -- NOTE: tabel target (s) tidak boleh direferensikan di JOIN .. ON,
            -- jadi relasi ke s ditaruh di WHERE.
            UPDATE sales s
            SET product_type_id = pt.id,
                product_type_name_snapshot = pt.name
            FROM products p, product_types pt
            WHERE s.product_id = p.id
              AND pt.user_id = s.user_id
              AND pt.is_builtin = true
              AND pt.name = CASE p.product_type
                    WHEN 'pulsa' THEN 'Pulsa'
                    WHEN 'kuota' THEN 'Kuota'
                    WHEN 'token_listrik' THEN 'Token Listrik'
                    WHEN 'wifi' THEN 'Wifi'
                END
              AND p.product_type IN ('pulsa', 'kuota', 'token_listrik', 'wifi');

            -- 3b. Backfill sales yang ter-link ke produk bertipe 'lainnya' -> tipe custom se-nama.
            UPDATE sales s
            SET product_type_id = pt.id,
                product_type_name_snapshot = pt.name
            FROM products p, product_types pt
            WHERE s.product_id = p.id
              AND pt.user_id = s.user_id
              AND pt.name = p.name
              AND p.product_type = 'lainnya';

            -- 3c. Sales manual lama (product_id NULL): pertahankan snapshot apa adanya,
            -- product_type_id tetap NULL -> grup "Tanpa tipe" di laporan.
        END IF;
    END IF;
END;
$$;

-- 4. Hapus kolom lama product_id lalu drop tabel products.
-- Aman di fresh DB: IF EXISTS / IF NOT EXISTS tidak error bila objek tak ada.
ALTER TABLE sales DROP COLUMN IF EXISTS product_id;
ALTER TABLE sales DROP COLUMN IF EXISTS product_name_snapshot;
DROP TABLE IF EXISTS products;

-- ================================================================
-- MIGRASI: DEBTS UMUM — dukung pinjaman uang (kind='loan')
-- Kolom baru + sale_id menjadi nullable. Aman dijalankan berulang:
-- fresh DB sudah mendapat kolom ini dari CREATE TABLE (IF NOT EXISTS
-- tidak melakukan apa-apa), DB lama mendapat kolom + backfill kind.
-- ================================================================
ALTER TABLE debts ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'sale';
ALTER TABLE debts ADD COLUMN IF NOT EXISTS loan_amount NUMERIC(15, 2);
ALTER TABLE debts ADD COLUMN IF NOT EXISTS loan_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS loan_source_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS loan_expense_category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS loan_income_category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS loan_description TEXT;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS loan_expense_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL;

ALTER TABLE debts ALTER COLUMN sale_id DROP NOT NULL;

-- Konsistensi kind vs sumber tagihan (drop-add agar definisi selalu terbarukan).
ALTER TABLE debts DROP CONSTRAINT IF EXISTS debts_kind_source_check;
ALTER TABLE debts ADD CONSTRAINT debts_kind_source_check CHECK (
    (kind = 'sale' AND sale_id IS NOT NULL AND loan_amount IS NULL)
    OR (kind = 'loan' AND sale_id IS NULL AND loan_amount IS NOT NULL)
);

-- RPC SECURITY DEFINER dijalankan sebagai owner, jadi berikan akses ke role anon/authenticated.
GRANT EXECUTE ON FUNCTION assert_sale_ownership(UUID, UUID, UUID, UUID, UUID, UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION create_sale(UUID, TEXT, DATE, NUMERIC, NUMERIC, UUID, UUID, UUID, UUID, TEXT, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION update_sale(UUID, UUID, TEXT, DATE, NUMERIC, NUMERIC, UUID, UUID, UUID, UUID, TEXT, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION delete_sale(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION assert_credit_sale_ownership(UUID, UUID, UUID, UUID, UUID, UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION create_credit_sale(UUID, TEXT, UUID, TEXT, DATE, NUMERIC, NUMERIC, UUID, UUID, UUID, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION record_debt_payment(UUID, NUMERIC, UUID, DATE, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION update_debt_payment(UUID, NUMERIC, UUID, DATE, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION delete_debt_payment(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION update_credit_sale(UUID, UUID, TEXT, UUID, TEXT, DATE, NUMERIC, NUMERIC, UUID, UUID, UUID, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION create_money_loan(UUID, TEXT, NUMERIC, UUID, UUID, UUID, DATE, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION update_money_loan(UUID, UUID, TEXT, NUMERIC, UUID, UUID, UUID, DATE, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION delete_money_loan(UUID) TO authenticated, anon, service_role;
