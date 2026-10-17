-- Jalankan setelah schema.sql atau migrasi budget.
-- Hanya menguji tabel temporer yang menyalin kolom, default, dan index budgets;
-- tidak membaca atau mengubah data pengguna. Error berarti regresi.
BEGIN;

CREATE TEMP TABLE budget_soft_delete_test
    (LIKE public.budgets INCLUDING ALL)
    ON COMMIT DROP;

DO $$
DECLARE
    v_user UUID := gen_random_uuid();
    v_category UUID := gen_random_uuid();
    v_old_id UUID;
    v_new_id UUID;
    v_auto BOOLEAN;
    v_deleted_at TIMESTAMPTZ;
BEGIN
    INSERT INTO budget_soft_delete_test
        (user_id, category_id, period_month, period_year, amount)
    VALUES (v_user, v_category, 10, 2026, 100000)
    RETURNING id, is_auto_generated, deleted_at
    INTO v_old_id, v_auto, v_deleted_at;

    IF v_auto IS DISTINCT FROM false OR v_deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'Budget manual baru harus aktif dan bukan auto-generated';
    END IF;

    BEGIN
        INSERT INTO budget_soft_delete_test
            (user_id, category_id, period_month, period_year, amount)
        VALUES (v_user, v_category, 10, 2026, 200000);
        RAISE EXCEPTION 'Duplikasi budget aktif seharusnya ditolak';
    EXCEPTION WHEN unique_violation THEN
        NULL;
    END;

    UPDATE budget_soft_delete_test SET deleted_at = NOW() WHERE id = v_old_id;

    IF EXISTS (SELECT 1 FROM budget_soft_delete_test WHERE deleted_at IS NULL) THEN
        RAISE EXCEPTION 'Budget terhapus masih muncul dalam daftar aktif';
    END IF;

    INSERT INTO budget_soft_delete_test
        (user_id, category_id, period_month, period_year, amount)
    VALUES (v_user, v_category, 10, 2026, 200000)
    RETURNING id INTO v_new_id;

    IF (SELECT COUNT(*) FROM budget_soft_delete_test) <> 2
       OR (SELECT SUM(amount) FROM budget_soft_delete_test WHERE deleted_at IS NULL) <> 200000
       OR NOT EXISTS (
           SELECT 1 FROM budget_soft_delete_test
           WHERE id = v_old_id AND amount = 100000 AND deleted_at IS NOT NULL
       ) THEN
        RAISE EXCEPTION 'Pembuatan ulang harus mempertahankan riwayat tanpa menghitungnya sebagai budget aktif';
    END IF;

    BEGIN
        UPDATE budget_soft_delete_test SET deleted_at = NULL WHERE id = v_old_id;
        RAISE EXCEPTION 'Pemulihan yang menduplikasi budget aktif seharusnya ditolak';
    EXCEPTION WHEN unique_violation THEN
        NULL;
    END;

    UPDATE budget_soft_delete_test SET deleted_at = NOW() WHERE id = v_new_id;
    INSERT INTO budget_soft_delete_test
        (user_id, category_id, period_month, period_year, amount)
    VALUES (v_user, v_category, 10, 2026, 300000);

    IF (SELECT COUNT(*) FROM budget_soft_delete_test WHERE deleted_at IS NOT NULL) <> 2
       OR (SELECT COUNT(*) FROM budget_soft_delete_test WHERE deleted_at IS NULL) <> 1 THEN
        RAISE EXCEPTION 'Hapus dan buat ulang berulang kali harus tetap konsisten';
    END IF;

    -- Keunikan tidak boleh menghalangi pengguna, kategori, atau periode berbeda.
    INSERT INTO budget_soft_delete_test
        (user_id, category_id, period_month, period_year, amount)
    VALUES
        (gen_random_uuid(), v_category, 10, 2026, 100000),
        (v_user, gen_random_uuid(), 10, 2026, 100000),
        (v_user, v_category, 11, 2026, 100000),
        (v_user, v_category, 10, 2027, 100000);

    BEGIN
        UPDATE budget_soft_delete_test SET period_month = 10
        WHERE user_id = v_user AND category_id = v_category
          AND period_month = 11 AND period_year = 2026;
        RAISE EXCEPTION 'Edit periode yang menduplikasi budget aktif seharusnya ditolak';
    EXCEPTION WHEN unique_violation THEN
        NULL;
    END;
END;
$$;

ROLLBACK;
