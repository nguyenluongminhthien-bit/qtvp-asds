-- ============================================================
-- MIGRATION: BỔ SUNG TRẠNG THÁI 'Lưu nháp' CHO BẢNG DNTT
-- Cho phép lưu phiếu Đề nghị thanh toán dở dang và nhân đôi
-- ============================================================

-- 1. Xóa ràng buộc kiểm tra trạng thái cũ (nếu có)
alter table dntt drop constraint if exists dntt_trang_thai_check;

-- 2. Cập nhật ràng buộc mới cho phép: 'Đã lưu', 'Lưu cập nhật', 'Lưu nháp'
alter table dntt add constraint dntt_trang_thai_check 
  check (trang_thai in ('Đã lưu', 'Lưu cập nhật', 'Lưu nháp'));

-- 3. Đặt giá trị mặc định là 'Đã lưu' (hoặc giữ nguyên)
alter table dntt alter column trang_thai set default 'Đã lưu';
