-- ==============================================================================
-- MIGRATION: CHO PHÉP 1 PHÁP NHÂN DÙNG CHUNG NHIỀU ĐƠN VỊ TRỰC THUỘC
-- ==============================================================================
-- Bảng: dm_phap_nhan
-- Mục đích: Gỡ bỏ ràng buộc foreign key đơn lẻ để cột id_don_vi có thể lưu chuỗi
--           chứa nhiều ID đơn vị (ngăn cách bằng dấu phẩy, VD: 'DV01,DV02,DV03')
-- ==============================================================================

-- 1. Xóa ràng buộc khóa ngoại đang cản trở việc lưu chuỗi nhiều ID đơn vị
ALTER TABLE dm_phap_nhan 
DROP CONSTRAINT IF EXISTS dm_phap_nhan_id_don_vi_fkey;

-- 2. Đảm bảo cột id_don_vi có kiểu dữ liệu TEXT để chứa chuỗi nhiều ID thoải mái
ALTER TABLE dm_phap_nhan 
ALTER COLUMN id_don_vi TYPE TEXT;

-- 3. Cập nhật chú thích cho cột
COMMENT ON COLUMN dm_phap_nhan.id_don_vi IS 'Danh sách ID các đơn vị áp dụng, ngăn cách bằng dấu phẩy (VD: DV01,DV02,DV03)';
