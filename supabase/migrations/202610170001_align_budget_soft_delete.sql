-- Poin audit 01: selaraskan kolom budget dan keunikan setelah soft delete.
-- Jalankan pada database project yang sudah memiliki tabel budgets.
-- Aman dijalankan ulang; tidak menghapus baris budget atau transaksi keuangan.
BEGIN;

ALTER TABLE public.budgets
    ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS budgets_active_user_category_period_unique_idx
    ON public.budgets (user_id, category_id, period_month, period_year)
    WHERE deleted_at IS NULL;

ALTER TABLE public.budgets
    DROP CONSTRAINT IF EXISTS budgets_user_category_period_unique_idx;
DROP INDEX IF EXISTS public.budgets_user_category_period_unique_idx;

COMMIT;
