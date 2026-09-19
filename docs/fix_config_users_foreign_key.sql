-- =========================================================================
-- KHẮC PHỤC LỖI KHÓA NGOẠI KHI CẤP QUYỀN ĐA ĐƠN VỊ TRONG BẢNG CONFIG_USERS
-- Lỗi: insert or update on table "config_users" violates foreign key constraint "Config_Users_id_don_vi_fkey"
-- =========================================================================

-- BƯỚC 1: Xóa khóa ngoại ràng buộc 1 đơn vị duy nhất
-- (PostgreSQL phân biệt hoa thường khi đặt tên constraint có dấu ngoặc kép, nên cần bao bọc đúng "Config_Users_id_don_vi_fkey")

ALTER TABLE IF EXISTS "config_users" DROP CONSTRAINT IF EXISTS "Config_Users_id_don_vi_fkey";
ALTER TABLE IF EXISTS "config_users" DROP CONSTRAINT IF EXISTS config_users_id_don_vi_fkey;

ALTER TABLE IF EXISTS "Config_Users" DROP CONSTRAINT IF EXISTS "Config_Users_id_don_vi_fkey";
ALTER TABLE IF EXISTS "Config_Users" DROP CONSTRAINT IF EXISTS config_users_id_don_vi_fkey;

-- BƯỚC 2: Tự động quét và xóa mọi ràng buộc khóa ngoại liên quan đến id_don_vi trên bảng config_users (đảm bảo sạch sẽ 100%)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname, relname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname IN ('config_users', 'Config_Users')
          AND c.contype = 'f'
          AND conname ILIKE '%id_don_vi%'
    ) LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I;', r.relname, r.conname);
    END LOOP;
END $$;

-- BƯỚC 3: Mở rộng kiểu dữ liệu cột id_don_vi thành TEXT
-- (Tránh lỗi "value too long" khi chọn nhiều mã đơn vị dài ghép lại)
ALTER TABLE IF EXISTS "config_users" ALTER COLUMN id_don_vi TYPE text;
ALTER TABLE IF EXISTS "Config_Users" ALTER COLUMN id_don_vi TYPE text;
